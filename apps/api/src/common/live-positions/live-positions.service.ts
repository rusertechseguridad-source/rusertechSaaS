import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { requireTenantId } from '../tenant/tenant-scope';
import {
  MonitoringConfigService,
  type UmbralesMonitoreo,
} from '../monitoring/monitoring-config.service';
import {
  clasificarFrescura,
  getLivePositionsSource,
  TOLERANCIA_RELOJ_MINUTOS,
  type Frescura,
} from '../config/live-positions';

/** Origen del punto: quién lo escribió en `telemetry`. */
export type OrigenPosicion = 'movil' | 'hub';

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
  /** Si el vehículo reportó desde la app del conductor dentro de la ventana. */
  origen: OrigenPosicion;
  /** Si el vehículo tiene un viaje declarado EN_CURSO. */
  con_viaje_activo: boolean;
  /** De dónde salió el dato. Útil para diagnosticar en producción. */
  source: 'postgres' | 'redis';
}

/**
 * Resumen de la flota **dentro del alcance de monitoreo**.
 *
 * Se calcula en el backend y no en el mapa porque `sin_datos` no se puede
 * derivar de lo que llega: son justamente los vehículos que NO tienen posición.
 * Contarlos en el frontend obligaba a restar contra el listado completo de
 * vehículos, que incluye a los que están fuera de alcance — y el número quedaba
 * inflado de forma permanente.
 */
export interface ResumenMonitoreo {
  en_vivo: number;
  inactivo: number;
  sin_senal: number;
  /** Vehículos en alcance con posición dentro de la ventana. */
  con_posicion: number;
  /** Vehículos con viaje EN_CURSO y sin ningún punto en la ventana. */
  sin_datos: number;
  /** con_posicion + sin_datos. Es el denominador honesto del panel. */
  total_en_alcance: number;
}

/** Respuesta del mapa: posiciones ya acotadas al alcance, resumen y umbrales. */
export interface RespuestaMapa {
  positions: PosicionEnVivo[];
  summary: ResumenMonitoreo;
  /** Umbrales efectivos del tenant, para que la UI explique qué está mirando. */
  thresholds: UmbralesMonitoreo;
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
  tiene_origen_movil: boolean;
  con_viaje_activo: boolean;
}

/** Ventana temporal resuelta para un tenant. */
interface VentanaConsulta {
  desde: Date;
  hasta: Date;
  umbrales: UmbralesMonitoreo;
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
 *
 * Dos alcances distintos, a propósito:
 *  · `obtenerPorTenant` → **toda** la telemetría de la ventana. Lo usa el
 *    tablero de sensores, al que le interesa cualquier vehículo con lecturas.
 *  · `obtenerParaMapa`  → sólo lo que el mapa debe mostrar (ver más abajo).
 */
@Injectable()
export class LivePositionsService {
  private readonly logger = new Logger(LivePositionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly monitoringConfig: MonitoringConfigService,
  ) {}

  /**
   * Últimas posiciones conocidas de los vehículos del tenant, **sin filtrar por
   * alcance de monitoreo**.
   *
   * @param tenantId Tenant del usuario autenticado. Obligatorio: sin él la
   *                 consulta devolvería vehículos de otros clientes.
   */
  async obtenerPorTenant(tenantId: string): Promise<PosicionEnVivo[]> {
    const tenant = requireTenantId(tenantId, 'LivePositionsService.obtenerPorTenant');
    const ventana = await this.resolverVentana(tenant);

    if (getLivePositionsSource() === 'redis') {
      const desdeCache = await this.intentarDesdeRedis(tenant, ventana.umbrales);
      if (desdeCache !== null) return desdeCache;
      // Fail-open: cualquier problema con la caché cae a la fuente de verdad.
      // El mapa nunca se queda vacío por un incidente de Redis.
    }

    const filas = await this.consultarPostgres(tenant, ventana);
    return filas.map((f) => this.mapear(f, 'postgres', ventana.umbrales));
  }

