import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // 1. Roles del sistema con permisos granulares
  // Nomenclatura: misma que SYSTEM_PERMISSIONS en el frontend (permissions.ts)
  const roles = [
    {
      code: 'rusertech_admin',
      name: 'Rusertech Super Admin',
      is_system_role: true,
      permissions: [
        // Acceso total a todos los módulos
        'view_map', 'view_alerts', 'manage_alerts', 'view_trips', 'manage_trips',
        'view_vehicles', 'manage_vehicles', 'view_devices', 'manage_devices',
        'view_carriers', 'manage_carriers', 'view_drivers', 'manage_drivers',
        'view_locations', 'manage_locations', 'view_avl', 'manage_avl',
        'view_sensors', 'manage_sensors', 'view_analytics', 'view_carbon', 'manage_carbon',
        'view_simulator', 'use_simulator', 'view_settings', 'manage_settings',
        'manage_users', 'admin_global',
        // Settings exclusivos del master
        'settings_billing', 'settings_system', 'settings_maintenance',
        'settings_general', 'settings_ui', 'settings_localization',
        'settings_notifications', 'settings_security', 'settings_avl',
        'settings_maps', 'settings_integrations', 'settings_smtp',
        'settings_webhooks', 'settings_sensors', 'settings_carbon',
      ],
    },
    {
      code: 'account_owner',
      name: 'Dueño de Cuenta (Owner)',
      is_system_role: true,
      permissions: [
        // Acceso completo a operaciones de su tenant
        'view_map', 'view_alerts', 'manage_alerts', 'view_trips', 'manage_trips',
        'view_vehicles', 'manage_vehicles', 'view_devices', 'manage_devices',
        'view_carriers', 'manage_carriers', 'view_drivers', 'manage_drivers',
        'view_locations', 'manage_locations', 'view_avl', 'manage_avl',
        'view_sensors', 'manage_sensors', 'view_analytics', 'view_carbon', 'manage_carbon',
        'view_simulator', 'use_simulator', 'view_settings', 'manage_settings',
        'manage_users',
        // Settings disponibles (NO billing, system, maintenance — solo rusertech_admin)
        'settings_general', 'settings_ui', 'settings_localization',
        'settings_notifications', 'settings_security', 'settings_avl',
        'settings_maps', 'settings_integrations', 'settings_smtp',
        'settings_webhooks', 'settings_sensors', 'settings_carbon',
      ],
    },
    {
      code: 'manager',
      name: 'Gerente / Jefe de Flota',
      is_system_role: true,
      permissions: [
        // Gestión operativa completa, sin administración de cuenta
        'view_map', 'view_alerts', 'manage_alerts', 'view_trips', 'manage_trips',
        'view_vehicles', 'manage_vehicles', 'view_devices',
        'view_carriers', 'manage_carriers', 'view_drivers', 'manage_drivers',
        'view_locations', 'manage_locations', 'view_avl',
        'view_sensors', 'view_analytics', 'view_carbon',
        'view_simulator', 'view_settings',
        // Settings limitados
        'settings_general', 'settings_ui', 'settings_localization',
        'settings_notifications', 'settings_avl', 'settings_maps', 'settings_sensors',
      ],
    },
    {
      code: 'operator',
      name: 'Operador de Monitoreo',
      is_system_role: true,
      permissions: [
        // Monitoreo y gestión de viajes, sin acceso a config
        'view_map', 'view_alerts', 'manage_alerts', 'view_trips', 'manage_trips',
        'view_vehicles', 'view_carriers', 'view_drivers', 'manage_drivers',
        'view_locations', 'view_sensors', 'view_analytics',
      ],
    },
    {
      code: 'viewer',
      name: 'Viewer / Auditor (Solo Lectura)',
      is_system_role: true,
      permissions: [
        // Lectura pura, sin modificar nada
        'view_map', 'view_alerts', 'view_trips',
        'view_vehicles', 'view_carriers', 'view_drivers',
        'view_locations', 'view_analytics',
      ],
    },
    {
      code: 'driver',
      name: 'Conductor (App Móvil)',
      is_system_role: true,
      permissions: [
        // Mínimo: solo ve sus viajes y el mapa
        'view_map', 'view_trips',
      ],
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, permissions: role.permissions },
      create: role,
    });
  }
  console.log('Roles seeded with granular permissions.');


  // 2. Tenant Demo
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Rusertech Demo',
      slug: 'demo',
      plan: 'pro',
    },
  });
  console.log('Tenant demo seeded.');

  // 3. Demo users — 1 per role
  // Passwords are stored hashed; plaintext for display/reference is listed here:
  //   admin@rusertech.com      -> Gusta_Rusertech86   (rusertech_admin)
  //   owner@rusertech.com      -> Owner@Demo2024      (account_owner)
  //   manager@rusertech.com    -> Manager@Demo2024    (manager)
  //   operator@rusertech.com   -> Operator@Demo2024   (operator)
  //   viewer@rusertech.com     -> Viewer@Demo2024     (viewer)
  //   driver@rusertech.com     -> Driver@Demo2024     (driver)

  const demoUsers = [
    {
      email: 'admin@rusertech.com',
      password_hash: '$2b$10$V6ZGhkwuyv9hUVWs3qpTa.ocDTGCoqzHM77mqUClSX1IfOHWPphJC', // Gusta_Rusertech86
      full_name: 'Admin Master',
      role_code: 'rusertech_admin',
    },
    {
      email: 'owner@rusertech.com',
      password_hash: '$2b$10$DeX3qOUiDQbUXTebLPS0JO3CReTf8mtCNgUNnFOeChg0mlLfdkaG6', // Owner@Demo2024
      full_name: 'Owner Demo',
      role_code: 'account_owner',
    },
    {
      email: 'manager@rusertech.com',
      password_hash: '$2b$10$/U.9r0bPIjUbfP58P8QnYeHqv5MJ6bhpp1oQ8D.Zpijs/hBPIyuaq', // Manager@Demo2024
      full_name: 'Manager Demo',
      role_code: 'manager',
    },
    {
      email: 'operator@rusertech.com',
      password_hash: '$2b$10$VOx98JKCcVTKDkyZ97zZ1eiwKV.I4xdYS2BNt1LRKGIDtY9jXS9Ae', // Operator@Demo2024
      full_name: 'Operador Demo',
      role_code: 'operator',
    },
    {
      email: 'viewer@rusertech.com',
      password_hash: '$2b$10$yotY.f.TRp2BISiqLfQ4nebVgK7GCoGP9mM4X8M1jw.Bwsr9UPoRW', // Viewer@Demo2024
      full_name: 'Viewer Demo',
      role_code: 'viewer',
    },
    {
      email: 'driver@rusertech.com',
      password_hash: '$2b$10$ahmesSGDdn0qla3fKKnRn.jPY5qP0o9rtAus.Oxbm3NGXsFwqghIe', // Driver@Demo2024
      full_name: 'Conductor Demo',
      role_code: 'driver',
    },
  ];

  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        tenant_id: tenant.id,
        email: u.email,
        password_hash: u.password_hash,
        full_name: u.full_name,
        role_code: u.role_code,
        status: 'active',
      },
    });
  }
  console.log('Demo users seeded (1 per role).');

  // 4. AVL User Demo — usando clave compuesta correcta
  let avlUser: any;
  try {
    avlUser = await prisma.avlUser.upsert({
      where: {
        tenant_id_user_avl_code: {
          tenant_id: tenant.id,
          user_avl_code: 'demo_avl_01',
        },
      },
      update: {},
      create: {
        tenant_id: tenant.id,
        user_avl_code: 'demo_avl_01',
        name: 'AVL Demo',
        api_key: 'demo-key-12345',
      },
    });
    console.log('AVL User seeded.');
  } catch (e) {
    // Si ya existe, buscarlo directamente
    avlUser = await prisma.avlUser.findFirst({ where: { tenant_id: tenant.id } });
    console.log('AVL User already exists, using existing.');
  }

  if (!avlUser) {
    console.log('No AVL User found, skipping dictionary and vehicles.');
  } else {
    // 5. Dictionary for AVL User
    const dictionary = [
      { raw_code: '01', event_type: 'ignition_on', description: 'Ignición Encendida', severity: 'info' },
      { raw_code: '02', event_type: 'ignition_off', description: 'Ignición Apagada', severity: 'info' },
      { raw_code: '03', event_type: 'speed_exceeded', description: 'Exceso de Velocidad', severity: 'warning', triggers_alert: true },
    ];

    for (const dict of dictionary) {
      try {
        await prisma.avlEventDictionary.upsert({
          where: {
            avl_user_id_category_raw_code: {
              avl_user_id: avlUser.id,
              category: 'default',
              raw_code: dict.raw_code,
            },
          },
          update: {},
          create: {
            avl_user_id: avlUser.id,
            category: 'default',
            raw_code: dict.raw_code,
            event_type: dict.event_type,
            description: dict.description,
            severity: dict.severity,
            triggers_alert: (dict as any).triggers_alert ?? false,
          },
        });
      } catch (_) { /* already exists */ }
    }
    console.log('AVL Dictionary seeded.');

    // 6. Vehicles DEMO001 and DEMO002
    const vehicles = [
      { plate: 'DEMO-001', alias: 'Camión 01', hub_asset_id: 'DEMO001' },
      { plate: 'DEMO-002', alias: 'Camión 02', hub_asset_id: 'DEMO002' },
    ];

    for (const v of vehicles) {
      try {
        await prisma.vehicle.upsert({
          where: { tenant_id_plate: { tenant_id: tenant.id, plate: v.plate } },
          update: {},
          create: {
            tenant_id: tenant.id,
            plate: v.plate,
            alias: v.alias,
            hub_asset_id: v.hub_asset_id,
            avl_user_id: avlUser.id,
            vehicle_type: 'truck',
            fuel_type: 'diesel',
          },
        });
      } catch (_) { /* already exists */ }
    }
    console.log('Vehicles seeded.');
  }

  // 7. Carbon Settings
  await prisma.carbonSetting.upsert({
    where: { tenant_id: tenant.id },
    update: {},
    create: { tenant_id: tenant.id, use_climatiq_api: false },
  });
  console.log('Carbon settings seeded.');

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
