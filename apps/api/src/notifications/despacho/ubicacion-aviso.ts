import { Prisma } from '@prisma/client';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * DÓNDE ESTABA EL VEHÍCULO, Y CUÁNDO — una sola definición para los avisos
 * ══════════════════════════════════════════════════════════════════════════
 *
 * En custodia, dónde está el camión es la mitad de la información: un desvío
 * sin posición no se puede atender. El aviso decía «sin ubicación en el
 * aviso» porque las dos consultas que lo arman ponían `NULL AS latitud` para
 * las condiciones del motor, aunque el dato existe desde la 3B bis en
 * `motor_estado_vehiculo.ultimo_punto`.
 *
 * ⚠️ UN SOLO LUGAR PARA LAS DOS CONSULTAS. El aviso se arma dos veces: la
 * lista de la campana (`CampanaService.pendientes`) y el empujón en vivo
 * (`DespachoService.despacharCondiciones`). Si la ubicación se agregara en
 * una sola, el aviso que llega en vivo y el que se ve al recargar dirían
 * cosas distintas del mismo camión. Por eso son fragmentos que las dos usan.
 *
 * ⚠️ LA POSICIÓN VIAJA CON SU HORA. `ubicacion_at` es la hora del ÚLTIMO
 * PUNTO CONOCIDO, no la de ahora ni la de la alerta: un camión que dejó de
 * reportar hace seis horas tiene una posición de hace seis horas, y mostrarla
 * como actual es peor que no mostrarla.
 *
 * El orden de lo que se muestra, de lo más útil a lo más crudo:
 *   1. `lugar` — el nombre del lugar guardado o de la geocerca que contiene
 *      el punto. Mismo predicado que ya usa el motor: `ST_DWithin` con el
 *      radio para los lugares (`CondicionesService`), `ST_Intersects` para
 *      las geocercas, la más chica primero (`TransicionesService`).
 *   2. `latitud` / `longitud` — si no cae en ningún lugar con nombre.
 *   3. nada — y la pantalla lo DICE; no deja un hueco.
 *
 * (Sin acentos graves en los comentarios de SQL de abajo: cierran la
 * plantilla.)
 */

/**
 * Las columnas, en el orden en que las dos ramas de la UNION de la campana
 * las necesitan. Lee del lateral `ub` (el punto y su hora) y de los dos
 * laterales de `LUGAR_DEL_PUNTO`.
 */
export const COLUMNAS_UBICACION = Prisma.sql`
        ST_Y(ub.punto::geometry)::float8               AS latitud,
        ST_X(ub.punto::geometry)::float8               AS longitud,
        ub.punto_at                                    AS ubicacion_at,
        coalesce(lugar_guardado.name, geocerca.name)   AS lugar`;

/**
 * El punto de una CONDICION (alias `c`): el ultimo punto conocido del
 * vehiculo, con la hora de ese punto.
 */
export const PUNTO_DE_CONDICION = Prisma.sql`
      LEFT JOIN motor_estado_vehiculo ev ON ev.vehicle_id = c.vehicle_id
                                        AND ev.tenant_id = c.tenant_id
      CROSS JOIN LATERAL (
        SELECT ev.ultimo_punto AS punto,
               -- La hora solo si hay punto: una hora sin posicion no dice donde.
               CASE WHEN ev.ultimo_punto IS NULL THEN NULL ELSE ev.ultimo_punto_ts END AS punto_at,
               c.tenant_id AS tenant_id
      ) ub`;

/**
 * El punto de un EVENTO (alias `e`): el que el evento trae, con la hora del
 * evento. Es mas exacto que el ultimo conocido: es donde estaba cuando paso.
 * ST_MakePoint es STRICT, asi que con una coordenada nula el punto es nulo.
 */
export const PUNTO_DE_EVENTO = Prisma.sql`
      CROSS JOIN LATERAL (
        SELECT ST_SetSRID(ST_MakePoint(e.longitude::float8, e.latitude::float8), 4326)::geography AS punto,
               CASE WHEN e.latitude IS NULL OR e.longitude IS NULL THEN NULL ELSE e.triggered_at END AS punto_at,
               e.tenant_id AS tenant_id
      ) ub`;

/**
 * El nombre del lugar que contiene el punto, acotado al MISMO cliente: el
 * lugar guardado de otra empresa no puede ponerle nombre a este camion.
 */
export const LUGAR_DEL_PUNTO = Prisma.sql`
      LEFT JOIN LATERAL (
        SELECT sl.name
        FROM saved_locations sl
        WHERE sl.tenant_id = ub.tenant_id
          AND sl.is_active
          AND ST_DWithin(sl.geometry, ub.punto, sl.radius_meters)
        ORDER BY ST_Distance(sl.geometry, ub.punto)
        LIMIT 1
      ) lugar_guardado ON true
      LEFT JOIN LATERAL (
        SELECT gf.name
        FROM geofences gf
        WHERE gf.tenant_id = ub.tenant_id
          AND gf.is_active
          AND ST_Intersects(gf.geometry, ub.punto)
        ORDER BY ST_Area(gf.geometry::geometry) ASC
        LIMIT 1
      ) geocerca ON true`;
