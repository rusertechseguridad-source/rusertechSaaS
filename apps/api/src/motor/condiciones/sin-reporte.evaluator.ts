import {
  CONDICIONES_3B,
  minutosEntre,
  type DecisionCondicion,
} from './tipos-condiciones';

/**
 * EVALUADOR DE SIN REPORTE — función pura.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ES ESTRUCTURALMENTE DISTINTA A LAS OTRAS TRES
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Las otras se disparan **cuando llega un punto**. Ésta se dispara **cuando NO
 * llega** — y un punto que no llega no puede activar un trigger, ni entrar en
 * la cola, ni despertar al worker.
 *
 * Por eso vive en dos lugares y no en uno:
 *
 *   ABRIR   un barrido temporal, que recorre los vehículos en monitoreo y
 *           compara su último punto conocido contra el umbral
 *   CERRAR  el camino normal del punto: si llegó un punto, ya está reportando
 *
 * Las dos mitades tienen que estar enchufadas. R17 lo vigila.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ LA TRAMPA QUE EL ESQUEMA YA HABÍA PREVISTO
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `no_signal_zones` existe desde antes de este motor, con
 * `expected_loss_minutes` y `signal_loss_reason`. Alguien ya había pensado que
 * hay lugares donde perder señal es **normal**: un túnel, una quebrada.
 *
 * Sin eso, todo cliente con una ruta de montaña recibe alertas falsas todos los
 * días y **deja de mirarlas** — que es la peor forma de fallar de un producto
 * de seguridad, porque falla en silencio y del lado del operador.
 *
 * El umbral efectivo dentro de una zona conocida es el MAYOR de los dos: el del
 * cliente y el esperado de la zona. Nunca el menor. Una zona donde se esperan
 * cuarenta minutos de silencio no puede alertar a los veinte.
 */

export interface ContextoSinReporte {
  /** Último punto conocido del vehículo (`motor_estado_vehiculo.ultimo_punto_ts`). */
  ultimoPuntoTs: Date | null;
  /** El «ahora» entra por parámetro: un evaluador que lee el reloj no se prueba. */
  ahora: Date;
  /** `tenant_engine_config.sin_reporte_minutos`. */
  sinReporteMinutos: number;
  /**
   * Si el último punto conocido cayó dentro de una zona sin señal, sus minutos
   * esperados. `null` = no estaba en ninguna zona conocida.
   */
  minutosEsperadosDeLaZona: number | null;
  /** Nombre de la zona, para que el operador lea por qué no se alertó antes. */
  nombreZona: string | null;
  abierta: boolean;
}

/** El umbral que de verdad se aplica, con la zona ya considerada. */
export function umbralEfectivo(c: {
  sinReporteMinutos: number;
  minutosEsperadosDeLaZona: number | null;
}): number {
  if (c.minutosEsperadosDeLaZona === null) return c.sinReporteMinutos;
  // El MAYOR, nunca el menor: la zona sólo puede dar MÁS tolerancia.
  return Math.max(c.sinReporteMinutos, c.minutosEsperadosDeLaZona);
}

/** ¿Hay que ABRIR una condición de silencio? Lo llama el barrido temporal. */
export function evaluarSinReporte(
  identidad: { tenant_id: string; vehicle_id: string; trip_id: string | null },
  contexto: ContextoSinReporte,
): DecisionCondicion[] {
  if (contexto.abierta) return [];

  // Un vehículo del que nunca se supo nada no está «sin reporte»: está sin
  // estrenar. Alertar por eso sería alertar por un alta reciente.
  if (contexto.ultimoPuntoTs === null) return [];

  const silencio = minutosEntre(contexto.ultimoPuntoTs, contexto.ahora);
  const umbral = umbralEfectivo(contexto);
  if (silencio < umbral) return [];

  return [{
    ...identidad,
    accion: 'abrir',
    tipo: CONDICIONES_3B.SIN_REPORTE,
    // El silencio empieza cuando llegó el ÚLTIMO punto, no cuando el barrido
    // se dio cuenta. Es lo que hace que barridos sucesivos den la misma clave.
    inicio: contexto.ultimoPuntoTs,
    disparador:
      `Sin reportar hace ${Math.floor(silencio)} min (umbral: ${umbral} min` +
      (contexto.minutosEsperadosDeLaZona !== null
        ? `, ampliado por la zona "${contexto.nombreZona ?? 'sin señal conocida'}"`
        : '') +
      ').',
    datos: {
      minutos_sin_reporte: Math.floor(silencio),
      umbral_aplicado: umbral,
      umbral_del_cliente: contexto.sinReporteMinutos,
      zona_sin_senal: contexto.nombreZona,
      minutos_esperados_zona: contexto.minutosEsperadosDeLaZona,
    },
  }];
}

/**
 * ¿Hay que CERRAR? Lo llama el camino del punto: si llegó, está reportando.
 *
 * No hay umbral que comparar — la llegada del punto ES el hecho de que volvió.
 */
export function cerrarSinReportePorPunto(
  identidad: { tenant_id: string; vehicle_id: string; trip_id: string | null },
  contexto: { abierta: boolean; inicioAbierta: Date | null; momentoDelPunto: Date },
): DecisionCondicion[] {
  if (!contexto.abierta) return [];

  const inicio = contexto.inicioAbierta ?? contexto.momentoDelPunto;
  return [{
    ...identidad,
    accion: 'cerrar',
    tipo: CONDICIONES_3B.SIN_REPORTE,
    inicio,
    fin: contexto.momentoDelPunto,
    disparador:
      `Volvió a reportar tras ${Math.floor(minutosEntre(inicio, contexto.momentoDelPunto))} min de silencio.`,
    datos: {
      minutos_de_silencio: Math.floor(minutosEntre(inicio, contexto.momentoDelPunto)),
    },
  }];
}
