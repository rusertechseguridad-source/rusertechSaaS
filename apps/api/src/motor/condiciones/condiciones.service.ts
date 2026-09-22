import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DespachoService } from '../../notifications/despacho/despacho.service';
import type { PuntoEvaluable } from '../tipos';
import { claveDeIdentidad, type DecisionCondicion } from './tipos-condiciones';
import { evaluarSinReporte, type ContextoSinReporte } from './sin-reporte.evaluator';
import type { ContextoParada } from './paradas.evaluator';
import type { ContextoDesvio } from './desvio.evaluator';
// ⚠️ El default vive en UN solo lugar y una prueba lo compara contra el DEFAULT
// de la columna en `prisma/migrations/031_etapa3b_condiciones.sql`. Es la
// lección de la tolerancia del recorrido: un comentario que dice «tiene que
// coincidir» no impide que se separen; una prueba que falla, sí.
import { UMBRAL_SIN_REPORTE_POR_DEFECTO } from './umbrales-condiciones';

/**
 * LAS CONDICIONES — la capa que toca la base.
 *
 * Los evaluadores deciden; acá se lee el contexto, se persiste el resultado, y
 * nada más. Es la separación que permite probar las reglas sin Postgres.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * LO QUE ESTA CAPA APORTA Y NO ES OBVIO
 * ══════════════════════════════════════════════════════════════════════════
 *
 * **El contexto es geoespacial y por eso vive acá.** «¿Está en una ubicación
 * habilitada?» y «¿a qué distancia está de la ruta?» son consultas PostGIS. Los
 * evaluadores reciben las respuestas, no las preguntas.
 *
 * **La idempotencia también.** `INSERT … WHERE NOT EXISTS` sobre la clave de
 * identidad: 240 puntos de la misma parada producen la misma clave y sólo el
 * primero escribe.
 */
@Injectable()
export class CondicionesService {
  private readonly logger = new Logger(CondicionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    /**
     * ⚠️ EL MOTOR NO SABE QUIÉN SE ENTERA. Recibe el punto de despacho y le
     * entrega lo que escribió; a quién le llega —campana hoy, Telegram y
     * correo en las entregas 2 y 3— se decide del otro lado. Es lo que
     * permite agregar un mensajero sin abrir este archivo.
     */
    private readonly despacho: DespachoService,
  ) {}

  // ════════════════════════════════════════════════════════════════════════
  // CONTEXTO — lo que los evaluadores no pueden preguntar solos
  // ════════════════════════════════════════════════════════════════════════

  /**
   * ¿El punto cae dentro de una ubicación habilitada para parar?
   *
   * ⚠️ `is_authorized_stop` es la columna que convierte esto en custodia. Sin
   * ella, toda parada de más del umbral abre condición y el producto es un
   * cronómetro. Medido contra la base: la columna existe y es NOT NULL.
   *
   * El radio sale de la propia ubicación (`radius_meters`), no de una constante:
   * un playón de camiones y una oficina no tienen el mismo tamaño.
   */
  async paradaAutorizadaEn(
    tenantId: string,
    latitud: number,
    longitud: number,
  ): Promise<{ autorizada: boolean; nombre: string | null }> {
    const filas = await this.prisma.$queryRaw<{ name: string }[]>`
      SELECT sl.name
      FROM saved_locations sl
      WHERE sl.tenant_id = ${tenantId}::uuid
        AND sl.is_active
        AND sl.is_authorized_stop
        AND ST_DWithin(
              sl.geometry,
              ST_SetSRID(ST_MakePoint(${longitud}::float8, ${latitud}::float8), 4326)::geography,
              sl.radius_meters
            )
      ORDER BY sl.radius_meters ASC
      LIMIT 1
    `;
    if (filas.length === 0) return { autorizada: false, nombre: null };
    return { autorizada: true, nombre: filas[0].name };
  }

