import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // 1. Roles
  const roles = [
    { code: 'rusertech_admin', name: 'Rusertech SuperAdmin', is_system_role: true, permissions: ['*'] },
    { code: 'account_owner', name: 'Dueño de Cuenta', is_system_role: false, permissions: ['tenant:manage', 'billing:read'] },
    { code: 'manager', name: 'Gerente / Jefe de Flota', is_system_role: false, permissions: ['vehicles:manage', 'trips:manage'] },
    { code: 'operator', name: 'Operador de Monitoreo', is_system_role: false, permissions: ['trips:read', 'telemetry:read'] },
    { code: 'viewer', name: 'Cliente / Viewer', is_system_role: false, permissions: ['trips:read'] },
    { code: 'driver', name: 'Chofer (App Móvil)', is_system_role: false, permissions: ['trips:update_status'] },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {},
      create: role,
    });
  }
  console.log('Roles seeded.');

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

  // 3. User Admin
  await prisma.user.upsert({
    where: { email: 'admin@rusertech.com' },
    update: {
      password_hash: '$2b$10$V6ZGhkwuyv9hUVWs3qpTa.ocDTGCoqzHM77mqUClSX1IfOHWPphJC', // Hashed Gusta_Rusertech86
    },
    create: {
      tenant_id: tenant.id,
      email: 'admin@rusertech.com',
      password_hash: '$2b$10$V6ZGhkwuyv9hUVWs3qpTa.ocDTGCoqzHM77mqUClSX1IfOHWPphJC', // Hashed Gusta_Rusertech86
      full_name: 'Admin Demo',
      role_code: 'rusertech_admin',
    },
  });
  console.log('User admin seeded.');

  // 4. AVL User Demo
  const avlUser = await prisma.avlUser.upsert({
    where: { api_key: 'demo-key-12345' },
    update: {},
    create: {
      tenant_id: tenant.id,
      user_avl_code: 'demo_avl_01',
      name: 'AVL Demo',
      api_key: 'demo-key-12345',
    },
  });
  console.log('AVL User seeded.');

  // 5. Dictionary for AVL User
  const dictionary = [
    { raw_code: '01', event_type: 'ignition_on', description: 'Ignición Encendida', severity: 'info' },
    { raw_code: '02', event_type: 'ignition_off', description: 'Ignición Apagada', severity: 'info' },
    { raw_code: '03', event_type: 'speed_exceeded', description: 'Exceso de Velocidad', severity: 'warning', triggers_alert: true },
  ];

  for (const dict of dictionary) {
    await prisma.avlEventDictionary.upsert({
      where: {
        avl_user_id_raw_code: {
          avl_user_id: avlUser.id,
          raw_code: dict.raw_code,
        },
      },
      update: {},
      create: {
        avl_user_id: avlUser.id,
        raw_code: dict.raw_code,
        event_type: dict.event_type,
        description: dict.description,
        severity: dict.severity,
        triggers_alert: dict.triggers_alert ?? false,
      },
    });
  }
  console.log('AVL Dictionary seeded.');

  // 6. Vehicles DEMO001 and DEMO002
  const vehicles = [
    { plate: 'DEMO-001', alias: 'Camión 01', hub_asset_id: 'DEMO001' },
    { plate: 'DEMO-002', alias: 'Camión 02', hub_asset_id: 'DEMO002' },
  ];

  for (const v of vehicles) {
    await prisma.vehicle.upsert({
      where: {
        tenant_id_plate: {
          tenant_id: tenant.id,
          plate: v.plate,
        },
      },
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
  }
  console.log('Vehicles seeded.');

  // 7. Carbon Settings
  await prisma.carbonSetting.upsert({
    where: { tenant_id: tenant.id },
    update: {},
    create: {
      tenant_id: tenant.id,
      use_climatiq_api: false,
    },
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
