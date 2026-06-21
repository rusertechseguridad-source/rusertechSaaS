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
  
  // If the translation exists in i18n, return it. Otherwise return a formatted raw string.
  const translated = i18n.t(`labels.alert_types.${rawType}`, { defaultValue: '' });
  if (translated) return translated;
  
  return rawType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase());
}

// ─── System Parameter Keys ────────────────────────────────────────────────────

export function translateParameterKey(rawKey: string | undefined | null): string {
  if (!rawKey) return 'Desconocido';
  
  const translated = i18n.t(`labels.params.${rawKey}`, { defaultValue: '' });
  if (translated) return translated;

  return rawKey
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase());
}

// ─── Role names ───────────────────────────────────────────────────────────────

export function translateRole(rawRole: string | undefined | null): string {
  if (!rawRole) return '—';
  const roleStr = rawRole.toLowerCase();
  if (roleStr.includes('admin')) return 'Administrador';
  if (roleStr.includes('manager')) return 'Gerente / Manager';
  if (roleStr.includes('operator')) return 'Operador';
  if (roleStr.includes('viewer')) return 'Auditor (Solo Lectura)';
  if (roleStr.includes('owner')) return 'Dueño de Cuenta';
  return rawRole.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
