import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { requireTenantId } from '../tenant/tenant-scope';
import {
  clasificarFrescura,
  getLivePositionsSource,
  getLivePositionsWindowHours,
  TOLERANCIA_RELOJ_MINUTOS,
  type Frescura,
} from '../config/live-positions';

/** Posición en vivo tal como la consume la UI. */
export interface PosicionEnVivo {
  vehicle_id: string;
  plate: string | null;
  alias: string | null;
  timestamp: Date;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  heading_degrees: number | null;
  ignition: boolean | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  event_type: string | null;
  provider_code: string | null;
  /** Antigüedad del punto en segundos, al momento de la consulta. */
  age_seconds: number;
  /** Etiqueta derivada de la antigüedad: en_vivo | inactivo | sin_senal. */
  freshness: Frescura;
  /** De dónde salió el dato. Útil para diagnosticar en producción. */
  source: 'postgres' | 'redis';
}

/** Fila cruda que devuelve la consulta SQL. */
interface FilaPosicion {
  vehicle_id: string;
  plate: string | null;
  alias: string | null;
  timestamp: Date;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  heading_degrees: number | null;
  ignition: boolean | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  event_type: string | null;
  provider_code: string | null;
  age_seconds: number;
}

/**
 * Fuente única de posiciones en vivo para toda la aplicación.
 *
 * Existe como servicio propio (y no dentro de VehiclesService) porque tiene
 * más de un consumidor —el mapa y el tablero de sensores— y ambos tenían el
 * mismo defecto por separado. Un solo lugar que resuelva "¿dónde está cada
 * vehículo ahora?" evita que la próxima corrección haya que hacerla dos veces.
 *
 * Contrato: Postgres es la fuente de verdad. Redis, cuando está habilitado, es
 * sólo una capa de aceleración de la que se puede prescindir en cualquier
 * momento sin que el mapa se quede sin datos.
 */
