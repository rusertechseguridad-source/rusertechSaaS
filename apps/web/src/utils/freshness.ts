import type { Frescura } from '../constants/freshness';
import { FRESCURA_I18N } from '../constants/freshness';

/**
 * Antigüedad de un punto en texto legible.
 *
 * Recibe la función `t` en lugar de importar i18n: mantiene la utilidad pura y
 * comprobable, y evita que un módulo de formato arrastre la configuración de
 * traducciones a cualquier archivo que lo importe.
 */
export function formatearAntiguedad(segundos: number | null | undefined, t: any): string {
  if (segundos === null || segundos === undefined || !Number.isFinite(segundos)) {
    return t('map.no_position');
  }
  if (segundos < 60) return t('map.ago_seconds', { n: Math.max(0, Math.floor(segundos)) });
  if (segundos < 3600) return t('map.ago_minutes', { n: Math.floor(segundos / 60) });
  if (segundos < 86400) return t('map.ago_hours', { n: Math.floor(segundos / 3600) });
  return t('map.ago_days', { n: Math.floor(segundos / 86400) });
}

/** Etiqueta traducida de una frescura. */
export function etiquetaFrescura(frescura: Frescura, t: any): string {
  return t(FRESCURA_I18N[frescura]);
}

/**
 * Momento absoluto + tiempo transcurrido: "24/08/2026, 19:41:03 (hace 41 s)".
 *
 * El absoluto es lo que el operador anota, cruza con otro registro o pone en
 * un informe; el relativo es lo que le dice si el dato está fresco. Van juntos
 * porque responden preguntas distintas y ninguno reemplaza al otro.
 *
 * `ahoraMs` viene del hook useAhora: el relativo se recalcula en el cliente y
 * envejece solo entre refrescos de datos, en vez de quedar congelado.
 */
export function formatearMomento(
  timestamp: string | Date | null | undefined,
  t: any,
  ahoraMs: number,
): string {
  if (!timestamp) return t('map.no_position');
  const ts = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(ts.getTime())) return t('map.no_position');

  const segundos = Math.max(0, Math.floor((ahoraMs - ts.getTime()) / 1000));
  return `${ts.toLocaleString()} (${formatearAntiguedad(segundos, t)})`;
}