  /**
   * Distancia del punto a la ruta planificada del viaje, y el corredor.
   *
   * ⚠️ EL CORREDOR ES `trips.corridor_meters`, NO `recorrido_tolerancia_m`.
   * Esa otra es la tolerancia de simplificación del recorrido guardado (0-50 m,
   * default 2). Con dos metros de corredor, todo punto sería un desvío.
   *
   * La ruta se busca en dos lugares porque hay dos caminos de alta: el viaje
   * puede apuntar a una `routes` con su geometría, o traer su propio
   * `planned_route_geojson`. Si no hay ninguna, devuelve `null` — y `null`
   * significa «no hay contra qué medir», que NO es lo mismo que cero.
   */
  async distanciaALaRuta(
    tripId: string,
    tenantId: string,
    latitud: number,
    longitud: number,
  ): Promise<{ distancia_m: number | null; corredor_m: number }> {
    const filas = await this.prisma.$queryRaw<
      { distancia_m: number | null; corredor_m: number }[]
    >`
      SELECT
        ST_Distance(
          coalesce(
            r.geometry,
            CASE WHEN t.planned_route_geojson IS NOT NULL
                 THEN ST_SetSRID(ST_GeomFromGeoJSON(t.planned_route_geojson::text), 4326)::geography
            END
          ),
          ST_SetSRID(ST_MakePoint(${longitud}::float8, ${latitud}::float8), 4326)::geography
        )::float8                                    AS distancia_m,
        coalesce(t.corridor_meters, r.corridor_meters, 500)::int AS corredor_m
      FROM trips t
      LEFT JOIN routes r ON r.id = t.route_id AND r.tenant_id = t.tenant_id
      WHERE t.id = ${tripId}::uuid AND t.tenant_id = ${tenantId}::uuid
    `;
    if (filas.length === 0) return { distancia_m: null, corredor_m: 500 };
    const f = filas[0];
    return {
      distancia_m: f.distancia_m === null ? null : Number(f.distancia_m),
      corredor_m: Number(f.corredor_m),
    };
  }

  /**
   * ¿El último punto conocido cayó en una zona donde perder señal es normal?
   *
   * ⚠️ Sin esto, todo cliente con una ruta de montaña recibe alertas falsas
   * todos los días y deja de mirarlas. `no_signal_zones.expected_loss_minutes`
   * existe desde antes de este motor — verificado contra la base: `int4`,
   * nullable.
   *
   * `tenant_id` es NULLABLE en esa tabla a propósito: hay zonas globales (un
   * túnel es un túnel para todos). Por eso el filtro admite las dos.
   */
  async zonaSinSenalEn(
    tenantId: string,
    latitud: number,
    longitud: number,
  ): Promise<{ minutos: number | null; nombre: string | null }> {
    const filas = await this.prisma.$queryRaw<
      { expected_loss_minutes: number | null; name: string }[]
    >`
      SELECT z.expected_loss_minutes, z.name
      FROM no_signal_zones z
      WHERE (z.tenant_id = ${tenantId}::uuid OR z.tenant_id IS NULL)
        AND z.is_active
        AND ST_Intersects(
              z.geometry,
              ST_SetSRID(ST_MakePoint(${longitud}::float8, ${latitud}::float8), 4326)::geography
            )
      ORDER BY z.expected_loss_minutes DESC NULLS LAST
      LIMIT 1
    `;
    if (filas.length === 0) return { minutos: null, nombre: null };
    const f = filas[0];
    return {
      minutos: f.expected_loss_minutes === null ? null : Number(f.expected_loss_minutes),
      nombre: f.name,
    };
  }

  /** Qué condiciones tiene abiertas un vehículo, con desde cuándo. */
  async abiertasDe(
    tenantId: string,
    vehicleId: string,
  ): Promise<Map<string, Date>> {
    const filas = await this.prisma.$queryRaw<{ tipo: string; inicio: Date }[]>`
      SELECT tipo, inicio
      FROM trip_conditions
      WHERE tenant_id = ${tenantId}::uuid
        AND vehicle_id = ${vehicleId}::uuid
        AND fin IS NULL
    `;
    return new Map(filas.map((f) => [f.tipo, f.inicio]));
  }