@Injectable()
export class LivePositionsService {
  private readonly logger = new Logger(LivePositionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Últimas posiciones conocidas de los vehículos del tenant.
   *
   * @param tenantId Tenant del usuario autenticado. Obligatorio: sin él la
   *                 consulta devolvería vehículos de otros clientes.
   */
  async obtenerPorTenant(tenantId: string): Promise<PosicionEnVivo[]> {
    const tenant = requireTenantId(tenantId, 'LivePositionsService.obtenerPorTenant');
    const source = getLivePositionsSource();

    if (source === 'redis') {
      const desdeCache = await this.intentarDesdeRedis(tenant);
      if (desdeCache !== null) return desdeCache;
      // Fail-open: cualquier problema con la caché cae a la fuente de verdad.
      // El mapa nunca se queda vacío por un incidente de Redis.
    }

    const filas = await this.consultarPostgres(tenant);
    return filas.map((f) => this.mapear(f, 'postgres'));
  }

  /**
   * Última posición conocida de un vehículo puntual.
   *
   * El `tenantId` es obligatorio también acá: este método se llama desde el
   * detalle de vehículo, cuyo id llega por parámetro de la URL.
   */
  async obtenerPorVehiculo(vehicleId: string, tenantId: string): Promise<PosicionEnVivo | null> {
    const tenant = requireTenantId(tenantId, 'LivePositionsService.obtenerPorVehiculo');
    const filas = await this.consultarPostgres(tenant, vehicleId);
    if (filas.length === 0) return null;
    return this.mapear(filas[0], 'postgres');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Postgres — fuente de verdad
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * `DISTINCT ON (vehicle_id)` ordenado por timestamp descendente: es la forma
   * natural en Postgres de traer "la última fila por grupo", y aprovecha el
   * índice existente `idx_telemetry_vehicle_time (vehicle_id, timestamp desc)`.
   *
   * El rango temporal es **cerrado** (`>= desde AND <= hasta`) y ambos extremos
   * se calculan en JS como constantes.
   *
   * ⚠️ Los dos extremos son necesarios, no sólo el inferior. Con un `>=` abierto
   * Postgres no puede descartar las particiones **futuras** (cualquiera de ellas
   * podría contener filas que cumplan la condición) ni la partición `default`,
   * así que el plan termina recorriendo las 30 particiones existentes. Medido
   * en la base real: 15,6 ms de planificación contra 1,3 ms de ejecución, con
   * 5.481 buffers gastados sólo en planificar.
   *
   * Con el rango cerrado y contenido dentro de los límites de una partición,
   * Postgres poda en **tiempo de planificación** y toca sólo la del mes en
   * curso (dos, si la ventana cruza el cambio de mes).
   *
   * SQL parametrizado con la forma tagged-template de `$queryRaw`: nada se
   * concatena, ni siquiera la ventana temporal.
   */
  private async consultarPostgres(tenantId: string, vehicleId?: string): Promise<FilaPosicion[]> {
    const horas = getLivePositionsWindowHours();
    const ahora = Date.now();
    const desde = new Date(ahora - horas * 60 * 60 * 1000);
    // El extremo superior lleva una tolerancia de reloj: los timestamps los
    // genera el dispositivo del conductor, y un teléfono adelantado unos
    // minutos dejaría su último punto fuera del rango. La tolerancia es chica,
    // así que el rango sigue cayendo dentro de la partición del mes en curso.
    const hasta = new Date(ahora + TOLERANCIA_RELOJ_MINUTOS * 60 * 1000);

    if (vehicleId) {
      return this.prisma.$queryRaw<FilaPosicion[]>`
        SELECT
          t.vehicle_id,
          v.plate,
          v.alias,
          t."timestamp",
          t.latitude,
          t.longitude,
          t.speed_kmh,
          t.heading_degrees,
          t.ignition,
          t.temperature_c,
          t.humidity_pct,
          t.event_type,
          t.provider_code,
          EXTRACT(EPOCH FROM (NOW() - t."timestamp"))::int AS age_seconds
        FROM telemetry t
        JOIN vehicles v ON v.id = t.vehicle_id AND v.tenant_id = t.tenant_id
        WHERE t.tenant_id = ${tenantId}::uuid
          AND t.vehicle_id = ${vehicleId}::uuid
          AND t."timestamp" >= ${desde}
          AND t."timestamp" <= ${hasta}
          AND t.is_duplicate = false
        ORDER BY t."timestamp" DESC
        LIMIT 1
      `;
    }

    return this.prisma.$queryRaw<FilaPosicion[]>`
      SELECT DISTINCT ON (t.vehicle_id)
        t.vehicle_id,
        v.plate,
        v.alias,
        t."timestamp",
        t.latitude,
        t.longitude,
        t.speed_kmh,
        t.heading_degrees,
        t.ignition,
        t.temperature_c,
        t.humidity_pct,
        t.event_type,
        t.provider_code,
        EXTRACT(EPOCH FROM (NOW() - t."timestamp"))::int AS age_seconds
      FROM telemetry t
      JOIN vehicles v ON v.id = t.vehicle_id AND v.tenant_id = t.tenant_id
      WHERE t.tenant_id = ${tenantId}::uuid
        AND t."timestamp" >= ${desde}
        AND t."timestamp" <= ${hasta}
        AND t.is_duplicate = false
      ORDER BY t.vehicle_id, t."timestamp" DESC
    `;
  }

  private mapear(fila: FilaPosicion, source: 'postgres' | 'redis'): PosicionEnVivo {
    const antiguedad = Number(fila.age_seconds ?? 0);
    return {
      vehicle_id: fila.vehicle_id,
      plate: fila.plate ?? null,
      alias: fila.alias ?? null,
      timestamp: fila.timestamp,
      latitude: Number(fila.latitude),
      longitude: Number(fila.longitude),
      speed_kmh: fila.speed_kmh === null ? null : Number(fila.speed_kmh),
      heading_degrees: fila.heading_degrees === null ? null : Number(fila.heading_degrees),
      ignition: fila.ignition ?? null,
      temperature_c: fila.temperature_c === null ? null : Number(fila.temperature_c),
      humidity_pct: fila.humidity_pct === null ? null : Number(fila.humidity_pct),
      event_type: fila.event_type ?? null,
      provider_code: fila.provider_code ?? null,
      age_seconds: antiguedad,
      freshness: clasificarFrescura(antiguedad),
      source,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Redis — optimización opcional (LIVE_POSITIONS_SOURCE=redis)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Intenta resolver desde la caché. Devuelve `null` para indicar "no pude,
   * seguí con Postgres" — nunca lanza y nunca devuelve un resultado parcial.
   *
   * ⚠️ ANTES DE ACTIVAR `LIVE_POSITIONS_SOURCE=redis`, LEER ESTO:
   *
   * Hoy la caché `vehicle:position:{vehicleId}` la escribe **únicamente** el
   * ingest de NestJS. La Mobile API (Next.js/Vercel) escribe directo a la tabla
   * `telemetry` sin tocar Redis, así que los vehículos rastreados desde la app
   * del conductor NO están en la caché. Activar este modo sin que la Mobile API
   * escriba también en Redis haría que esos vehículos dependan del fallback en
   * cada request: más lento que ir directo a Postgres, no más rápido.
   *
   * La pieza que falta —que la Mobile API mantenga la caché— es una tanda
   * futura y coordinada entre los dos backends. Hasta entonces, el modo `redis`
   * sólo tiene sentido si toda la flota reporta vía el HUB.
   */
  private async intentarDesdeRedis(tenantId: string): Promise<PosicionEnVivo[] | null> {
    if (!this.redis.isConfigured()) {
      this.logger.warn(
        'LIVE_POSITIONS_SOURCE=redis pero Redis no está configurado. Se responde desde Postgres.',
      );
      return null;
    }

    try {
      const vehiculos = await this.prisma.vehicle.findMany({
        where: { tenant_id: tenantId },
        select: { id: true, plate: true, alias: true },
      });

      if (vehiculos.length === 0) return [];

      // Se leen sólo las claves de los vehículos del tenant (nunca KEYS/SCAN):
      // el aislamiento queda garantizado por construcción.
      const claves = vehiculos.map((v: { id: string }) => `vehicle:position:${v.id}`);
      const valores = await this.redis.getClient().mget(...claves);

      const posiciones: PosicionEnVivo[] = [];
      let incompletas = 0;

      valores.forEach((raw, i) => {
        if (!raw) {
          incompletas++;
          return;
        }
        try {
          const dato = JSON.parse(raw);
          const ts = dato.timestamp ? new Date(dato.timestamp) : null;
          if (!ts || Number.isNaN(ts.getTime()) || dato.latitude == null || dato.longitude == null) {
            incompletas++;
            return;
          }
          const antiguedad = Math.max(0, Math.round((Date.now() - ts.getTime()) / 1000));
          posiciones.push({
            vehicle_id: vehiculos[i].id,
            plate: vehiculos[i].plate ?? null,
            alias: vehiculos[i].alias ?? null,
            timestamp: ts,
            latitude: Number(dato.latitude),
            longitude: Number(dato.longitude),
            speed_kmh: dato.speed_kmh ?? null,
            heading_degrees: dato.heading_degrees ?? null,
            ignition: dato.ignition ?? null,
            temperature_c: dato.temperature_c ?? null,
            humidity_pct: dato.humidity_pct ?? null,
            event_type: dato.event_type ?? null,
            provider_code: dato.provider_code ?? null,
            age_seconds: antiguedad,
            freshness: clasificarFrescura(antiguedad),
            source: 'redis',
          });
        } catch {
          incompletas++;
        }
      });

      // Si a la caché le falta alguna posición (clave vencida, valor corrupto o
      // vehículo que reporta por la Mobile API), no se devuelve un mapa a
      // medias: se cae a Postgres, que siempre tiene la foto completa.
      if (incompletas > 0) {
        this.logger.debug(
          `Caché incompleta (${incompletas}/${vehiculos.length} sin dato válido). Se responde desde Postgres.`,
        );
        return null;
      }

      return posiciones;
    } catch (error) {
      // Fail-open, mismo criterio que el rate limit de la Mobile API: un fallo
      // de la caché degrada la performance, nunca la funcionalidad.
      this.logger.warn(
        `Fallo al leer posiciones de Redis, se responde desde Postgres: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
