import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private getDateFilter(period?: string) {
    const date = new Date();
    switch (period) {
      case 'day':
        date.setDate(date.getDate() - 1);
        break;
      case 'week':
        date.setDate(date.getDate() - 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() - 1);
        break;
      case 'year':
        date.setFullYear(date.getFullYear() - 1);
        break;
      default:
        date.setMonth(date.getMonth() - 1); // default month
    }
    return date;
  }

  async getFleetAnalytics(tenantId: string, filters: any) {
    const startDate = this.getDateFilter(filters.period);

    const vehicleFilter = filters.vehicleId ? { vehicle_id: filters.vehicleId } : {};
    const operationFilter = filters.operationId ? { operation_id: filters.operationId } : {};

    // Get trips in period
    const trips = await this.prisma.trip.findMany({
      where: {
        tenant_id: tenantId,
        created_at: { gte: startDate },
        ...vehicleFilter,
        ...operationFilter,
      },
      select: {
        id: true,
        status: true,
        vehicle_id: true,
      }
    });

    const totalTrips = trips.length;
    const completedTrips = trips.filter(t => t.status === 'FINALIZADO').length;
    const canceledTrips = trips.filter(t => t.status === 'CANCELADO').length;

    // Get telemetry to calculate distance and avg speed
    const telemetryQuery: any = await this.prisma.$queryRaw`
      WITH telemetry_with_prev AS (
        SELECT 
          location, 
          LAG(location) OVER (PARTITION BY vehicle_id ORDER BY timestamp ASC) as prev_location,
          speed_kmh,
          timestamp,
          vehicle_id
        FROM telemetry
        WHERE tenant_id = ${tenantId}::uuid
          AND timestamp >= ${startDate}
          ${filters.vehicleId ? this.prisma.$queryRaw\`AND vehicle_id = \${filters.vehicleId}::uuid\` : this.prisma.$queryRaw\`\`}
      )
      SELECT 
        SUM(ST_Distance(prev_location, location)) / 1000 as total_km,
        AVG(speed_kmh) as avg_speed
      FROM telemetry_with_prev
      WHERE prev_location IS NOT NULL AND location IS NOT NULL
    `;

    const totalKm = telemetryQuery && telemetryQuery.length > 0 && telemetryQuery[0].total_km ? parseFloat(telemetryQuery[0].total_km) : 0;
    const avgSpeed = telemetryQuery && telemetryQuery.length > 0 && telemetryQuery[0].avg_speed ? parseFloat(telemetryQuery[0].avg_speed) : 0;

    return {
      totalTrips,
      completedTrips,
      canceledTrips,
      totalKm: totalKm.toFixed(2),
      avgSpeed: avgSpeed.toFixed(2),
    };
  }

  async getCarbonAnalytics(tenantId: string, filters: any) {
    const startDate = this.getDateFilter(filters.period);
    const vehicleFilter = filters.vehicleId ? { vehicle_id: filters.vehicleId } : {};

    const carbonLogs = await this.prisma.carbonLog.findMany({
      where: {
        tenant_id: tenantId,
        period_start: { gte: startDate },
        ...vehicleFilter,
      },
      include: {
        vehicle: true,
      }
    });

    const totalCo2 = carbonLogs.reduce((sum, log) => sum + Number(log.co2_kg), 0);
    
    // Group by vehicle
    const byVehicle: Record<string, any> = {};
    for (const log of carbonLogs) {
      const vid = log.vehicle_id;
      if (!byVehicle[vid]) {
        byVehicle[vid] = {
          vehicle_id: vid,
          plate: log.vehicle.plate,
          co2_kg: 0,
          distance_km: 0,
          fuel_liters: 0,
        };
      }
      byVehicle[vid].co2_kg += Number(log.co2_kg);
      byVehicle[vid].distance_km += Number(log.distance_km);
      byVehicle[vid].fuel_liters += Number(log.fuel_liters);
    }

    const vehicleRanking = Object.values(byVehicle).sort((a: any, b: any) => b.co2_kg - a.co2_kg);

    // Trend by day
    const trend = await this.prisma.$queryRaw`
      SELECT DATE(period_start) as date, SUM(co2_kg) as co2
      FROM carbon_logs
      WHERE tenant_id = ${tenantId}::uuid
        AND period_start >= ${startDate}
      GROUP BY DATE(period_start)
      ORDER BY DATE(period_start) ASC
    `;

    return {
      totalCo2: totalCo2.toFixed(2),
      vehicleRanking,
      trend,
    };
  }

  async getTripsAnalytics(tenantId: string, filters: any) {
    const startDate = this.getDateFilter(filters.period);

    const trips = await this.prisma.trip.findMany({
      where: {
        tenant_id: tenantId,
        created_at: { gte: startDate },
      },
      select: {
        status: true,
        actual_start: true,
        actual_end: true,
        planned_start: true,
        planned_end: true,
      }
    });

    const statusCounts = trips.reduce((acc: any, trip) => {
      acc[trip.status] = (acc[trip.status] || 0) + 1;
      return acc;
    }, {});

    const statusDistribution = Object.keys(statusCounts).map(k => ({ name: k, value: statusCounts[k] }));

    return {
      total: trips.length,
      statusDistribution,
    };
  }

  async getAlertsAnalytics(tenantId: string, filters: any) {
    const startDate = this.getDateFilter(filters.period);
    const vehicleFilter = filters.vehicleId ? { vehicle_id: filters.vehicleId } : {};

    const alerts = await this.prisma.eventLog.findMany({
      where: {
        tenant_id: tenantId,
        triggered_at: { gte: startDate },
        ...vehicleFilter,
      },
      select: {
        event_type: true,
        severity: true,
      }
    });

    const typeCounts = alerts.reduce((acc: any, al) => {
      acc[al.event_type] = (acc[al.event_type] || 0) + 1;
      return acc;
    }, {});

    const severityCounts = alerts.reduce((acc: any, al) => {
      acc[al.severity] = (acc[al.severity] || 0) + 1;
      return acc;
    }, {});

    return {
      total: alerts.length,
      byType: Object.keys(typeCounts).map(k => ({ name: k, value: typeCounts[k] })),
      bySeverity: Object.keys(severityCounts).map(k => ({ name: k, value: severityCounts[k] })),
    };
  }
}
