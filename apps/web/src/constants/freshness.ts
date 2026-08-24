/**
 * FRESCURA DEL DATO — vocabulario visual compartido.
 *
 * "Frescura" responde una sola pregunta: **¿hace cuánto que este vehículo no
 * reporta?**. Es la señal de seguridad que le importa al operador, y por eso
 * define el color en todas las pantallas que muestran telemetría.
 *
 * Vive acá y no dentro de cada pantalla porque ya se usa en el mapa global, en
 * el detalle de viaje y en el monitor de ingesta AVL. Con una copia por
 * pantalla, "en vivo" terminaba siendo un verde distinto en cada una y el
 * operador no podía comparar lo que veía.
 *
 * Los umbrales que producen estas etiquetas NO están acá: son configurables por
 * cliente y los calcula el backend (`tenant_monitoring_config`). El frontend
 * recibe la etiqueta ya resuelta.
 */

export type Frescura = 'en_vivo' | 'inactivo' | 'sin_senal';

/** Color de relleno del marcador según la frescura del último punto. */
export const FRESCURA_COLORS: Record<Frescura, string> = {
  en_vivo: '#2BF4B6',
  inactivo: '#F59E0B',
  sin_senal: '#6B7280',
};

/** Vehículo sin ningún punto en la ventana consultada: no va al mapa. */
export const COLOR_SIN_DATOS = '#4B5563';

/**
 * Anillo que marca "este vehículo tiene un viaje declarado en curso".
 * Va aparte del color de relleno a propósito: el modo operativo (viaje vs
 * Tracking Libre) no debe competir con la señal de si está reportando.
 */
export const COLOR_ANILLO_VIAJE = '#2AB3FF';

/** Clave de traducción de cada etiqueta, para no repetir el switch en cada vista. */
export const FRESCURA_I18N: Record<Frescura, string> = {
  en_vivo: 'map.freshness_live',
  inactivo: 'map.freshness_idle',
  sin_senal: 'map.freshness_offline',
};
