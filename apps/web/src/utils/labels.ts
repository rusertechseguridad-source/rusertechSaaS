/**
 * Central label dictionary — converts raw database keys to human-readable labels.
 * Use these functions across the entire application so that users NEVER see raw DB identifiers.
 */

// ─── Alert / Event Types ───────────────────────────────────────────────────────
const ALERT_TYPE_LABELS: Record<string, string> = {
  SPEED_VIOLATION:      'Exceso de Velocidad',
  OVERSPEED:            'Exceso de Velocidad',
  HARSH_ACCELERATION:   'Aceleración Brusca',
  HARSH_BRAKING:        'Frenada Brusca',
  HARSH_CORNERING:      'Giro Brusco',
  JAMMING:              'Interferencia de Señal',
  SIGNAL_LOST:          'Señal Perdida',
  SIGNAL_RESTORED:      'Señal Restaurada',
  GEOFENCE_ENTER:       'Entrada a Geocerca',
  GEOFENCE_EXIT:        'Salida de Geocerca',
  POWER_CUT:            'Corte de Corriente',
  POWER_RESTORED:       'Corriente Restaurada',
  TEMPERATURE_HIGH:     'Temperatura Alta',
  TEMPERATURE_LOW:      'Temperatura Baja',
  PANIC_BUTTON:         'Botón de Pánico',
  FUEL_DROP:            'Caída de Combustible',
  REFUELING:            'Repostaje de Combustible',
  FATIGUE:              'Alerta de Fatiga',
  DISTRACTION:          'Alerta de Distracción',
  DOOR_OPEN:            'Apertura de Puerta',
  DOOR_CLOSE:           'Cierre de Puerta',
  ENGINE_ON:            'Motor Encendido',
  ENGINE_OFF:           'Motor Apagado',
  TRAILER_CONNECT:      'Remolque Conectado',
  TRAILER_DISCONNECT:   'Remolque Desconectado',
  BATTERY_LOW:          'Batería Baja',
  POSITION:             'Posición',
  IDLE:                 'Inactividad',
  IDLING:               'Inactividad',
  TOWING:               'Remolque Detectado',
  IMPACT:               'Impacto Detectado',
};

export function translateAlertType(rawType: string | undefined | null): string {
  if (!rawType) return '—';
  const key = rawType.toUpperCase().trim();
  return ALERT_TYPE_LABELS[key] ?? rawType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── System Parameter Keys ────────────────────────────────────────────────────
const PARAMETER_LABELS: Record<string, string> = {
  ALERT_EMAIL_SENDER:          'Remitente de Alertas por Email',
  DEFAULT_LANGUAGE:            'Idioma por Defecto',
  DEFAULT_TIMEZONE:            'Zona Horaria por Defecto',
  DISTANCE_UNIT:               'Unidad de Distancia',
  SPEED_UNIT:                  'Unidad de Velocidad',
  VOLUME_UNIT:                 'Unidad de Volumen',
  GPS_DRIFT_FILTER_METERS:     'Filtro de Deriva GPS (metros)',
  IDLING_TIMEOUT_MIN:          'Tiempo de Inactividad (minutos)',
  MAP_DEFAULT_CENTER:          'Centro Inicial del Mapa',
  MAP_DEFAULT_ZOOM:            'Zoom Inicial del Mapa',
  MIN_GPS_REPORT_INTERVAL_SEC: 'Intervalo Mínimo de Reporte GPS (seg)',
  OFFLINE_DEVICE_TIMEOUT_MIN:  'Tiempo para Dispositivo Offline (min)',
  OVERSPEED_TOLERANCE_KPH:     'Tolerancia de Velocidad (km/h)',
  SESSION_TIMEOUT_MINUTES:     'Tiempo de Sesión (minutos)',
  TELEMETRY_RETENTION_DAYS:    'Retención de Telemetría (días)',
};

export function translateParameterKey(rawKey: string | undefined | null): string {
  if (!rawKey) return '—';
  const key = rawKey.toUpperCase().trim();
  return PARAMETER_LABELS[key] ?? rawKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Role names ───────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  rusertech_admin: 'Administrador Rusertech',
  admin_master:    'Administrador Master',
  account_owner:   'Dueño de Cuenta',
  manager:         'Gerente / Jefe de Flota',
  operator:        'Operador de Monitoreo',
  viewer:          'Auditor (Solo Lectura)',
  driver:          'Conductor',
};

export function translateRole(rawRole: string | undefined | null): string {
  if (!rawRole) return '—';
  return ROLE_LABELS[rawRole] ?? rawRole.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
