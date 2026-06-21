import i18n from '../i18n/config';

/**
 * Central label dictionary — converts raw database keys to human-readable labels.
 * Use these functions across the entire application so that users NEVER see raw DB identifiers.
 */

// ─── Alert / Event Types ───────────────────────────────────────────────────────

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
  
  if (roleStr.includes('admin')) return i18n.t('labels.roles.admin');
  if (roleStr.includes('manager')) return i18n.t('labels.roles.manager');
  if (roleStr.includes('operator')) return i18n.t('labels.roles.operator');
  if (roleStr.includes('viewer')) return i18n.t('labels.roles.viewer');
  if (roleStr.includes('owner')) return i18n.t('labels.roles.owner');
  
  return rawRole.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
