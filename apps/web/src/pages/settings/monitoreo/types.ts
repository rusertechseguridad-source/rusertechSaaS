/**
 * Umbrales de monitoreo del tenant.
 *
 * Espejo de `UmbralesMonitoreo` en
 * `apps/api/src/common/monitoring/monitoring-config.service.ts` y de la tabla
 * `tenant_monitoring_config`. Si se agrega un campo, hay que agregarlo en los
 * tres lugares.
 */
export interface MonitoreoSettings {
  /** Hasta cuántos minutos sin reportar un vehículo se considera "en vivo". */
  umbral_en_vivo_minutos: number;
  /** Hasta cuántos minutos se considera "inactivo". Después, "sin señal". */
  umbral_inactivo_minutos: number;
  /** Cuánto hacia atrás mira el mapa para buscar la última posición. */
  ventana_mapa_horas: number;
}

/**
 * Límites aceptados, replicados de los CHECK de la base.
 *
 * `ventana_mapa_horas` no llega a 168 por gusto: `telemetry` está particionada
 * por mes y la consulta usa un rango cerrado para que Postgres pode
 * particiones. Una ventana de 7 días cruza dos particiones como máximo.
 */
export const LIMITES_MONITOREO = {
  umbral_en_vivo_minutos: { min: 1, max: 120 },
  umbral_inactivo_minutos: { min: 2, max: 720 },
  ventana_mapa_horas: { min: 1, max: 168 },
} as const;

export const MONITOREO_POR_DEFECTO: MonitoreoSettings = {
  umbral_en_vivo_minutos: 5,
  umbral_inactivo_minutos: 30,
  ventana_mapa_horas: 24,
};
