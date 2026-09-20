import type { PuntoEvaluable } from '../tipos';
import { CONDICIONES_3B, type DecisionCondicion } from './tipos-condiciones';

/**
 * EVALUADOR DE DESVÍO DE RUTA — función pura.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ EL CORREDOR NO ES `recorrido_tolerancia_m`
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Es el error que más cerca estuvo de entrar en esta etapa, y se parece al de
 * la 3A: un nombre plausible que significa otra cosa.
 *
 * `tenant_engine_config.recorrido_tolerancia_m` es la tolerancia de
 * SIMPLIFICACIÓN Douglas-Peucker del recorrido guardado (Fase E), con rango
 * 0–50 m y **default 2 m**. Usarla como corredor abriría un desvío en
 * prácticamente cada punto: ningún GPS cae dentro de una franja de dos metros
 * alrededor de una línea. Y un evaluador ruidoso es peor que uno roto, porque
 * el ruido se confunde con funcionamiento hasta que alguien deja de mirar.
 *
 * El corredor real ya existía y es **por viaje**, que es mejor que por tenant:
 * `trips.corridor_meters`, con `routes.corridor_meters` como origen al declarar
 * el viaje. Los dos son `int4 NOT NULL` con default 500 — verificado contra la
 * base, no contra el `schema.prisma`.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * QUÉ HACE ESTE ARCHIVO Y QUÉ NO
 * ══════════════════════════════════════════════════════════════════════════
 *
 * La DISTANCIA la calcula el servicio con PostGIS —es la única parte que
 * necesita la base— y entra acá ya resuelta. Acá se decide, que es lo que se
 * puede probar sin Postgres.
 *
 * La estrategia híbrida del diseño §2.2 (banda de certeza sobre la ruta
 * simplificada, consulta exacta sólo en la franja dudosa) vive del lado del
 * servicio por el mismo motivo. Este evaluador recibe un número en metros y no
 * necesita saber cómo se obtuvo.
 */

export interface ContextoDesvio {
  /**
   * Distancia del punto a la ruta planificada, en metros. `null` = **no hay
   * ruta contra la cual medir**.
   *
   * ⚠️ `null` NO es cero y NO es «está sobre la ruta». Un viaje sin ruta
   * planificada no puede estar desviado: no hay de qué. Confundirlos abriría un
   * desvío a todo viaje sin ruta, que hoy —con `routes` recién empezando a
   * cargarse— serían todos.
   */
  distanciaMetros: number | null;
  /** `trips.corridor_meters` del viaje. */
  corredorMetros: number;
  /** ¿Ya hay un `DESVIO_DE_RUTA` abierto para este vehículo? */
  abierta: boolean;
  /** Cuándo empezó el desvío abierto, para poder cerrarlo con su clave. */
  inicioAbierta: Date | null;
}

export function evaluarDesvio(
  punto: PuntoEvaluable,
  contexto: ContextoDesvio,
): DecisionCondicion[] {
  // Sin ruta no hay desvío posible. Se sale antes de decidir nada — es el
  // early return que evita la afirmación falsa.
  if (contexto.distanciaMetros === null) return [];

  const base = {
    tenant_id: punto.tenant_id,
    vehicle_id: punto.vehicle_id,
    trip_id: punto.trip_id,
    tipo: CONDICIONES_3B.DESVIO_DE_RUTA,
  };
  const fuera = contexto.distanciaMetros > contexto.corredorMetros;

  if (fuera && !contexto.abierta) {
    return [{
      ...base,
      accion: 'abrir',
      // El desvío empieza EN ESTE PUNTO: es el primero que se detecta afuera.
      // A diferencia de una parada, no hay una marca previa que diga desde
      // cuándo — el punto anterior estaba dentro del corredor.
      inicio: punto.timestamp,
      disparador:
        `A ${Math.round(contexto.distanciaMetros)} m de la ruta planificada ` +
        `(corredor: ${contexto.corredorMetros} m).`,
      datos: {
        distancia_m: Math.round(contexto.distanciaMetros),
        corredor_m: contexto.corredorMetros,
        exceso_m: Math.round(contexto.distanciaMetros - contexto.corredorMetros),
      },
    }];
  }

  if (!fuera && contexto.abierta) {
    return [{
      ...base,
      accion: 'cerrar',
      inicio: contexto.inicioAbierta ?? punto.timestamp,
      fin: punto.timestamp,
      disparador:
        `Volvió al corredor: a ${Math.round(contexto.distanciaMetros)} m de la ruta ` +
        `(corredor: ${contexto.corredorMetros} m).`,
      datos: {
        distancia_m: Math.round(contexto.distanciaMetros),
        corredor_m: contexto.corredorMetros,
      },
    }];
  }

  return [];
}
