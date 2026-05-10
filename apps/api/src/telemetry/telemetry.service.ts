import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { GeocodingService } from './geocoding.service';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly geocoding: GeocodingService,
  ) {}

  async processIngest(payload: any, avlUserId: string, tenantId: string) {
    // 1. Validation & Normalization
    if (!payload.Asset) {
      throw new BadRequestException('Asset is required');
    }
    const lat = Number(payload.Latitude);
    const lng = Number(payload.Longitude);
    
    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      throw new BadRequestException('Invalid coordinates');
    }

    const timestamp = payload.Date ? new Date(payload.Date) : new Date();
    const speed = payload.Speed !== undefined && payload.Speed !== null && payload.Speed !== '' ? parseFloat(payload.Speed) : null;
    const course = payload.Course !== undefined && payload.Course !== null && payload.Course !== '' ? parseInt(payload.Course, 10) : null;
    const ignition = payload.Ignition === '1' || payload.Ignition === 1 || payload.Ignition === true;
    const altitude = payload.Altitude !== undefined && payload.Altitude !== null && payload.Altitude !== '' ? parseFloat(payload.Altitude) : null;
    const odometer = payload.Odometer !== undefined && payload.Odometer !== null && payload.Odometer !== '' ? parseFloat(payload.Odometer) : null;
    const battery = payload.Battery !== undefined && payload.Battery !== null && payload.Battery !== '' ? parseFloat(payload.Battery) : null;
    const temperature = payload.Temperature !== undefined && payload.Temperature !== null && payload.Temperature !== '' ? parseFloat(payload.Temperature) : null;
    const humidity = payload.Humidity !== undefined && payload.Humidity !== null && payload.Humidity !== '' ? parseFloat(payload.Humidity) : null;
    const direction = payload.Direction || null;
    const code = payload.Code || null;

    let isAnomalous = false;
    let isOutOfOrder = false;

    if (speed !== null && (speed < 0 || speed > 300)) {
      isAnomalous = true;
    }

    const now = new Date();
    if (timestamp.getTime() < now.getTime() - 48 * 3600 * 1000 || timestamp.getTime() > now.getTime() + 5 * 60 * 1000) {
      isOutOfOrder = true;
    }

    // 2. Resolve Vehicle
    const asset = payload.Asset;
    let vehicleId = await this.redis.get<string>(`vehicle:asset:${avlUserId}:${asset}`);
    
    if (!vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { hub_asset_id: asset, avl_user_id: avlUserId }
      });
      if (!vehicle) {
        throw new NotFoundException(`Vehículo no registrado. Asset: ${asset}`);
      }
      if (vehicle.is_blocked) {
        return { status: "blocked", message: "Vehículo bloqueado. Datos descartados." };
      }
      vehicleId = vehicle.id;
      await this.redis.set(`vehicle:asset:${avlUserId}:${asset}`, vehicleId, 3600);
    }

    // Anti Time-Travel
    const lastTs = await this.redis.get<number>(`vehicle:last_ts:${vehicleId}`);
    if (lastTs && timestamp.getTime() < lastTs) {
      isOutOfOrder = true;
    } else {
      await this.redis.set(`vehicle:last_ts:${vehicleId}`, timestamp.getTime());
    }

    // 3. Resolve Code (Dictionary)
    let eventType = null;
    if (code) {
      let dictData = await this.redis.get<any>(`avl:code:${avlUserId}:${code}`);
      if (!dictData) {
        const entry = await this.prisma.avlEventDictionary.findUnique({
          where: { avl_user_id_raw_code: { avl_user_id: avlUserId, raw_code: code } }
        });
        if (entry && entry.is_active) {
          dictData = { eventType: entry.event_type, triggersAlert: entry.triggers_alert, severity: entry.severity };
          await this.redis.set(`avl:code:${avlUserId}:${code}`, dictData, 21600); // 6h
        } else {
          eventType = `unknown_code:${code}`;
          await this.redis.getClient().sadd(`avl:unknown:${avlUserId}`, code);
        }
      }
      if (dictData) {
        eventType = dictData.eventType;
      }
    }

    // 4. Deduplication
    const dedupKey = `dedup:${vehicleId}:${timestamp.getTime()}`;
    const isDup = await this.redis.get(dedupKey);
    if (isDup) {
      return { status: "duplicate", skipped: true };
    }
    await this.redis.set(dedupKey, "1", 300);

    // 5. Outbox & DB Persistence
    const normalized = {
      tenant_id: tenantId,
      vehicle_id: vehicleId,
      timestamp,
      latitude: lat,
      longitude: lng,
      speed_kmh: speed,
      heading_degrees: course,
      ignition,
      altitude_meters: altitude,
      odometer_km: odometer,
      battery_pct: battery,
      temperature_c: temperature,
      humidity_pct: humidity,
      direction_label: direction,
      provider_code: code,
      event_type: eventType,
      raw_payload: payload,
    };

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).telemetry.create({
        data: {
          ...normalized,
          avl_user_id: avlUserId,
        }
      });
      // Set location PostGIS point
      await tx.$executeRawUnsafe(`UPDATE "telemetry" SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326) WHERE vehicle_id = '${vehicleId}' AND timestamp = '${timestamp.toISOString()}'`);

      await (tx as any).outboxMessage.create({
        data: {
          queue_name: 'telemetry.raw',
          job_name: 'processTelemetry',
          payload: { ...normalized, avlUserId },
        }
      });
    });

    // Update Redis last position cache (Initial, without address)
    const positionData = { ...normalized, avlUser: avlUserId, address: null as string | null };
    await this.redis.set(`vehicle:position:${vehicleId}`, positionData, 3600);

    // Fire and forget: Update last data at
    this.prisma.avlUser.update({ where: { id: avlUserId }, data: { last_data_at: new Date() } }).catch(() => {});

    // Fire and forget: Geocoding
    this.geocoding.reverseGeocode(lat, lng).then(async (address) => {
      if (address) {
        // Update position cache with address
        positionData.address = address;
        await this.redis.set(`vehicle:position:${vehicleId}`, positionData, 3600);
      }
    }).catch(err => this.logger.error('Async Geocoding failed', err));

    return { status: "accepted" };
  }
}
