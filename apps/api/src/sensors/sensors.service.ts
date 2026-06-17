import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class SensorsService {
  constructor(private prisma: PrismaService, private redis: RedisService) {}

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

  async toggleConfig(id: string) {
    const current = await this.prisma.sensorConfig.findUnique({ where: { id } });
    if (!current) throw new Error('Not found');
    return this.prisma.sensorConfig.update({
      where: { id },
      data: { is_active: !current.is_active }
    });
  }

  async getDashboard(tenantId: string) {
    const configs = await this.prisma.sensorConfig.findMany({
      where: { tenant_id: tenantId, is_active: true, scope_type: 'vehicle' }
    });
    console.log('getDashboard called for tenant:', tenantId, 'found configs:', configs.length);

    if (!configs.length) return [];

    const vehicleIds = configs.map(c => c.scope_id);
    const vehicles = await this.prisma.vehicle.findMany({
      where: { id: { in: vehicleIds } },
      select: { 
        id: true, plate: true, alias: true, hub_asset_id: true,
        avl_user: { select: { name: true, user_avl_code: true } },
        carrier: { select: { name: true } },
      }
    });

    const client = this.redis.getClient();
    const result = [];

    for (const v of vehicles) {
      const vConfigs = configs.filter(c => c.scope_id === v.id);
      let latestData = null;

      if (v.hub_asset_id) {
        const posStr = await client.get(`vehicle:pos:${v.hub_asset_id}`);
        if (posStr) latestData = JSON.parse(posStr);
      }

      result.push({
        vehicle: v,
        configs: vConfigs,
        latest: latestData ? {
          timestamp: latestData.timestamp,
          temperature_c: latestData.temperature_c,
          humidity_pct: latestData.humidity_pct
        } : null
      });
    }

    return result;
  }

  async getHistory(vehicleId: string, sensorType: string, period: string) {
    let hours = 24;
    if (period === '1h') hours = 1;
    else if (period === '6h') hours = 6;
    else if (period === '7d') hours = 24 * 7;
    
    // Using native PostgreSQL date_trunc and math for 5-minute buckets
    // This matches the Bloque 7 Master Prompt fallback
    const sql = `
      SELECT 
        date_trunc('minute', timestamp) - 
        INTERVAL '1 minute' * (EXTRACT(MINUTE FROM timestamp)::int % 5) AS bucket,
        AVG(temperature_c) as avg_temp, 
        AVG(humidity_pct) as avg_hum
      FROM telemetry
      WHERE vehicle_id = $1::uuid 
        AND timestamp > NOW() - INTERVAL '${hours} hours'
      GROUP BY 1 
      ORDER BY 1 ASC
    `;
    
    return this.prisma.$queryRawUnsafe(sql, vehicleId);
  }
}
