import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { cifrarSecreto, hayCredencial, CONTEXTO } from '../common/crypto/secretos-cifrados';
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
    // La clave NO viaja al navegador: la usa el backend contra la API de
    // Climatiq, así que nadie del otro lado necesita verla. Se informa si hay
    // una guardada, que es lo que la pantalla tiene que mostrar.
    const { climatiq_api_key, ...resto } = settings;
    return { ...resto, tiene_climatiq_api_key: hayCredencial(climatiq_api_key) };
  }

  async updateSettings(tenantId: string, data: any) {
    // ⚠️ `undefined` y no `null` cuando no viene la clave: Prisma omite las
    // claves `undefined`, así que cambiar el método de cálculo sin reenviar la
    // clave la CONSERVA. Con `null` se borraría en silencio y la huella de
    // carbono pasaría a calcularse por fórmula sin que nadie lo decidiera.
    const clave =
      data.climatiq_api_key === undefined
        ? undefined
        : (cifrarSecreto(data.climatiq_api_key, CONTEXTO.climatiqApiKey) ?? null);

    return this.prisma.carbonSetting.upsert({
      where: { tenant_id: tenantId },
      update: {
        use_climatiq_api: data.use_climatiq_api,
        climatiq_api_key: clave,
        default_method: data.default_method,
      },
      create: {
        tenant_id: tenantId,
        use_climatiq_api: data.use_climatiq_api,
        climatiq_api_key: clave ?? null,
        default_method: data.default_method || 'formula',
      },
    });
  }

  async toggleClimatiq(tenantId: string, useClimatiq: boolean, apiKey?: string) {
    const clave = apiKey === undefined
      ? undefined
      : (cifrarSecreto(apiKey, CONTEXTO.climatiqApiKey) ?? null);

    return this.prisma.carbonSetting.upsert({
      where: { tenant_id: tenantId },
      update: {
        use_climatiq_api: useClimatiq,
        ...(clave !== undefined && { climatiq_api_key: clave }),
      },
      create: {
        tenant_id: tenantId,
        use_climatiq_api: useClimatiq,
        climatiq_api_key: clave ?? null,
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