  // ════════════════════════════════════════════════════════════════════════
  // ESCRITURA
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Aplica las decisiones de los evaluadores.
   *
   * ⚠️ LA IDEMPOTENCIA VIVE EN EL `WHERE NOT EXISTS`, NO EN UN `ON CONFLICT`.
   *
   * `ON CONFLICT` necesita apuntar a un índice único CONCRETO, y desde esta
   * sesión no se podían leer los índices de `trip_conditions`. Un `ON CONFLICT`
   * contra un índice que no existe falla en ejecución, no en compilación — o
   * sea, en producción, con la suite entera en verde.
   *
   * ⚠️ Después se leyeron. El único índice sobre la clave es
   * `uq_trip_conditions_identidad`, UNIQUE sobre `clave_identidad` SOLA. Si
   * este método hubiera apuntado un `ON CONFLICT` al par
   * `tenant_id` + `clave_identidad` —la forma que parecía natural, porque el
   * WHERE filtra por las dos— habría roto en producción.
   *
   * (El par va nombrado en prosa y no en su forma ejecutable a propósito: el
   * aserto del ZIP comprueba que esa forma NO aparezca en este archivo, y
   * escribirla acá para explicar por qué no se usa haría fallar la
   * comprobación de que no se usa. Undécima vez en la serie.) La prudencia acertó por la razón correcta y conviene
   * dejarla escrita: no se apunta a un índice que no se midió.
   *
   * `WHERE NOT EXISTS` funciona con índice o sin él. La ventana de carrera
   * entre dos workers simultáneos la cierra ese índice único, que ya estaba
   * puesto antes de esta etapa; la corrección de este método no depende de eso.
   */
  async aplicar(decisiones: DecisionCondicion[]): Promise<number> {
    const abiertas: string[] = [];
    const cerradas: { id: string; motivo: string }[] = [];

    for (const d of decisiones) {
      if (d.accion === 'abrir') {
        abiertas.push(...(await this.abrir(d)));
      } else {
        cerradas.push(...(await this.cerrar(d)).map((id) => ({ id, motivo: d.disparador })));
      }
    }

    // ⚠️ EL DESPACHO VA DESPUÉS DE ESCRIBIR, Y CON LOS IDS QUE EL INSERT
    // DEVOLVIÓ. Las dos cosas importan:
    //
    //   · después, porque el aviso tiene que describir un hecho que ya existe
    //     en la base. Si el INSERT fallara después de avisar, el operador
    //     tendría en pantalla una alerta que no está en ningún lado.
    //   · con los ids devueltos, porque el `WHERE NOT EXISTS` de `abrir` es lo
    //     que hace que 240 puntos de un camión parado sean UNA condición. Si
    //     se despacharan las DECISIONES en vez de las filas escritas, la
    //     campana sonaría 240 veces por el mismo camión quieto y el operador
    //     la apagaría para siempre. La idempotencia se hereda; no se rehace.
    await this.despacho.despacharCondiciones(abiertas);
    for (const c of cerradas) {
      await this.despacho.despacharResolucion({
        fuente: 'condicion',
        id: c.id,
        tenant_id: decisiones[0]?.tenant_id ?? '',
        resuelta_at: new Date(),
        motivo: c.motivo,
      });
    }

    return abiertas.length + cerradas.length;
  }