  /**
   * Posiciones que **corresponden al mapa de monitoreo**, con su resumen.
   *
   * ALCANCE (decisión operativa, no técnica): el mapa es la pantalla de
   * seguimiento activo, no un inventario de la flota. Entra al mapa un vehículo
   * que cumpla alguna de estas dos condiciones:
   *
   *  1. Reportó desde la **app del conductor** dentro de la ventana. La app se
   *     enciende deliberadamente, con o sin viaje declarado (Tracking Libre):
   *     que alguien la haya activado ya es la declaración de que ese vehículo
   *     se está monitoreando.
   *  2. Tiene un **viaje declarado EN_CURSO**, sin importar por dónde reporte.
   *
   * Queda fuera el vehículo que sólo emite por el HUB/AVL y no tiene viaje: su
   * equipo transmite de forma permanente por estar instalado, no porque alguien
   * esté siguiendo esa unidad. Incluirlos llena el mapa de puntos que nadie
   * está mirando y esconde los que sí importan.
   *
   * El filtro va en la consulta y no en el frontend: traer posiciones que
   * después se descartan es trabajo que crece con el tamaño de la flota.
   *
   * ⚠️ Este método siempre lee de Postgres, incluso con
   * `LIVE_POSITIONS_SOURCE=redis`: el alcance depende de un join con `trips` y
   * de saber si hubo puntos de la app en la ventana, y la caché no conoce
   * ninguna de las dos cosas.
   */
  async obtenerParaMapa(tenantId: string): Promise<RespuestaMapa> {
    const tenant = requireTenantId(tenantId, 'LivePositionsService.obtenerParaMapa');
    const ventana = await this.resolverVentana(tenant);

    const filas = await this.consultarPostgres(tenant, ventana);
    const enAlcance = filas.filter((f) => f.tiene_origen_movil || f.con_viaje_activo);
    const positions = enAlcance.map((f) => this.mapear(f, 'postgres', ventana.umbrales));

    const sinDatos = await this.contarEnViajeSinDatos(tenant, ventana);

    const summary: ResumenMonitoreo = {
      en_vivo: positions.filter((p) => p.freshness === 'en_vivo').length,
      inactivo: positions.filter((p) => p.freshness === 'inactivo').length,
      sin_senal: positions.filter((p) => p.freshness === 'sin_senal').length,
      con_posicion: positions.length,
      sin_datos: sinDatos,
      total_en_alcance: positions.length + sinDatos,
    };

    return { positions, summary, thresholds: ventana.umbrales };
  }

