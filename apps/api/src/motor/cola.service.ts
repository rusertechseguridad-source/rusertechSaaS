import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { PuntoEvaluable } from './tipos';

/** Cuántos puntos toma el worker por vuelta. */
const TAMANO_LOTE = 200;

/**
 * Minutos después de los cuales un arrendamiento se considera huérfano.
 * Si un worker muere a mitad de un lote, sus filas quedan en 'procesando'
 * para siempre. Este plazo las devuelve a la cola.
 */
const ARRENDAMIENTO_MINUTOS = 5;

/** Intentos antes de dar una fila por fallida. */
const INTENTOS_MAXIMOS = 5;

interface FilaCola {
  cola_id: string;
  telemetry_id: string;
  tenant_id: string;
  vehicle_id: string;
  trip_id: string | null;
  timestamp: Date;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  ignition: boolean | null;
  temperature_c: number | null;
  provider_code: string | null;
  origen: string;
}

export interface SaludCola {
  pendientes: number;
  procesando: number;
  fallidos: number;
  antiguedad_segundos: number | null;
  /**
   * Timestamp del pendiente más viejo. Se devuelve además de los segundos
   * para que el frontend recalcule el atraso con su propio reloj entre
   * refrescos, en vez de mostrar un número congelado.
   */
  pendiente_mas_viejo: Date | null;
}

/**
 * ACCESO A LA COLA DEL MOTOR.
 *
 * La cola es una tabla, no Redis ni pg_notify. El motivo está en el diseño:
 * pg_notify se pierde si el worker está caído, y encolar desde el código de
 * cada backend es exactamente el error que se repitió tres veces en este
 * sistema. Una tabla es transaccional con el INSERT que la originó.
 */
