import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertTenantOwnership, tenantWhere } from '../common/tenant/tenant-scope';
import { LivePositionsService } from '../common/live-positions/live-positions.service';

@Injectable()
export class SensorsService {
  constructor(
    private prisma: PrismaService,
    private livePositions: LivePositionsService,
  ) {}

  async getConfigs(tenantId: string) {
    return this.prisma.sensorConfig.findMany({
      where: { tenant_id: tenantId },
    });
  }

  async upsertConfig(data: any, tenantId: string) {
    // Check if a config exists for this scope
    const existing = await this.prisma.sensorConfig.findFirst({
      where: {
        tenant_id: tenantId,
        sensor_type: data.sensor_type,
        scope_type: data.scope_type || 'vehicle',
        scope_id: data.scope_id,
      }
    });

    if (existing) {
      return this.prisma.sensorConfig.update({
        where: { id: existing.id },
        data: {
          value_min: data.value_min ?? data.min_value,
          value_max: data.value_max ?? data.max_value,
          is_active: data.is_active !== undefined ? data.is_active : true,
        }
      });
    }

    return this.prisma.sensorConfig.create({
      data: {
        tenant_id: tenantId,
        sensor_type: data.sensor_type,
        scope_type: data.scope_type || 'vehicle',
        scope_id: data.scope_id,
        value_min: data.value_min ?? data.min_value ?? 0,
        value_max: data.value_max ?? data.max_value ?? 100,
        is_active: data.is_active !== undefined ? data.is_active : true,
      }
    });
  }

  async toggleConfig(id: string, tenantId: string) {
    const current = await this.prisma.sensorConfig.findFirst({
      where: tenantWhere(tenantId, 'SensorsService.toggleConfig', { id }),
    });
    if (!current) throw new NotFoundException('Configuración de sensor no encontrada');
    return this.prisma.sensorConfig.update({
      where: { id },
      data: { is_active: !current.is_active }
    });
  }

  async getDashboard(tenantId: string) {
    const configs = await this.prisma.sensorConfig.findMany({
      where: { tenant_id: tenantId, is_active: true, scope_type: 'vehicle' }
    });

    if (!configs.length) return [];

    const vehicleIds = configs.map(c => c.scope_id);
    const vehicles = await this.prisma.vehicle.findMany({
      where: tenantWhere(tenantId, 'SensorsService.getDashboard', { id: { in: vehicleIds } }),
      select: { 
        id: true, plate: true, alias: true, hub_asset_id: true,
        avl_user: { select: { name: true, user_avl_code: true } },
        carrier: { select: { name: true } },
      }
    });

    // Mismo problema que tenía el mapa en vivo: este tablero leía la caché de
    // Redis, que sólo conoce los puntos que entran por el ingest de NestJS. Los
    // vehículos rastreados desde la app móvil nunca aparecían con datos.
    // Ahora usa la misma fuente única, con Postgres como verdad.
    const posiciones = await this.livePositions.obtenerPorTenant(tenantId);
    const posicionPorVehiculo = new Map(posiciones.map((p) => [p.vehicle_id, p]));

    const result = [];

    for (const v of vehicles) {
      const vConfigs = configs.filter(c => c.scope_id === v.id);
      const latestData = posicionPorVehiculo.get(v.id) ?? null;

      result.push({
        vehicle: v,
        configs: vConfigs,
        latest: latestData ? {
          timestamp: latestData.timestamp,
          temperature_c: latestData.temperature_c,
          humidity_pct: latestData.humidity_pct,
          // Antigüedad del dato: un valor de hace horas no es una lectura actual.
          age_seconds: latestData.age_seconds,
          freshness: latestData.freshness,
        } : null
      });
    }

    return result;
  }

  async getHistory(vehicleId: string, tenantId: string, sensorType: string, period: string) {
    // Sin esta verificación, cualquier usuario autenticado podía leer el
    // histórico de sensores de un vehículo de otro cliente pasando su UUID.
    await assertTenantOwnership(this.prisma.vehicle, vehicleId, tenantId, 'Vehículo');

    let hours = 24;
    if (period === '1h') hours = 1;
    else if (period === '6h') hours = 6;
    else if (period === '7d') hours = 24 * 7;
    
    // Using native PostgreSQL date_trunc and math for 5-minute buckets
    // This matches the Bloque 7 Master Prompt fallback
    // Consulta parametrizada: `hours` y el tenant dejan de interpolarse en el
    // string. El filtro por tenant_id además permite podar particiones.
    return this.prisma.$queryRaw`
      SELECT
        date_trunc('minute', timestamp) -
        INTERVAL '1 minute' * (EXTRACT(MINUTE FROM timestamp)::int % 5) AS bucket,
        AVG(temperature_c) as avg_temp,
        AVG(humidity_pct) as avg_hum
      FROM telemetry
      WHERE vehicle_id = ${vehicleId}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND timestamp > NOW() - (${hours} * INTERVAL '1 hour')
      GROUP BY 1
      ORDER BY 1 ASC
    `;
  }
}
