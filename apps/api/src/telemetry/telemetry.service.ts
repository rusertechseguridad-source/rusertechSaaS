import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { GeocodingService } from './geocoding.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { redisDisponible } from '../common/config/redis-conexion';
import { claveDedupe } from './dedupe';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly geocoding: GeocodingService,
    @InjectQueue('forwarding.send') private forwardingQueue: Queue,
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
        const entry = await this.prisma.avlEventDictionary.findFirst({
          where: { avl_user_id: avlUserId, raw_code: code }
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

    // 4. Deduplicación
    // La clave incluye el CÓDIGO de evento, no solo (vehículo, instante).
    //
    // Antes era `dedup:${vehicleId}:${ts}` y descartaba eventos legítimos: el
    // AVL emite el paquete de evento con el MISMO fix de GPS que el reporte
    // periódico, y los timestamps del HUB tienen precisión de segundo. Un
    // `speed_exceeded` que compartía segundo con un punto de posición se perdía
    // entero — sin fila, sin `outbox_messages`, y por lo tanto sin motor de
    // eventos ni reenvío. Verificado en laboratorio.
    //
    // La identidad de una fila no es (vehículo, instante) sino
    // (vehículo, instante, qué reporta). Es el mismo criterio que ya usaba el
    // índice de la app móvil (`telemetry_mobile_dedupe`, que incluye `Code`):
    // esto sólo lo extiende al camino del HUB.
    const dedupKey = claveDedupe(vehicleId, timestamp, code);
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

    try {
      await this.prisma.$transaction(async (tx) => {
        await (tx as any).telemetry.create({
          data: {
            ...normalized,
            avl_user_id: avlUserId,
          },
        });

        // `location` NO se escribe acá a propósito: la llena el trigger
        // `fn_fill_location` (BEFORE INSERT) desde latitude/longitude, y está
        // clonado en todas las particiones —incluidas las que cree el cron en
        // el futuro, verificado— así que cubre también los puntos que la
        // Mobile API escribe directo sin pasar por este ingest.
        //
        // El UPDATE que estaba acá era redundante Y peligroso: identificaba la
        // fila por `(vehicle_id, timestamp)`, un par que NO es único (el mismo
        // vehículo puede tener una posición y un evento en el mismo segundo).
        // Reproducido en laboratorio: movía la geometría de un punto ajeno
        // 1.088 km. El trigger opera sobre NEW en memoria y no puede tocar
        // otra fila, así que quitarlo elimina esa clase de error de raíz.

        await (tx as any).outboxMessage.create({
          data: {
            queue_name: 'telemetry.raw',
            job_name: 'processTelemetry',
            payload: { ...normalized, avlUserId },
          },
        });
      });
    } catch (error: any) {
      // El índice `telemetry_hub_dedupe` es el respaldo EN BASE del dedupe de
      // Redis: cubre la reentrega posterior al TTL de 300 s, el reinicio de
      // Redis y la carrera entre instancias — los tres caminos por los que hoy
      // entra un duplicado. Un choque acá no es una falla: es exactamente el
      // caso que el índice existe para atrapar, y la respuesta correcta es la
      // misma que la del dedupe en memoria.
      //
      // Se distingue en la respuesta (`source`) para poder medir cuántos
      // duplicados se le escapan a Redis: si este contador crece, el TTL de
      // 300 s se quedó corto para el patrón de reentrega del proveedor.
      if (error?.code === 'P2002') {
        this.logger.debug(
          `Punto duplicado rechazado por la base: vehículo ${vehicleId}, ${timestamp.toISOString()}, código ${code ?? 'sin código'}`,
        );
        return { status: "duplicate", skipped: true, source: "db" };
      }
      throw error;
    }

    // Update Redis last position cache (Initial, without address)
    const positionData = { ...normalized, avlUser: avlUserId, address: null as string | null };
    await this.redis.set(`vehicle:position:${vehicleId}`, positionData, 3600);

    // Fire and forget: Update last data at
    // Fire and forget, pero nunca en silencio: antes el `.catch(() => {})`
    // se tragaba el error sin dejar rastro.
    this.prisma.avlUser
      .update({ where: { id: avlUserId }, data: { last_data_at: new Date() } })
      .catch((err: any) =>
        this.logger.warn(`No se pudo actualizar last_data_at del avl_user ${avlUserId}: ${err?.message ?? err}`),
      );

    // Fire and forget: Geocoding
    this.geocoding.reverseGeocode(lat, lng).then(async (address) => {
      if (address) {
        // Update position cache with address
        positionData.address = address;
        await this.redis.set(`vehicle:position:${vehicleId}`, positionData, 3600);
      }
    }).catch(err => this.logger.error('Async Geocoding failed', err));

    // Fire and forget: Forwarding. Sin Redis no hay cola que lo transporte:
    // se saltea sin ruido. (El hallazgo #4 de la auditoría sigue vigente —
    // el reenvío solo ve esta vía de ingreso — y tiene su propia tanda.)
    if (!redisDisponible()) return { status: "accepted" };
    this.prisma.positionForwarder.findMany({
      where: { tenant_id: tenantId, is_active: true, circuit_open: false }
    }).then(forwarders => {
      for (const f of forwarders) {
        this.forwardingQueue.add('send', { forwarderId: f.id, positionData }, { removeOnComplete: true, removeOnFail: 100 });
      }
    }).catch(err => this.logger.error('Async Forwarding failed', err));

    return { status: "accepted" };
  }
}
