/**
 * CONFIGURACIÓN DE POSICIONES EN VIVO.
 *
 * Decisión de arquitectura: **Postgres es la fuente de verdad; Redis es una
 * optimización opcional, desactivada por defecto.**
 *
 * El motivo es concreto: la caché de Redis sólo la escribe el ingest de NestJS
 * (`POST /api/v1/telemetry/ingest`). La app móvil NO pasa por ahí — envía sus
 * puntos a la Mobile API (Next.js en Vercel), que escribe directo a la tabla
 * `telemetry` con `pg`. Mientras la lectura dependa de Redis, el mapa en vivo
 * queda vacío justamente para los vehículos rastreados desde la app, que es el
 * caso de uso principal del producto.
 *
 * Con pocos clientes, además, Redis agrega un punto de fallo sin beneficio real
 * (ya ocurrió: la instancia de Upstash se eliminó y llenó los logs de ENOTFOUND).
 */

/** Origen de datos para las posiciones en vivo. */
export type LivePositionsSource = 'postgres' | 'redis';

const SOURCE_POR_DEFECTO: LivePositionsSource = 'postgres';

/**
 * Lee `LIVE_POSITIONS_SOURCE`. Cualquier valor no reconocido cae al default
 * (`postgres`) en lugar de romper el arranque: si alguien escribe mal la
 * variable, el mapa sigue funcionando desde la fuente de verdad.
 */
export function getLivePositionsSource(): LivePositionsSource {
  const valor = (process.env.LIVE_POSITIONS_SOURCE ?? '').trim().toLowerCase();
  return valor === 'redis' ? 'redis' : SOURCE_POR_DEFECTO;
}

/**
 * Ventana temporal de la consulta, en horas.
 *
 * ⚠️ No es cosmética: `telemetry` está particionada por mes y la consulta usa
 * un rango CERRADO para que Postgres pode particiones al planificar.
 *
 * La ventana efectiva la define ahora `tenant_monitoring_config`
 * (`ventana_mapa_horas`), acotada a 168 h. Esta variable de entorno queda
 * únicamente como valor por defecto de la instalación, para los tenants que no
 * tengan fila propia.
 */
export function getLivePositionsWindowHours(): number {
  const crudo = Number(process.env.LIVE_POSITIONS_WINDOW_HOURS);
  if (!Number.isFinite(crudo) || crudo <= 0 || crudo > 168) return 24;
  return Math.floor(crudo);
}

/**
 * Tolerancia de reloj, en minutos, para el extremo superior de la ventana.
 *
 * Los timestamps de la app los genera el dispositivo del conductor. Un teléfono
 * adelantado unos minutos escribiría puntos con fecha futura, que un límite
 * superior clavado en "ahora" dejaría fuera — y el vehículo desaparecería del
 * mapa justo cuando está reportando.
 */
export const TOLERANCIA_RELOJ_MINUTOS = 5;

export type Frescura = 'en_vivo' | 'inactivo' | 'sin_senal';

/**
 * Traduce la antigüedad de un punto a una etiqueta estable para la UI.
 *
 * Los umbrales llegan por parámetro porque son **configurables por tenant**
 * (tabla `tenant_monitoring_config`): una operación urbana de reparto y un
 * transporte de larga distancia tienen ritmos distintos, y un umbral único
 * convierte la señal en ruido para uno de los dos.
 *
 * Antes estaban fijos acá en 5 y 30 minutos; esos valores siguen siendo el
 * default, pero ahora viven en `MonitoringConfigService.UMBRALES_POR_DEFECTO`.
 */
export function clasificarFrescura(
  antiguedadSegundos: number,
  umbralEnVivoMinutos: number,
  umbralInactivoMinutos: number,
): Frescura {
  if (antiguedadSegundos <= umbralEnVivoMinutos * 60) return 'en_vivo';
  if (antiguedadSegundos <= umbralInactivoMinutos * 60) return 'inactivo';
  return 'sin_senal';
}