  /**
   * Inserta y devuelve LOS IDS QUE CREÓ — cero si la clave ya existía.
   *
   * ⚠️ Devolvía un contador. Ahora devuelve los ids porque el despacho de
   * avisos necesita saber QUÉ se escribió, no cuánto: con el contador habría
   * que volver a buscar las filas por la clave, y entre el INSERT y esa
   * búsqueda otra evaluación podría agregar otra. El `RETURNING` no tiene esa
   * ventana.
   */
  private async abrir(d: DecisionCondicion): Promise<string[]> {
    const clave = claveDeIdentidad(d);
    const filas = await this.prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO trip_conditions (
        tenant_id, vehicle_id, trip_id, tipo, nivel_riesgo,
        inicio, origen, disparador, datos, clave_identidad
      )
      SELECT
        ${d.tenant_id}::uuid, ${d.vehicle_id}::uuid, ${d.trip_id}::uuid,
        ${d.tipo},
        -- El riesgo NO se escribe: sale del catálogo. Si mañana se decide que
        -- una parada no autorizada es crítica, se cambia en una fila y todas
        -- las condiciones nuevas la respetan sin tocar código.
        mt.riesgo_default,
        ${d.inicio}, 'motor', ${d.disparador}, ${JSON.stringify(d.datos)}::jsonb,
        ${clave}
      FROM motor_tipos_condicion mt
      WHERE mt.codigo = ${d.tipo}
        AND mt.is_active
        AND NOT EXISTS (
          SELECT 1 FROM trip_conditions c
          WHERE c.tenant_id = ${d.tenant_id}::uuid
            AND c.clave_identidad = ${clave}
        )
      RETURNING id::text AS id
    `;
    if (filas.length > 0) {
      this.logger.log(`Condición ABIERTA ${d.tipo} · vehículo ${d.vehicle_id} · ${d.disparador}`);
    }
    return filas.map((f) => f.id);
  }

  /** Cierra y devuelve los ids cerrados: el aviso de «ya no suena» los necesita. */
  private async cerrar(d: DecisionCondicion): Promise<string[]> {
    // Se cierra por (tenant, vehículo, tipo, abierta), no por la clave: el
    // hecho pudo haberse abierto con un `inicio` que este evaluador no conoce
    // exactamente —otro worker, un reproceso— y aun así hay que cerrarlo.
    const filas = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE trip_conditions
         SET fin = ${d.fin ?? new Date()},
             datos = datos || ${JSON.stringify({ cierre: d.datos, motivo: d.disparador })}::jsonb
       WHERE tenant_id = ${d.tenant_id}::uuid
         AND vehicle_id = ${d.vehicle_id}::uuid
         AND tipo = ${d.tipo}
         AND fin IS NULL
      RETURNING id::text AS id
    `;
    if (filas.length > 0) {
      this.logger.log(`Condición CERRADA ${d.tipo} · vehículo ${d.vehicle_id} · ${d.disparador}`);
    }
    return filas.map((f) => f.id);
  }

