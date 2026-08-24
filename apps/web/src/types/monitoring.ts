import type { Frescura } from '../constants/freshness';

/**
 * CONTRATO DE MONITOREO EN VIVO — espejo del backend.
 *
 * Fuente: `apps/api/src/common/live-positions/live-positions.service.ts`.
 * Si cambia una forma allá, cambia acá. Vive en `types/` y no dentro del mapa
 * porque hoy lo consumen el mapa global, el detalle de viaje y cualquier
 * pantalla futura que necesite saber dónde está un vehículo.
 */

/** Quién escribió el punto en `telemetry`. */
export type OrigenPosicion = 'movil' | 'hub';

/** Última posición conocida de un vehículo. */
export interface LivePosition {
  vehicle_id: string;
  plate: string | null;
  alias: string | null;
  timestamp: string;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  heading_degrees: number | null;
  ignition: boolean | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  event_type: string | null;
  provider_code: string | null;
  /** Antigüedad del punto en segundos, al momento de la consulta. */
  age_seconds: number;
  freshness: Frescura;
  /** Por qué está en el mapa: reportó desde la app, o transmite por el HUB. */
  origen: OrigenPosicion;
  /** Si el vehículo tiene un viaje declarado EN_CURSO. */
  con_viaje_activo: boolean;
  source: 'postgres' | 'redis';
}

/** Resumen de la flota en alcance de monitoreo, calculado por el backend. */
export interface MonitoringSummary {
  en_vivo: number;
  inactivo: number;
  sin_senal: number;
  con_posicion: number;
  /** Vehículos con viaje EN_CURSO y sin ningún punto en la ventana. */
  sin_datos: number;
  total_en_alcance: number;
}

/** Umbrales configurados por el tenant. La UI los muestra para explicarse. */
export interface MonitoringThresholds {
  umbral_en_vivo_minutos: number;
  umbral_inactivo_minutos: number;
  ventana_mapa_horas: number;
}

/** Respuesta completa de `GET /api/v1/vehicles/live`. */
export interface LiveResponse {
  positions: LivePosition[];
  summary: MonitoringSummary;
  thresholds: MonitoringThresholds;
}

export const SUMMARY_VACIO: MonitoringSummary = {
  en_vivo: 0, inactivo: 0, sin_senal: 0, con_posicion: 0, sin_datos: 0, total_en_alcance: 0,
};

/**
 * Umbrales de respaldo mientras la primera consulta está en vuelo.
 * Son los mismos valores por defecto del backend; si el tenant tiene otros,
 * llegan en la respuesta y reemplazan a estos.
 */
export const THRESHOLDS_POR_DEFECTO: MonitoringThresholds = {
  umbral_en_vivo_minutos: 5, umbral_inactivo_minutos: 30, ventana_mapa_horas: 24,
};
