import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { tenantWhere } from '../common/tenant/tenant-scope';
import { AccesoEntidadesService } from '../common/access/acceso-entidades.service';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private prisma: PrismaService,
    private readonly acceso: AccesoEntidadesService,
  ) {}

  /**
   * Listado de alertas. Recibe `user` porque cada alerta cuelga de un vehículo:
   * un usuario restringido a 3 vehículos veía las alertas de los 120.
   */
  async findAll(user: any) {
    const restriccion = await this.acceso.filtroPara(user, 'vehicles', 'vehicle_id');
    return this.prisma.eventLog.findMany({
      where: tenantWhere(user?.tenantId, 'AlertsService.findAll', restriccion),
      orderBy: { triggered_at: 'desc' },
      include: {
        vehicle: { select: { plate: true, alias: true } },
        trip: { select: { id: true, name: true, trip_code: true } },
        rule: { select: { name: true } },
        acknowledger: { select: { full_name: true, email: true } },
      },
    });
  }

  async getSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings_json: true },
    });
    return tenant?.settings_json || {};
  }

  async updateSettings(tenantId: string, userId: string, settings: any) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    let currentSettings: any = tenant?.settings_json;
    if (typeof currentSettings === 'string') {
      try {
        currentSettings = JSON.parse(currentSettings);
      } catch (e) {
        // settings_json corrupto: se registra y se sigue con el valor crudo,
        // en lugar de tragarse el error en silencio.
        this.logger.warn(`settings_json del tenant no es JSON válido: ${(e as Error).message}`);
      }
    }
    if (typeof currentSettings !== 'object' || currentSettings === null) {
      currentSettings = {};
    }
    
    const updatedSettings = { ...currentSettings, ...settings };

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings_json: updatedSettings },
    });

    return updatedSettings;
  }

  async resolveAlert(tenantId: string, id: string, userId: string, resolution_note?: string) {
    const alert = await this.prisma.eventLog.findUnique({
      where: { id, tenant_id: tenantId },
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    const updated = await this.prisma.eventLog.update({
      where: { id },
      data: {
        status: 'resolved',
        resolved_at: new Date(),
        acknowledged_by: userId,
        acknowledged_at: new Date(),
        resolution_note,
      },
    });

    if (alert.trip_id) {
      await this.prisma.tripCommandHistory.create({
        data: {
          tenant_id: tenantId,
          trip_id: alert.trip_id,
          executed_by: userId,
          command_type: 'alert_resolution',
          previous_value: 'active',
          new_value: 'resolved'
        }
      });
    }

    return updated;
  }
}