  // ════════════════════════════════════════════════════════════════════════
  // EL BARRIDO — la mitad de SIN_REPORTE que no puede colgar de un punto
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Abre `SIN_REPORTE` en los vehículos que dejaron de transmitir.
   *
   * ⚠️ Recorre `motor_vehiculos_activos` —que la Etapa 0 mantiene diminuta a
   * propósito, quince filas con quince viajes activos— y NO la telemetría. El
   * último punto conocido ya está en `motor_estado_vehiculo`: el barrido no
   * cuesta una consulta sobre millones de filas, cuesta una sobre quince.
   *
   * Es la única condición que se dispara por AUSENCIA, y por eso es la única
   * que necesita esto. Lo llama el worker en cada vuelta.
   */
  async barrerSinReporte(ahora: Date): Promise<number> {
    const candidatos = await this.prisma.$queryRaw<
      {
        tenant_id: string;
        vehicle_id: string;
        trip_id: string | null;
        ultimo_punto_ts: Date | null;
        latitude: number | null;
        longitude: number | null;
        sin_reporte_minutos: number;
        ya_abierta: boolean;
      }[]
    >`
      SELECT
        va.tenant_id::text                          AS tenant_id,
        va.vehicle_id::text                         AS vehicle_id,
        va.trip_id::text                            AS trip_id,
        ev.ultimo_punto_ts,
        ST_Y(ev.ultimo_punto::geometry)::float8      AS latitude,
        ST_X(ev.ultimo_punto::geometry)::float8      AS longitude,
        -- El umbral sale de la fila del cliente; si no tiene fila, del default
        -- de la COLUMNA. Un solo número, en la base, y el código lo espeja con
        -- una prueba que falla si se separan (ver umbrales-condiciones.ts).
        coalesce(cfg.sin_reporte_minutos, ${UMBRAL_SIN_REPORTE_POR_DEFECTO})::int AS sin_reporte_minutos,
        EXISTS (
          SELECT 1 FROM trip_conditions c
          WHERE c.tenant_id = va.tenant_id
            AND c.vehicle_id = va.vehicle_id
            AND c.tipo = 'SIN_REPORTE'
            AND c.fin IS NULL
        )                                            AS ya_abierta
      FROM motor_vehiculos_activos va
      LEFT JOIN motor_estado_vehiculo ev
             ON ev.vehicle_id = va.vehicle_id AND ev.tenant_id = va.tenant_id
      LEFT JOIN tenant_engine_config cfg ON cfg.tenant_id = va.tenant_id
    `;

    const decisiones: DecisionCondicion[] = [];
    for (const c of candidatos) {
      if (c.ya_abierta) continue;

      // La zona sin señal se consulta SÓLO para los que ya pasaron el umbral
      // base: es una consulta geoespacial por vehículo y no vale la pena
      // pagarla por los que están reportando bien.
      const silencioBase =
        c.ultimo_punto_ts === null
          ? 0
          : (ahora.getTime() - new Date(c.ultimo_punto_ts).getTime()) / 60000;
      if (c.ultimo_punto_ts === null || silencioBase < Number(c.sin_reporte_minutos)) continue;

      const zona =
        c.latitude !== null && c.longitude !== null
          ? await this.zonaSinSenalEn(c.tenant_id, Number(c.latitude), Number(c.longitude))
          : { minutos: null, nombre: null };

      const contexto: ContextoSinReporte = {
        ultimoPuntoTs: new Date(c.ultimo_punto_ts),
        ahora,
        sinReporteMinutos: Number(c.sin_reporte_minutos),
        minutosEsperadosDeLaZona: zona.minutos,
        nombreZona: zona.nombre,
        abierta: false,
      };
      decisiones.push(
        ...evaluarSinReporte(
          { tenant_id: c.tenant_id, vehicle_id: c.vehicle_id, trip_id: c.trip_id },
          contexto,
        ),
      );
    }

    if (decisiones.length === 0) return 0;
    return this.aplicar(decisiones);
  }

  /** El contexto de parada, listo para el evaluador. */
  async contextoDeParada(
    punto: PuntoEvaluable,
    abiertas: Map<string, Date>,
  ): Promise<ContextoParada> {
    const ubicacion = await this.paradaAutorizadaEn(
      punto.tenant_id,
      punto.latitude,
      punto.longitude,
    );
    return {
      enParadaAutorizada: ubicacion.autorizada,
      nombreUbicacion: ubicacion.nombre,
      abiertas: new Set(abiertas.keys()),
    };
  }

  /** El contexto de desvío, listo para el evaluador. */
  async contextoDeDesvio(
    punto: PuntoEvaluable,
    abiertas: Map<string, Date>,
  ): Promise<ContextoDesvio> {
    if (!punto.trip_id) {
      return { distanciaMetros: null, corredorMetros: 500, abierta: false, inicioAbierta: null };
    }
    const ruta = await this.distanciaALaRuta(
      punto.trip_id,
      punto.tenant_id,
      punto.latitude,
      punto.longitude,
    );
    return {
      distanciaMetros: ruta.distancia_m,
      corredorMetros: ruta.corredor_m,
      abierta: abiertas.has('DESVIO_DE_RUTA'),
      inicioAbierta: abiertas.get('DESVIO_DE_RUTA') ?? null,
    };
  }
}