  /**
   * Última posición conocida de un vehículo puntual.
   *
   * No aplica el filtro de alcance: si alguien abre el detalle de un vehículo,
   * quiere ver su última posición aunque no esté en el mapa.
   *
   * El `tenantId` es obligatorio también acá: este método se llama desde el
   * detalle de vehículo, cuyo id llega por parámetro de la URL.
   */
  async obtenerPorVehiculo(vehicleId: string, tenantId: string): Promise<PosicionEnVivo | null> {
    const tenant = requireTenantId(tenantId, 'LivePositionsService.obtenerPorVehiculo');
    const ventana = await this.resolverVentana(tenant);
    const filas = await this.consultarPostgres(tenant, ventana, vehicleId);
    if (filas.length === 0) return null;
    return this.mapear(filas[0], 'postgres', ventana.umbrales);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Ventana temporal
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resuelve la ventana de consulta y los umbrales del tenant.
   *
   * `ventana_mapa_horas` sale de `tenant_monitoring_config`; si el tenant no
   * tiene fila (o la tabla todavía no existe) se usan los valores por defecto.
   * La configuración no puede ser un requisito para que el mapa funcione.
   */
  private async resolverVentana(tenantId: string): Promise<VentanaConsulta> {
    const umbrales = await this.monitoringConfig.obtenerUmbrales(tenantId);
    const ahora = Date.now();
    return {
      desde: new Date(ahora - umbrales.ventana_mapa_horas * 60 * 60 * 1000),
      // El extremo superior lleva una tolerancia de reloj: los timestamps los
      // genera el dispositivo del conductor, y un teléfono adelantado unos
      // minutos dejaría su último punto fuera del rango.
      hasta: new Date(ahora + TOLERANCIA_RELOJ_MINUTOS * 60 * 1000),
      umbrales,
    };
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
   * curso (dos, si la ventana cruza el cambio de mes). Por eso
   * `ventana_mapa_horas` está acotada a 168 h en la base y en el servicio.
   *
   * `tiene_origen_movil` se calcula con `bool_or(...) OVER (PARTITION BY ...)`,
   * que Postgres evalúa **antes** del `DISTINCT ON`: la bandera mira todos los
   * puntos del vehículo en la ventana, no sólo el último. Es a propósito — un
   * vehículo que alterna puntos de la app y del HUB no debe entrar y salir del
   * mapa según cuál llegó último.
   *
   * Se usa `jsonb_exists(payload, clave)` y no el operador `?` equivalente: el
   * `?` suelto dentro de una consulta cruda es ambiguo para los drivers que lo
   * tratan como marcador de parámetro. La función hace exactamente lo mismo y
   * no depende de cómo el driver interprete el signo.
   *
   * SQL parametrizado con la forma tagged-template de `$queryRaw`: nada se
   * concatena, ni siquiera la ventana temporal.
   */
  private async consultarPostgres(
    tenantId: string,
    ventana: VentanaConsulta,
    vehicleId?: string,
  ): Promise<FilaPosicion[]> {
    const { desde, hasta } = ventana;

    if (vehicleId) {
      return this.prisma.$queryRaw<FilaPosicion[]>`
        WITH viajes_activos AS (
          SELECT DISTINCT vehicle_id
          FROM trips
          WHERE tenant_id = ${tenantId}::uuid
            AND status = 'EN_CURSO'
            AND vehicle_id IS NOT NULL
        ),
        ultimas AS (
          SELECT DISTINCT ON (t.vehicle_id)
            t.vehicle_id,
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
            EXTRACT(EPOCH FROM (NOW() - t."timestamp"))::int AS age_seconds,
            bool_or(jsonb_exists(t.raw_payload, 'MobileCode')) OVER (PARTITION BY t.vehicle_id) AS tiene_origen_movil
          FROM telemetry t
          WHERE t.tenant_id = ${tenantId}::uuid
            AND t.vehicle_id = ${vehicleId}::uuid
            AND t."timestamp" >= ${desde}
            AND t."timestamp" <= ${hasta}
            AND t.is_duplicate = false
          ORDER BY t.vehicle_id, t."timestamp" DESC
        )
        SELECT
          u.*,
          v.plate,
          v.alias,
          (va.vehicle_id IS NOT NULL) AS con_viaje_activo
        FROM ultimas u
        JOIN vehicles v ON v.id = u.vehicle_id AND v.tenant_id = ${tenantId}::uuid
        LEFT JOIN viajes_activos va ON va.vehicle_id = u.vehicle_id
      `;
    }

    return this.prisma.$queryRaw<FilaPosicion[]>`
      WITH viajes_activos AS (
        SELECT DISTINCT vehicle_id
        FROM trips
        WHERE tenant_id = ${tenantId}::uuid
          AND status = 'EN_CURSO'
          AND vehicle_id IS NOT NULL
      ),
      ultimas AS (
        SELECT DISTINCT ON (t.vehicle_id)
          t.vehicle_id,
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
          EXTRACT(EPOCH FROM (NOW() - t."timestamp"))::int AS age_seconds,
          bool_or(jsonb_exists(t.raw_payload, 'MobileCode')) OVER (PARTITION BY t.vehicle_id) AS tiene_origen_movil
        FROM telemetry t
        WHERE t.tenant_id = ${tenantId}::uuid
          AND t."timestamp" >= ${desde}
          AND t."timestamp" <= ${hasta}
          AND t.is_duplicate = false
        ORDER BY t.vehicle_id, t."timestamp" DESC
      )
      SELECT
        u.*,
        v.plate,
        v.alias,
        (va.vehicle_id IS NOT NULL) AS con_viaje_activo
      FROM ultimas u
      JOIN vehicles v ON v.id = u.vehicle_id AND v.tenant_id = ${tenantId}::uuid
      LEFT JOIN viajes_activos va ON va.vehicle_id = u.vehicle_id
    `;
  }

  /**
   * Vehículos con viaje EN_CURSO que no tienen **ningún** punto en la ventana.
   *
   * Es el número que le importa al operador: "hay un viaje declarado corriendo
   * y ese vehículo no está reportando". Se cuenta contra `trips` y no contra el
   * listado de vehículos para respetar el mismo alcance que el mapa.
   *
   * Se excluyen los vehículos dados de baja: no reportan porque están fuera de
   * servicio, no porque haya un problema que atender.
   */
  private async contarEnViajeSinDatos(tenantId: string, ventana: VentanaConsulta): Promise<number> {
    const { desde, hasta } = ventana;

    const filas = await this.prisma.$queryRaw<{ sin_datos: number }[]>`
      SELECT COUNT(DISTINCT tr.vehicle_id)::int AS sin_datos
      FROM trips tr
      JOIN vehicles v ON v.id = tr.vehicle_id AND v.tenant_id = tr.tenant_id
      WHERE tr.tenant_id = ${tenantId}::uuid
        AND tr.status = 'EN_CURSO'
        AND tr.vehicle_id IS NOT NULL
        AND v.status <> 'inactive'
        AND NOT EXISTS (
          SELECT 1
          FROM telemetry t
          WHERE t.tenant_id = tr.tenant_id
            AND t.vehicle_id = tr.vehicle_id
            AND t."timestamp" >= ${desde}
            AND t."timestamp" <= ${hasta}
            AND t.is_duplicate = false
        )
    `;

    return Number(filas[0]?.sin_datos ?? 0);
  }

  private mapear(
    fila: FilaPosicion,
    source: 'postgres' | 'redis',
    umbrales: UmbralesMonitoreo,
  ): PosicionEnVivo {
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
      freshness: clasificarFrescura(
        antiguedad,
        umbrales.umbral_en_vivo_minutos,
        umbrales.umbral_inactivo_minutos,
      ),
      origen: fila.tiene_origen_movil ? 'movil' : 'hub',
      con_viaje_activo: Boolean(fila.con_viaje_activo),
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
   * Además, la caché no puede responder el alcance del mapa (necesita `trips` y
   * el origen de los puntos), así que `obtenerParaMapa` nunca pasa por acá.
   *
   * La pieza que falta —que la Mobile API mantenga la caché— es una tanda
   * futura y coordinada entre los dos backends.
   */
  private async intentarDesdeRedis(
    tenantId: string,
    umbrales: UmbralesMonitoreo,
  ): Promise<PosicionEnVivo[] | null> {
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
            freshness: clasificarFrescura(
              antiguedad,
              umbrales.umbral_en_vivo_minutos,
              umbrales.umbral_inactivo_minutos,
            ),
            // La caché no guarda el payload crudo ni conoce los viajes: se
            // informa lo conservador en lugar de inventar una bandera.
            origen: 'hub',
            con_viaje_activo: false,
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
