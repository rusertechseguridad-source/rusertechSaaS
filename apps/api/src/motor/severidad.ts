import type { TipoDecision } from './tipos';

/**
 * QUÉ SEVERIDAD LLEVA CADA HECHO QUE DECIDE EL MOTOR.
 *
 * ⚠️ Buscado y NO encontrado: **no hay un nivel de riesgo por geocerca en el
 * esquema**. `model Geofence` tiene `zone_type`, `color` y `fill_opacity`, pero
 * ninguna columna de criticidad; `operational_protocols` sí tiene `risk_level`,
 * pero describe el protocolo de un estado de viaje, no la peligrosidad de una
 * zona. Inventar una columna o ramificar por `zone_type` —cuyo vocabulario no
 * está declarado en ninguna parte del repo— sería exactamente el "permiso
 * inventado" de la tanda anterior: parece configurable y no lo es.
 *
 * Así que la severidad se deriva del TIPO de hecho, con una tabla explícita y
 * corta que se puede leer de un vistazo y discutir con el operador.
 *
 * El vocabulario es el que la tabla ya usa: los dos escritores que existían
 * antes de esta tanda escriben `'info'` (nota de operador) y `'critical'`
 * (bloqueo manual de vehículo).
 *
 * 👉 Que la criticidad sea configurable POR ZONA es una decisión de producto
 * pendiente: hace falta una columna en `geofences` y una pantalla. Anotado.
 */
export type Severidad = 'info' | 'warning' | 'critical';

export const SEVERIDAD_POR_TIPO: Readonly<Record<TipoDecision, Severidad>> = Object.freeze({
  // Entrar en una zona es lo que el operador tiene que mirar: puede ser una
  // parada prevista o una zona prohibida, y hoy el motor no puede distinguirlo.
  geocerca_entrada: 'warning',
  // Salir suele ser el fin de una situación normal.
  geocerca_salida: 'info',
  // Una zona de control que el viaje NO alcanzó es un desvío de ruta: es el
  // más grave de los tres, porque significa que el plan no se cumplió.
  zona_salteada: 'critical',
  // La transición ya se aplicó sobre el viaje; la fila es la traza para la
  // línea de tiempo, no una alarma.
  transicion_estado: 'info',
});

/**
 * Falla hacia `warning` y no hacia `info`: si mañana se agrega un tipo de
 * decisión y alguien olvida darle severidad, es preferible que aparezca en la
 * pantalla de más que se pierda entre el ruido.
 */
export function severidadDe(tipo: TipoDecision): Severidad {
  return SEVERIDAD_POR_TIPO[tipo] ?? 'warning';
}
