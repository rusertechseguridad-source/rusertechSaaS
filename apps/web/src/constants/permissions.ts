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
  admin_global: 'Acceso Super Admin'
};

export type PermissionKey = keyof typeof SYSTEM_PERMISSIONS;
export const PERMISSION_LIST = Object.entries(SYSTEM_PERMISSIONS).map(([key, label]) => ({ key, label }));
