import type { EstadoVehiculo, PuntoEvaluable } from '../tipos';
import {
  CONDICIONES_3B,
  minutosEntre,
  type DecisionCondicion,
} from './tipos-condiciones';

/**
 * EVALUADOR DE PARADAS — función pura.
 *
 * Abre y cierra `PARADA_NO_AUTORIZADA` y `PARADA_PROLONGADA`. Son **dos
 * condiciones sobre un mismo hecho**: el vehículo está quieto. Lo que las
 * separa es el umbral y —sobre todo— el contexto.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * LO QUE HACE QUE ESTO SEA CUSTODIA Y NO UN CRONÓMETRO
 * ══════════════════════════════════════════════════════════════════════════
 *
 * **Una parada en una ubicación habilitada NO ABRE CONDICIÓN.** Ése es el
 * `DETENIDO_AUTORIZADO` verde: no es un estado que alguien escriba, es la
 * ausencia de condición abierta. Un camión veinte minutos en una estación de
 * servicio habilitada es rutina; los mismos veinte minutos en la ruta son una
 * alarma. El hecho es idéntico — cambia el contexto.
 *
 * ⚠️ **`PARADA_PROLONGADA` SÍ se abre aunque la parada esté autorizada**, y no
 * es una inconsistencia. Sale del catálogo de la Etapa 0, textual: *«Detenido
 * más del umbral extendido, **aun en zona autorizada**»*. Una hora en la
 * estación de servicio ya no es cargar combustible: es algo que el operador
 * quiere ver, aunque no sea grave. Por eso su riesgo es menor y su umbral
 * mayor.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * DE DÓNDE SALE `detenido_desde`
 * ══════════════════════════════════════════════════════════════════════════
 *
 * NO lo calcula este evaluador: lo mantiene el worker desde la Etapa 1, en
 * `motor_estado_vehiculo`. El comentario que lo dejó ahí decía por qué: «el
 * dato hay que acumularlo desde ahora, porque no se puede reconstruir hacia
 * atrás sin releer telemetría». Cobrar ese pago es exactamente esto.
 *
 * Y es lo que hace estable la clave de identidad: los 240 puntos de una parada
 * de veinte minutos ven el MISMO `detenido_desde`.
 */

/** Lo que el evaluador necesita saber del mundo, ya resuelto por el servicio. */
export interface ContextoParada {
  /**
   * ¿El punto cae dentro de una `saved_locations` con `is_authorized_stop`?
   *
   * Lo resuelve el servicio con PostGIS. Acá entra ya respondido: la lógica es
   * ciega y no sabe consultar.
   */
  enParadaAutorizada: boolean;
  /** El nombre de esa ubicación, para que el operador lea por qué no se alertó. */
  nombreUbicacion: string | null;
  /** Qué condiciones de parada están abiertas ahora mismo para este vehículo. */
  abiertas: Set<string>;
}

export interface UmbralesParada {
  parada_minutos: number;
  parada_velocidad_kmh: number;
  parada_prolongada_minutos: number;
}

export function evaluarParadas(
  estado: EstadoVehiculo,
  punto: PuntoEvaluable,
  umbrales: UmbralesParada,
  contexto: ContextoParada,
): DecisionCondicion[] {
  const decisiones: DecisionCondicion[] = [];
  const base = {
    tenant_id: punto.tenant_id,
    vehicle_id: punto.vehicle_id,
    trip_id: punto.trip_id,
  };

  // ⚠️ `speed_kmh` puede venir en null: hay equipos que no la mandan. Un null
  // NO es cero — tratarlo como «detenido» abriría paradas fantasma en cada
  // vehículo cuyo AVL no reporte velocidad. Sin velocidad no se decide nada.
  const velocidad = punto.speed_kmh;
  if (velocidad === null || velocidad === undefined) return decisiones;

  const enMarcha = velocidad > umbrales.parada_velocidad_kmh;

  // ── El camión arrancó: se cierra lo que estuviera abierto ────────────────
  // «Las condiciones se cierran solas cuando el hecho termina. Un camión que
  // vuelve a moverse cierra su parada.» Sin esto el estado nunca baja y la
  // Etapa 3A queda inútil.
  if (enMarcha) {
    for (const tipo of [CONDICIONES_3B.PARADA_NO_AUTORIZADA, CONDICIONES_3B.PARADA_PROLONGADA]) {
      if (!contexto.abiertas.has(tipo)) continue;
      decisiones.push({
        ...base,
        accion: 'cerrar',
        tipo,
        inicio: estado.detenido_desde ?? punto.timestamp,
        fin: punto.timestamp,
        disparador: `El vehículo reanudó la marcha (${velocidad} km/h).`,
        datos: { velocidad_kmh: velocidad },
      });
    }
    return decisiones;
  }

  // ── Está quieto ──────────────────────────────────────────────────────────
  // Sin `detenido_desde` no se sabe desde cuándo, y sin eso no hay ni umbral
  // que comparar ni clave de identidad estable. Es el primer punto quieto: el
  // worker va a fijar la marca y el próximo punto ya podrá decidir.
  if (!estado.detenido_desde) return decisiones;

  const minutos = minutosEntre(estado.detenido_desde, punto.timestamp);

  // PARADA_NO_AUTORIZADA — el contexto la suprime.
  if (
    minutos >= umbrales.parada_minutos &&
    !contexto.enParadaAutorizada &&
    !contexto.abiertas.has(CONDICIONES_3B.PARADA_NO_AUTORIZADA)
  ) {
    decisiones.push({
      ...base,
      accion: 'abrir',
      tipo: CONDICIONES_3B.PARADA_NO_AUTORIZADA,
      inicio: estado.detenido_desde,
      disparador:
        `Detenido ${Math.floor(minutos)} min fuera de una ubicación habilitada ` +
        `(umbral: ${umbrales.parada_minutos} min).`,
      datos: {
        minutos_detenido: Math.floor(minutos),
        umbral_minutos: umbrales.parada_minutos,
        umbral_velocidad_kmh: umbrales.parada_velocidad_kmh,
        velocidad_kmh: velocidad,
      },
    });
  }

  // PARADA_PROLONGADA — el contexto NO la suprime. Ver el encabezado.
  if (
    minutos >= umbrales.parada_prolongada_minutos &&
    !contexto.abiertas.has(CONDICIONES_3B.PARADA_PROLONGADA)
  ) {
    decisiones.push({
      ...base,
      accion: 'abrir',
      tipo: CONDICIONES_3B.PARADA_PROLONGADA,
      inicio: estado.detenido_desde,
      disparador:
        `Detenido ${Math.floor(minutos)} min` +
        (contexto.enParadaAutorizada
          ? ` en "${contexto.nombreUbicacion ?? 'una ubicación habilitada'}"`
          : '') +
        ` (umbral: ${umbrales.parada_prolongada_minutos} min).`,
      datos: {
        minutos_detenido: Math.floor(minutos),
        umbral_minutos: umbrales.parada_prolongada_minutos,
        en_parada_autorizada: contexto.enParadaAutorizada,
        ubicacion: contexto.nombreUbicacion,
      },
    });
  }

  return decisiones;
}
