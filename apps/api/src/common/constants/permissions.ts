/**
 * CATÁLOGO CANÓNICO DE PERMISOS — fuente de verdad del backend.
 *
 * Formato: `accion_recurso` (ej. `manage_vehicles`). Es el formato que ya vive
 * en la tabla `roles`, en el claim `permissions` del JWT y en la pantalla de
 * administración de roles, así que es el que se conserva.
 *
 * El espejo de este catálogo en el frontend es `apps/web/src/constants/permissions.ts`.
 * Ambos deben tener exactamente las mismas claves: si se agrega un permiso acá,
 * hay que agregarlo allá (y darlo de alta en el seed de roles que corresponda).
 *
 * Antes de esta unificación convivían tres formatos (`vehicles:manage` en los
 * decoradores, `manage_vehicles` en la base, y una mezcla de ambos en el
 * frontend). Como `PermissionsGuard` compara strings exactos, ninguna escritura
 * llegaba a autorizarse nunca.
 */
export const SYSTEM_PERMISSIONS = {
  view_map: 'Ver Mapa Global',
  view_alerts: 'Ver Alertas',
  manage_alerts: 'Administrar Alertas',
  view_trips: 'Ver Viajes',
  manage_trips: 'Administrar Viajes',
  view_vehicles: 'Ver Vehículos',
  manage_vehicles: 'Administrar Vehículos',
  view_devices: 'Ver Dispositivos',
  manage_devices: 'Administrar Dispositivos',
  view_carriers: 'Ver Transportistas',
  manage_carriers: 'Administrar Transportistas',
  view_drivers: 'Ver Conductores',
  manage_drivers: 'Administrar Conductores',
  view_locations: 'Ver Ubicaciones (Zonas, Rutas)',
  manage_locations: 'Administrar Ubicaciones',
  view_avl: 'Ver Módulo AVL',
  manage_avl: 'Administrar Módulo AVL',
  view_sensors: 'Ver Sensores (Clima)',
  manage_sensors: 'Administrar Sensores',
  view_analytics: 'Ver Reportes y Analytics',
  view_carbon: 'Ver Huella de Carbono',
  manage_carbon: 'Administrar Huella de Carbono',
  view_simulator: 'Ver Simulador',
  use_simulator: 'Operar Simulador',
  view_settings: 'Ver Configuración de Empresa',
  manage_settings: 'Administrar Configuración de Empresa',
  manage_users: 'Administrar Usuarios',
  admin_global: 'Acceso Super Admin',
} as const;

/** Clave válida de permiso. Los decoradores sólo aceptan estas claves. */
export type PermissionKey = keyof typeof SYSTEM_PERMISSIONS;

/** Lista de claves, útil para validaciones en runtime. */
export const PERMISSION_KEYS = Object.keys(SYSTEM_PERMISSIONS) as PermissionKey[];

/**
 * Comodín histórico: un rol con `*` pasa cualquier chequeo de permisos.
 * Ningún rol del seed lo usa — el acceso total se expresa con el rol
 * `rusertech_admin` (ver ADMIN_ROLES) o con la lista completa de permisos.
 */
export const WILDCARD_PERMISSION = '*';