@Injectable()
export class ColaService {
  private readonly logger = new Logger(ColaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Toma un lote de puntos y los marca como en proceso.
   *
   * `FOR UPDATE SKIP LOCKED` es lo que permite que varios workers corran en
   * paralelo sin pisarse ni bloquearse entre sí: cada uno se lleva filas
   * distintas y ninguno espera al otro.
   *
   * ⚠️ El JOIN con `telemetry` lleva rango temporal CERRADO. Sin el extremo
   * superior, Postgres no puede descartar las particiones futuras ni la
   * `default`, y la planificación pasa a costar más que la ejecución
   * (medido: 30 particiones vs 1, 15,6 ms vs 6,1 ms).
   */
  async tomarLote(workerId: string): Promise<PuntoEvaluable[]> {
    const ahora = Date.now();
    // La ventana cubre el atraso máximo tolerable del motor. Un punto más
    // viejo que esto ya no tiene valor operativo y se descarta explícitamente
    // en `descartarVencidos`, no en silencio acá.
    const desde = new Date(ahora - 7 * 24 * 60 * 60 * 1000);
    const hasta = new Date(ahora + 5 * 60 * 1000);

    const filas: FilaCola[] = await this.prisma.$queryRaw<FilaCola[]>`
      WITH candidatas AS (
        SELECT id
        FROM motor_cola
        WHERE estado = 'pendiente'
        ORDER BY created_at
        LIMIT ${TAMANO_LOTE}
        FOR UPDATE SKIP LOCKED
      ),
      -- El JOIN va PRIMERO. Antes se marcaba 'procesando' y se incrementaba
      -- "intentos" sobre todas las candidatas, y recién después se descartaban
      -- las que no tenían punto: esas nunca llegaban al worker, así que nunca
      -- podían llamar a marcarFallido() —el único lugar donde vive el límite de
      -- reintentos— y "recuperarHuerfanas" las devolvía a 'pendiente' cada 5
      -- minutos. Bucle infinito con un contador "smallint": a los 32.767
      -- intentos (~114 días) el UPDATE aborta por desbordamiento y el motor
      -- entero deja de procesar, en silencio.
      con_punto AS (
        SELECT c.id, c.tenant_id, c.vehicle_id, c.trip_id, c.telemetry_id,
               c.telemetry_ts, c.origen,
               t.latitude, t.longitude, t.speed_kmh, t.ignition,
               t.temperature_c, t.provider_code
        FROM motor_cola c
        JOIN candidatas ON candidatas.id = c.id
        JOIN telemetry t
          ON t.id = c.telemetry_id
         AND t."timestamp" = c.telemetry_ts
         AND t."timestamp" >= ${desde}
         AND t."timestamp" <= ${hasta}
      ),
      -- Sólo se marca lo que de verdad va a procesarse.
      marcadas AS (
        UPDATE motor_cola c
        SET estado = 'procesando',
            tomado_at = now(),
            tomado_por = ${workerId},
            intentos = c.intentos + 1
        FROM con_punto
        WHERE c.id = con_punto.id
        RETURNING c.id
      ),
      -- Y lo que no tiene punto sale del bucle POR LA PUERTA, no por el techo
      -- del contador: se marca 'fallido' con el motivo escrito. Un punto que ya
      -- no existe no va a aparecer en el próximo intento — la partición se
      -- purgó, o el dato llegó fuera de la ventana de 7 días.
      sin_punto AS (
        UPDATE motor_cola c
        SET estado = 'fallido',
            error = 'El punto de telemetría referenciado no existe o quedó fuera de la ventana de 7 días.',
            tomado_at = null,
            tomado_por = null
        FROM candidatas
        WHERE c.id = candidatas.id
          AND c.id NOT IN (SELECT id FROM con_punto)
        RETURNING c.id
      )
      SELECT
        p.id::text           AS cola_id,
        p.telemetry_id::text AS telemetry_id,
        p.tenant_id::text    AS tenant_id,
        p.vehicle_id::text   AS vehicle_id,
        p.trip_id::text      AS trip_id,
        p.telemetry_ts       AS "timestamp",
        p.latitude,
        p.longitude,
        p.speed_kmh,
        p.ignition,
        p.temperature_c,
        p.provider_code,
        p.origen
      FROM con_punto p
      ORDER BY p.vehicle_id, p.telemetry_ts
    `;

    return filas.map((f) => ({
      cola_id: f.cola_id,
      telemetry_id: f.telemetry_id,
      tenant_id: f.tenant_id,
      vehicle_id: f.vehicle_id,
      trip_id: f.trip_id,
      timestamp: f.timestamp,
      latitude: Number(f.latitude),
      longitude: Number(f.longitude),
      speed_kmh: f.speed_kmh === null ? null : Number(f.speed_kmh),
      ignition: f.ignition ?? null,
      temperature_c: f.temperature_c === null ? null : Number(f.temperature_c),
      provider_code: f.provider_code ?? null,
      origen: f.origen === 'movil' ? 'movil' : 'hub',
    }));
  }

  /** Marca como procesados los puntos que salieron bien. */
  async marcarListos(colaIds: string[]): Promise<void> {
    if (colaIds.length === 0) return;
    await this.prisma.$executeRaw`
      UPDATE motor_cola
      SET estado = 'listo', error = null
      WHERE id = ANY(${colaIds.map((id) => BigInt(id))}::bigint[])
    `;
  }

  /**
   * Devuelve un punto a la cola, o lo da por fallido si agotó los intentos.
   *
   * ⚠️ Los fallidos NO se borran: quedan en la tabla con su error. Un fallo
   * sistemático tiene que ser diagnosticable, no invisible.
   */
  async marcarFallido(colaId: string, mensaje: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE motor_cola
      SET estado = CASE WHEN intentos >= ${INTENTOS_MAXIMOS} THEN 'fallido' ELSE 'pendiente' END,
          error = ${mensaje.slice(0, 2000)},
          tomado_at = null,
          tomado_por = null
      WHERE id = ${BigInt(colaId)}::bigint
    `;
  }

  /**
   * Devuelve a la cola las filas cuyo worker murió a mitad.
   *
   * Sin esto, un reinicio del proceso deja filas trabadas en 'procesando'
   * para siempre y nadie las vuelve a mirar.
   */
  async recuperarHuerfanas(): Promise<number> {
    const vencidas = await this.prisma.$executeRaw`
      UPDATE motor_cola
      SET estado = 'pendiente', tomado_at = null, tomado_por = null
      WHERE estado = 'procesando'
        AND tomado_at < now() - (${ARRENDAMIENTO_MINUTOS} || ' minutes')::interval
    `;
    if (vencidas > 0) {
      this.logger.warn(
        `Se devolvieron ${vencidas} filas a la cola: su arrendamiento venció (worker caído a mitad).`,
      );
    }
    return vencidas;
  }

  /** Estado de la cola, para el monitor y para decidir si hay atraso. */
  /**
   * Estado de la cola. `tenantId` acota el conteo; `null` devuelve la vista
   * global y SÓLO la usa un administrador de plataforma.
   *
   * Antes no recibía nada y contaba `motor_cola` entera: el monitor de un
   * cliente mostraba la cola de todos, que además es una señal de cuánta
   * actividad tienen los demás. `motor_cola.tenant_id` existe y es `not null`,
   * así que filtrar no cuesta nada.
   */
  async salud(tenantId: string | null): Promise<SaludCola> {
    const filas: { estado: string; cantidad: number; antiguedad: number | null; mas_viejo: Date | null }[] =
      await this.prisma.$queryRaw<{ estado: string; cantidad: number; antiguedad: number | null; mas_viejo: Date | null }[]>`
        SELECT estado,
               count(*)::int AS cantidad,
               extract(epoch from (now() - min(created_at)))::int AS antiguedad,
               min(created_at) AS mas_viejo
        FROM motor_cola
        WHERE (${tenantId}::uuid IS NULL OR tenant_id = ${tenantId}::uuid)
        GROUP BY estado
      `;

    const buscar = (e: string) => filas.find((f) => f.estado === e);
    const pendiente = buscar('pendiente');

    return {
      pendientes: Number(pendiente?.cantidad ?? 0),
      procesando: Number(buscar('procesando')?.cantidad ?? 0),
      fallidos: Number(buscar('fallido')?.cantidad ?? 0),
      antiguedad_segundos: pendiente?.antiguedad == null ? null : Number(pendiente.antiguedad),
      pendiente_mas_viejo: pendiente?.mas_viejo ?? null,
    };
  }
}
