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
  return t('map.ago_hours', { n: Math.floor(segundos / 3600) });
}

/** Etiqueta traducida de una frescura. */
export function etiquetaFrescura(frescura: Frescura, t: any): string {
  return t(FRESCURA_I18N[frescura]);
}
