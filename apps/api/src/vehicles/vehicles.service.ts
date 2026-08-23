import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { MailService } from '../mail/mail.service';
import { assertTenantOwnership, tenantWhere } from '../common/tenant/tenant-scope';
import { LivePositionsService } from '../common/live-positions/live-positions.service';

@Injectable()
export class VehiclesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private mailService: MailService,
    private livePositions: LivePositionsService,
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

    const lastPosition = await this.livePositions.obtenerPorVehiculo(vehicle.id, tenantId);

    return { ...vehicle, lastPosition };
  }

  /**
   * Últimas posiciones conocidas de los vehículos del tenant.
   *
   * Delega en LivePositionsService, que lee de Postgres (fuente de verdad) y
   * usa Redis sólo si `LIVE_POSITIONS_SOURCE=redis`, con caída a Postgres.
   *
   * Historial de este método, que explica por qué terminó así:
   *  1. Usaba `redis.keys('vehicle:pos:*')` → devolvía posiciones de todos los
   *     tenants y bloqueaba Redis con KEYS.
   *  2. Se corrigió a MGET acotado por tenant, pero seguía devolviendo vacío:
   *     leía `vehicle:pos:{hub_asset_id}`, una clave que nadie escribía.
   *  3. Alineado a `vehicle:position:{vehicleId}`, seguía vacío para los
   *     vehículos de la app móvil: la Mobile API escribe directo a `telemetry`
   *     sin pasar por el ingest de NestJS, así que Redis nunca los ve.
   * La causa raíz no era la clave: era depender de una caché que sólo conoce
   * una de las dos vías de ingreso de datos.
   */
  async getLivePositions(tenantId: string) {
    return this.livePositions.obtenerPorTenant(tenantId);
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

    // Invalidar la caché para que TelemetryService vea el nuevo estado.
    // Sólo aplica si Redis está configurado: sin él no hay caché que invalidar,
    // y bloquear un vehículo no puede fallar por eso.
    if (this.redis.isConfigured() && updated.hub_asset_id && updated.avl_user_id) {
      try {
        await this.redis
          .getClient()
          .del(`vehicle:asset:${updated.avl_user_id}:${updated.hub_asset_id}`);
      } catch (error) {
        console.warn(
          `[VehiclesService] No se pudo invalidar la caché del vehículo ${updated.plate}: ${(error as Error).message}`,
        );
      }
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

}
