import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { MailService } from '../mail/mail.service';
import { assertTenantOwnership, tenantWhere } from '../common/tenant/tenant-scope';

@Injectable()
export class VehiclesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private mailService: MailService,
  ) {}

  async findAll(user: any, skip?: number, take?: number) {
    // Restricciones por usuario (un viewer puede tener una lista acotada de vehículos).
    // Se combinan con el filtro de tenant, nunca lo reemplazan.
    let restrictions: Record<string, any> = {};
    if (user?.role === 'viewer') {
      const fullUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { entity_restrictions: true },
      });
      const er = fullUser?.entity_restrictions as any;
      if (er && Array.isArray(er.vehicles) && er.vehicles.length > 0) {
        restrictions = { id: { in: er.vehicles } };
      }
    }

    return this.prisma.extended.vehicle.findMany({
      skip,
      take,
      where: tenantWhere(user?.tenantId, 'VehiclesService.findAll', restrictions),
      include: {
        avl_user: { select: { name: true, user_avl_code: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    // findFirst con tenant en el where: un id de otro tenant devuelve null → 404.
    const vehicle = await this.prisma.extended.vehicle.findFirst({
      where: tenantWhere(tenantId, 'VehiclesService.findOne', { id }),
      include: {
        avl_user: { select: { name: true, user_avl_code: true } },
      },
    });

    if (!vehicle) throw new NotFoundException('Vehículo no encontrado');

    const lastPosition = await this.leerPosicion(vehicle.id);

    return { ...vehicle, lastPosition };
  }

  /**
   * Últimas posiciones conocidas de los vehículos del tenant.
   *
   * Antes usaba `redis.keys('vehicle:pos:*')`, con dos problemas: devolvía las
   * posiciones de todos los tenants, y `KEYS` recorre el keyspace completo y
   * bloquea Redis mientras lo hace.
   *
   * Ahora las claves se derivan de los vehículos del tenant y se leen con un
   * único `MGET`. Es más barato que `SCAN` (no recorre nada: va directo a las
   * claves que interesan) y el aislamiento queda garantizado por construcción,
   * porque la lista de claves sale de una consulta ya scopeada por tenant.
   */
  async getLivePositions(tenantId: string) {
    const vehiculos = await this.prisma.extended.vehicle.findMany({
      where: tenantWhere(tenantId, 'VehiclesService.getLivePositions'),
      select: { id: true, plate: true, hub_asset_id: true },
    });

    if (vehiculos.length === 0) return [];

    const client = this.redis.getClient();
    const claves = vehiculos.map((v: { id: string }) => this.clavePosicion(v.id));
    const valores = await client.mget(...claves);

    return valores
      .map((raw, i) => {
        if (!raw) return null;
        try {
          return { ...JSON.parse(raw), vehicle_id: vehiculos[i].id, plate: vehiculos[i].plate };
        } catch {
          // Un valor corrupto en cache no debe tumbar el listado completo.
          return null;
        }
      })
      .filter((v) => v !== null);
  }

  async create(data: any, tenantId: string) {
    return this.prisma.extended.vehicle.create({
      data: {
        ...data,
        tenant_id: tenantId,
      },
    });
  }

  async update(id: string, tenantId: string, data: any) {
    await assertTenantOwnership(this.prisma.extended.vehicle, id, tenantId, 'Vehículo');

    return this.prisma.extended.vehicle.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, tenantId: string) {
    await assertTenantOwnership(this.prisma.extended.vehicle, id, tenantId, 'Vehículo');

    // Baja lógica: el vehículo conserva su historial de telemetría y viajes.
    return this.prisma.extended.vehicle.update({
      where: { id },
      data: { status: 'inactive' },
    });
  }

  async toggleBlock(id: string, tenantId: string, blocked: boolean, reason?: string) {
    await assertTenantOwnership(this.prisma.extended.vehicle, id, tenantId, 'Vehículo');

    const updated = await this.prisma.extended.vehicle.update({
      where: { id },
      data: {
        is_blocked: blocked,
        block_reason: blocked ? reason : null,
      },
      select: {
        id: true,
        plate: true,
        is_blocked: true,
        block_reason: true,
        hub_asset_id: true,
        avl_user_id: true,
        tenant_id: true,
        tenant: { select: { name: true } },
      },
    });

    // Invalidar la cache para que TelemetryService vea el nuevo estado.
    if (updated.hub_asset_id && updated.avl_user_id) {
      await this.redis.getClient().del(`vehicle:asset:${updated.avl_user_id}:${updated.hub_asset_id}`);
    }

    if (blocked && reason) {
      const toEmails: string[] = [];

      const tenantManagers = await this.prisma.extended.user.findMany({
        where: {
          tenant_id: updated.tenant_id,
          role_code: { in: ['account_owner', 'manager'] },
          status: 'active',
        },
        select: { email: true },
      });
      tenantManagers.forEach((u) => toEmails.push(u.email));

      if (toEmails.length > 0) {
        this.mailService
          .sendVehicleBlockedAlert({
            plate: updated.plate,
            reason,
            toEmails,
            tenantName: (updated as any).tenant?.name,
          })
          .catch((err) => console.error('Failed to send block alert email:', err));
      }

      // Auditoría del bloqueo.
      await this.prisma.extended.eventLog.create({
        data: {
          tenant_id: updated.tenant_id,
          vehicle_id: updated.id,
          event_type: 'vehicle_blocked',
          severity: 'critical',
          metadata_json: { reason, plate: updated.plate },
          status: 'open',
        },
      });
    } else if (!blocked) {
      await this.prisma.extended.eventLog.updateMany({
        where: { vehicle_id: updated.id, event_type: 'vehicle_blocked', status: 'open' },
        data: {
          status: 'resolved',
          resolved_at: new Date(),
          resolution_note: 'Vehículo desbloqueado manualmente',
        },
      });
    }

    return updated;
  }

  /**
   * Clave de la última posición en Redis.
   *
   * ⚠️ Corrige una inconsistencia previa: `TelemetryService` escribe en
   * `vehicle:position:{vehicleId}`, pero este servicio (y `sensors`) leían
   * `vehicle:pos:{hub_asset_id}`. Como nadie escribía esa segunda clave, la
   * posición en vivo nunca se encontraba. Se unifica con la del productor.
   */
  private clavePosicion(vehicleId: string): string {
    return `vehicle:position:${vehicleId}`;
  }

  private async leerPosicion(vehicleId: string): Promise<any | null> {
    const raw = await this.redis.getClient().get(this.clavePosicion(vehicleId));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
