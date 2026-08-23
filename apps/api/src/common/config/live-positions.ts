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
 * ⚠️ No es cosmética: `telemetry` está particionada por mes. Sin filtro de
 * fecha, Postgres escanearía las 30 particiones existentes. Con el filtro poda
 * y va sólo a la del mes en curso.
 */
export function getLivePositionsWindowHours(): number {
  const crudo = Number(process.env.LIVE_POSITIONS_WINDOW_HOURS);
  if (!Number.isFinite(crudo) || crudo <= 0 || crudo > 720) return 24;
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

/**
 * Umbrales de frescura, en segundos. Un punto de hace 20 horas entra en la
 * ventana pero no es "en vivo": la UI necesita poder distinguir un vehículo
 * que está reportando de uno que dejó de hacerlo.
 *
 * La app envía cada 15-30 s en movimiento y un heartbeat cada pocos minutos,
 * así que 5 minutos sin datos ya es señal de algo.
 */
export const FRESCURA_EN_VIVO_SEGUNDOS = 5 * 60;
export const FRESCURA_INACTIVO_SEGUNDOS = 30 * 60;

export type Frescura = 'en_vivo' | 'inactivo' | 'sin_senal';

/** Traduce la antigüedad de un punto a una etiqueta estable para la UI. */
export function clasificarFrescura(antiguedadSegundos: number): Frescura {
  if (antiguedadSegundos <= FRESCURA_EN_VIVO_SEGUNDOS) return 'en_vivo';
  if (antiguedadSegundos <= FRESCURA_INACTIVO_SEGUNDOS) return 'inactivo';
  return 'sin_senal';
}
