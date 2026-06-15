import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SensorsService {
  constructor(private prisma: PrismaService) {}

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

  async getHistory(vehicleId: string, sensorType: string, period: string) {
    let hours = 24;
    if (period === '1h') hours = 1;
    else if (period === '6h') hours = 6;
    else if (period === '7d') hours = 24 * 7;
    
    const sql = `
      SELECT 
        date_trunc('minute', te.timestamp) - INTERVAL '1 minute' * (EXTRACT(MINUTE FROM te.timestamp)::int % 5) AS bucket,
        AVG((te.metadata_json->>'temperature_c')::numeric) as avg_temp, 
        AVG((te.metadata_json->>'humidity_pct')::numeric) as avg_hum
      FROM trip_events te
      JOIN trips t ON t.id = te.trip_id
      WHERE t.vehicle_id = $1::uuid 
        AND te.timestamp > NOW() - INTERVAL '${hours} hours'
      GROUP BY 1 
      ORDER BY 1 ASC
    `;
    
    return this.prisma.$queryRawUnsafe(sql, vehicleId);
  }
}
