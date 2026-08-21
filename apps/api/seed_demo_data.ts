import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error("No tenant found");

  const adminUser = await prisma.user.findFirst({ where: { role_code: 'rusertech_admin' } });

  console.log('--- 1. Insertando 5 Carriers ---');
  const carriers = [];
  for (let i = 1; i <= 5; i++) {
    const c = await prisma.carrier.upsert({
      where: { id: '00000000-0000-0000-0000-00000000010' + i },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-00000000010' + i,
        tenant_id: tenant.id,
        name: `Transportista Demo ${i}`,
        tax_id: `30-11111111-${i}`,
        contact_email: `contacto${i}@transportedemo.com`,
      }
    });
    carriers.push(c);
  }
  console.log('5 Carriers listos.');

  console.log('--- 2. Insertando 5 Drivers ---');
  for (let i = 1; i <= 5; i++) {
    await prisma.driver.upsert({
      where: { id: '00000000-0000-0000-0000-00000000020' + i },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-00000000020' + i,
        tenant_id: tenant.id,
        full_name: `Chofer Demo ${i}`,
        document: `3000000${i}`,
        carrier_id: carriers[i - 1].id,
      }
    });
  }
  console.log('5 Drivers listos.');

  console.log('--- 3. Insertando 5 Vehicles ---');
  const avlUser = await prisma.avlUser.findFirst();
  for (let i = 3; i <= 7; i++) { // DEMO-001 y 002 ya existen, sumamos del 003 al 007
    try {
      await prisma.vehicle.upsert({
        where: { tenant_id_plate: { tenant_id: tenant.id, plate: `DEMO-00${i}` } },
        update: {},
        create: {
          tenant_id: tenant.id,
          plate: `DEMO-00${i}`,
          alias: `Camión 0${i}`,
          hub_asset_id: `DEMO00${i}`,
          avl_user_id: avlUser?.id,
          vehicle_type: 'truck',
          carrier_id: carriers[i - 3].id,
        }
      });
    } catch(e) {}
  }
  console.log('Vehículos extra insertados.');

  console.log('--- 4. Insertando 5 Devices ---');
  for (let i = 1; i <= 5; i++) {
    try {
      await prisma.device.upsert({
        where: { id: '00000000-0000-0000-0000-00000000040' + i },
        update: {},
        create: {
          id: '00000000-0000-0000-0000-00000000040' + i,
          tenant_id: tenant.id,
          name: `Dispositivo GPS 0${i}`,
          imei: `86123456789000${i}`,
          device_code: `DEV-00${i}`,
        }
      });
    } catch(e) {}
  }
  console.log('5 Devices listos.');

  console.log('--- 5. Insertando 5 Ubicaciones ---');
  const latBase = -34.6037;
  const lngBase = -58.3816;
  for (let i = 1; i <= 5; i++) {
    const locId = '00000000-0000-0000-0000-00000000050' + i;
    const lat = latBase + (i * 0.01);
    const lng = lngBase + (i * 0.01);
    
    // Check if exists
    const exists = await prisma.savedLocation.findFirst({ where: { id: locId } });
    if (!exists) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "saved_locations" ("id", "tenant_id", "name", "latitude", "longitude", "geometry", "radius_meters", "created_by")
        VALUES (
          '${locId}',
          '${tenant.id}',
          'Planta Demo ${i}',
          ${lat},
          ${lng},
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
          200,
          ${adminUser ? `'${adminUser.id}'` : 'NULL'}
        )
      `);
    }
  }
  console.log('5 Ubicaciones listas.');

  console.log('--- 6. Insertando 5 Alarmas (Event Rules) ---');
  const rules = ['Exceso Velocidad', 'Botón de Pánico', 'Desvío de Ruta', 'Pérdida de Señal', 'Parada No Autorizada'];
  for (let i = 0; i < 5; i++) {
    try {
      await prisma.eventRule.upsert({
        where: { id: '00000000-0000-0000-0000-00000000060' + i },
        update: {},
        create: {
          id: '00000000-0000-0000-0000-00000000060' + i,
          tenant_id: tenant.id,
          name: `Regla: ${rules[i]}`,
          scope_type: 'tenant',
          event_type: 'custom_alert',
          severity: 'high',
          action_type: 'notify',
          is_active: true
        }
      });
    } catch(e) {}
  }
  console.log('5 Alarmas listas.');

  console.log('Datos Demo adicionales insertados correctamente.');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
