import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { redisDisponible } from '../common/config/redis-conexion';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CarbonService {
  private readonly logger = new Logger(CarbonService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('carbon') private carbonQueue: Queue,
  ) {
    if (!redisDisponible()) {
      this.logger.warn(
        'REDIS_URL no configurado: el cálculo de huella de carbono queda pausado (sus colas necesitan Redis). Única línea al respecto.',
      );
    }
  }

  async getSettings(tenantId: string) {
    let settings = await this.prisma.carbonSetting.findUnique({
      where: { tenant_id: tenantId },
    });
    if (!settings) {
      settings = await this.prisma.carbonSetting.create({
        data: { tenant_id: tenantId },
      });
    }
    return settings;
  }

  async updateSettings(tenantId: string, data: any) {
    return this.prisma.carbonSetting.upsert({
      where: { tenant_id: tenantId },
      update: {
        use_climatiq_api: data.use_climatiq_api,
        climatiq_api_key: data.climatiq_api_key,
        default_method: data.default_method,
      },
      create: {
        tenant_id: tenantId,
        use_climatiq_api: data.use_climatiq_api,
        climatiq_api_key: data.climatiq_api_key,
        default_method: data.default_method || 'formula',
      },
    });
  }

  async toggleClimatiq(tenantId: string, useClimatiq: boolean, apiKey?: string) {
    return this.prisma.carbonSetting.upsert({
      where: { tenant_id: tenantId },
      update: {
        use_climatiq_api: useClimatiq,
        ...(apiKey !== undefined && { climatiq_api_key: apiKey }),
      },
      create: {
        tenant_id: tenantId,
        use_climatiq_api: useClimatiq,
        climatiq_api_key: apiKey,
      },
    });
  }

  // Cron Job to calculate partial emissions for active trips
  @Cron(CronExpression.EVERY_10_MINUTES)
  async calculateActiveTripsEmissions() {
    this.logger.log('Running calculateActiveTripsEmissions cron job');
    const activeTrips = await this.prisma.trip.findMany({
      where: {
        status: 'EN_CURSO',
        vehicle_id: { not: null },
      },
      select: {
        id: true,
        vehicle_id: true,
        tenant_id: true,
      },
    });

    for (const trip of activeTrips) {
      if (!redisDisponible()) return;
      if (!redisDisponible()) return;
    await this.carbonQueue.add('carbon.calculate', {
        tripId: trip.id,
        vehicleId: trip.vehicle_id,
        tenantId: trip.tenant_id,
        isFinal: false,
      });
    }
  }

  // Cron Job to recalculate fallback emissions when Climatiq API fails
  @Cron(CronExpression.EVERY_HOUR)
  async recalculateFallbackEmissions() {
    this.logger.log('Running recalculateFallbackEmissions cron job');
    // Find all settings where climatiq is enabled and key exists
    const settings = await this.prisma.carbonSetting.findMany({
      where: {
        use_climatiq_api: true,
        climatiq_api_key: { not: null },
      },
    });

    for (const setting of settings) {
      // Find logs with fallback_formula
      const logs = await this.prisma.carbonLog.findMany({
        where: {
          tenant_id: setting.tenant_id,
          calculation_method: 'fallback_formula',
        },
        take: 50, // Process in batches
      });

      for (const log of logs) {
        if (log.trip_id) {
          if (!redisDisponible()) return;
          await this.carbonQueue.add('carbon.calculate', {
            tripId: log.trip_id,
            vehicleId: log.vehicle_id,
            tenantId: log.tenant_id,
            isFinal: true, // Treat as final recalculation
            isRecalculation: true,
          });
        }
      }
    }
  }

  // Helper method to dispatch final calculation manually (e.g. from TripsService)
  async dispatchFinalCalculation(tripId: string, vehicleId: string, tenantId: string) {
    this.logger.log(`Dispatching final carbon calculation for trip ${tripId}`);
    await this.carbonQueue.add('carbon.calculate', {
      tripId,
      vehicleId,
      tenantId,
      isFinal: true,
    });
  }
}
