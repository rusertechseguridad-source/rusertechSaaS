import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

const RISK_THRESHOLDS = {
  elevated: 25,
  high: 50,
  critical: 75
};

const RISK_FACTORS = {
  signal_loss: 30,
  signal_loss_high_risk_zone: 50,
  route_deviation_minor: 10,
  route_deviation_major: 25,
  unacknowledged_critical_alert: 20,
  unacknowledged_warning_alert: 10,
  speed_exceeded_sustained: 15,
  unauthorized_stop: 20,
  temperature_deviation: 15,
  door_opened_unauthorized: 40,
  jammer_detected: 80,
  panic_button_pressed: 100,
  battery_disconnected: 50,
  harsh_driving: 5,
  driver_unresponsive: 15,
  driver_unresponsive_critical: 25
};

@Injectable()
@Processor('telemetry.raw')
export class RiskLevelProcessor extends WorkerHost {
  private readonly logger = new Logger(RiskLevelProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const payload = job.data;
    if (!payload.tripId || !payload.tenantId) {
      return;
    }

    const { tripId, tenantId, factors = [], eventType } = payload;
    
    // 1. Recuperar cache
    const cacheKey = `trip:risk:${tripId}`;
    let tripRisk: any = null;
    const cachedStr = await this.redisService.getClient().get(cacheKey);
    if (cachedStr) {
      tripRisk = JSON.parse(cachedStr);
    } else {
      const dbRisk = await this.prisma.tripRiskLevel.findUnique({
        where: { trip_id: tripId }
      });
      if (dbRisk) {
        tripRisk = {
          level: dbRisk.risk_level,
          score: dbRisk.risk_score,
          factors: dbRisk.active_factors || [],
          updatedAt: dbRisk.level_changed_at
        };
      } else {
        tripRisk = { level: 'normal', score: 0, factors: [], updatedAt: new Date() };
      }
    }

    // Determine current active factors based on DB state and incoming event
    let activeFactors = [...tripRisk.factors];

    // Example logic for incoming factors
    if (Array.isArray(factors)) {
       for (const factor of factors) {
          if (!activeFactors.find(f => f.factor === factor)) {
             activeFactors.push({ factor, score: RISK_FACTORS[factor as keyof typeof RISK_FACTORS] || 0 });
          }
       }
    }

    // 2. Recalcular score
    let baseScore = activeFactors.reduce((acc, f) => acc + (f.score || 0), 0);

    // 3. Aplicar decay si corresponde
    const now = new Date();
    const lastUpdate = new Date(tripRisk.updatedAt);
    const hoursDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    const decayRate = 10; // per hour
    const decayAmount = hoursDiff > 0 ? Math.floor(hoursDiff * decayRate) : 0;
    
    let currentScore = Math.max(0, baseScore - decayAmount);

    // 4. Multiplicadores contextuales
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { criticality: true }
    });

    let multiplier = 1.0;
    if (trip && trip.criticality === 'critical') {
      multiplier = 0.7; // Alta sensibilidad
    }
    // (Baja sensibilidad podría ser 1.5, Normal 1.0)

    // Ajustar umbrales según sensibilidad
    const thresholds = {
      elevated: RISK_THRESHOLDS.elevated * multiplier,
      high: RISK_THRESHOLDS.high * multiplier,
      critical: RISK_THRESHOLDS.critical * multiplier
    };

    // 5. Determinar nuevo nivel
    let newLevel = 'normal';
    if (currentScore >= thresholds.critical) {
      newLevel = 'critical';
    } else if (currentScore >= thresholds.high) {
      newLevel = 'high';
    } else if (currentScore >= thresholds.elevated) {
      newLevel = 'elevated';
    }

    // 6. Si el nivel CAMBIÓ
    if (newLevel !== tripRisk.level) {
      this.logger.log(`Risk level changed for trip ${tripId}: ${tripRisk.level} -> ${newLevel} (Score: ${currentScore})`);
      
      const updated = await this.prisma.tripRiskLevel.upsert({
        where: { trip_id: tripId },
        update: {
          risk_score: currentScore,
          risk_level: newLevel,
          previous_level: tripRisk.level,
          active_factors: activeFactors,
          level_changed_at: now
        },
        create: {
          trip_id: tripId,
          tenant_id: tenantId,
          risk_score: currentScore,
          risk_level: newLevel,
          active_factors: activeFactors,
          level_changed_at: now
        }
      });

      await this.prisma.tripRiskHistory.create({
        data: {
          trip_id: tripId,
          tenant_id: tenantId,
          from_level: tripRisk.level,
          to_level: newLevel,
          risk_score: currentScore,
          trigger_factor: 'Threshold exceeded',
        }
      });

      // 7. Emit Socket.io (Assuming a websocket gateway handles Redis PubSub, or we emit to Redis directly)
      const payloadObj = {
        tripId,
        from: tripRisk.level,
        to: newLevel,
        score: currentScore,
        factors: activeFactors
      };
      await this.redisService.getClient().publish('risk:level_changed', JSON.stringify(payloadObj));

      // 8. Notificaciones de emergencia
      if (newLevel === 'critical') {
        this.logger.warn(`EMERGENCY: Trip ${tripId} has reached CRITICAL risk level!`);
        // Lógica de notificación al NotificationService...
      }
    } else {
       // Just update score if changed
       if (currentScore !== tripRisk.score) {
          await this.prisma.tripRiskLevel.upsert({
             where: { trip_id: tripId },
             update: { risk_score: currentScore, active_factors: activeFactors },
             create: {
               trip_id: tripId,
               tenant_id: tenantId,
               risk_score: currentScore,
               active_factors: activeFactors,
               risk_level: newLevel
             }
          });
       }
    }

    // 9. Actualizar cache Redis (TTL 24h por defecto)
    const newCache = {
      level: newLevel,
      score: currentScore,
      factors: activeFactors,
      updatedAt: now.toISOString()
    };
    await this.redisService.getClient().set(cacheKey, JSON.stringify(newCache), 'EX', 86400);

    return newCache;
  }
}
