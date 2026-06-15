const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Ruta aproximada Buenos Aires → Rosario
const routeCoords = [
  { lat: -34.6037, lng: -58.3816, address: 'Buenos Aires, CABA', speed: 0 },
  { lat: -34.4553, lng: -58.5820, address: 'General San Martín, Buenos Aires', speed: 85 },
  { lat: -34.3504, lng: -58.7285, address: 'Pilar, Buenos Aires', speed: 92 },
  { lat: -34.2145, lng: -58.9812, address: 'Campana, Buenos Aires', speed: 105 },
  { lat: -33.9200, lng: -59.2300, address: 'Zárate, Buenos Aires', speed: 88 },
  { lat: -33.7400, lng: -59.6500, address: 'San Pedro, Buenos Aires', speed: 97 },
  { lat: -33.5100, lng: -59.9800, address: 'Baradero, Buenos Aires', speed: 102 },
  { lat: -33.2800, lng: -60.2100, address: 'San Nicolás, Buenos Aires', speed: 94 },
  { lat: -33.1200, lng: -60.5600, address: 'Ramallo, Buenos Aires', speed: 115 },
  { lat: -32.9465, lng: -60.6300, address: 'Rosario, Santa Fe', speed: 45 },
];

async function main() {
  const tenantId = '153c1430-9155-45fb-bf92-5aec92a1804b';
  const trip1Id = '170b4713-3bf0-4743-84fe-0417c27cc8f2';
  const trip2Id = '3b54cac7-bb2d-440e-9d21-117e0ebb0673';

  // 1. Carrier
  let carrier = await prisma.carrier.findFirst({ where: { tenant_id: tenantId, name: 'Transportes Rusertech S.A.' } });
  if (!carrier) {
    carrier = await prisma.carrier.create({
      data: {
        tenant_id: tenantId,
        name: 'Transportes Rusertech S.A.',
        tax_id: '30-12345678-9',
        contact_name: 'Carlos Méndez',
        contact_phone: '+54 341 123-4567',
        contact_email: 'contacto@transrusertech.com',
        address: 'Av. Francia 1234, Rosario',
        status: 'active',
      }
    });
    console.log('Carrier creado:', carrier.id);
  } else {
    console.log('Carrier existente:', carrier.id);
  }

  // 2. Driver
  let driver = await prisma.driver.findFirst({ where: { tenant_id: tenantId, document: '28456789' } });
  if (!driver) {
    driver = await prisma.driver.create({
      data: {
        tenant_id: tenantId,
        full_name: 'Juan Pérez',
        document: '28456789',
        license_number: 'B-4567890',
        license_expiry: new Date('2027-06-30'),
        phone: '+54 11 4567-8901',
        carrier_id: carrier.id,
        status: 'active',
      }
    });
    console.log('Driver creado:', driver.id);
  } else {
    console.log('Driver existente:', driver.id);
  }

  // 3. Assign driver to both trips
  await prisma.trip.update({ where: { id: trip1Id }, data: { driver_id: driver.id } });
  await prisma.trip.update({ where: { id: trip2Id }, data: { driver_id: driver.id } });
  console.log('Trips actualizados con driver');

  // 4. Delete existing events for clean state
  await prisma.tripEvent.deleteMany({ where: { trip_id: trip2Id } });
  await prisma.tripEvent.deleteMany({ where: { trip_id: trip1Id } });
  console.log('Eventos anteriores eliminados');

  const now = new Date();

  // 5. Inject telemetry into trip2 (EN_CURSO) - full route
  for (let i = 0; i < routeCoords.length; i++) {
    const coord = routeCoords[i];
    const eventTime = new Date(now.getTime() - (routeCoords.length - i) * 15 * 60 * 1000);
    const isSpeedAlert = coord.speed > 110;
    const isTempAlert = i === 6;

    await prisma.tripEvent.create({
      data: {
        tenant_id: tenantId,
        trip_id: trip2Id,
        event_type: isSpeedAlert ? 'speed_exceeded' : isTempAlert ? 'temperature_alert' : 'position',
        severity: (isSpeedAlert || isTempAlert) ? 'warning' : 'info',
        timestamp: eventTime,
        latitude: coord.lat,
        longitude: coord.lng,
        metadata_json: {
          speed: coord.speed,
          address: coord.address,
          temperature_c: parseFloat((Math.random() * 6 + 2).toFixed(1)),
          humidity_pct: Math.round(Math.random() * 30 + 40),
          alert_message: isSpeedAlert
            ? `Velocidad excedida: ${coord.speed} km/h (límite: 110 km/h)`
            : isTempAlert
            ? 'Temperatura fuera de rango: 9.5°C (máx: 8°C)'
            : null,
        }
      }
    });
  }
  console.log('10 eventos inyectados en trip2 (EN_CURSO)');

  // 6. Inject telemetry into trip1 (PROGRAMADO) - partial route, 4 events
  for (let i = 0; i < 4; i++) {
    const coord = routeCoords[i];
    const eventTime = new Date(now.getTime() - (4 - i) * 30 * 60 * 1000);
    await prisma.tripEvent.create({
      data: {
        tenant_id: tenantId,
        trip_id: trip1Id,
        event_type: 'position',
        severity: 'info',
        timestamp: eventTime,
        latitude: coord.lat,
        longitude: coord.lng,
        metadata_json: {
          speed: coord.speed,
          address: coord.address,
          temperature_c: parseFloat((Math.random() * 4 + 3).toFixed(1)),
          humidity_pct: Math.round(Math.random() * 20 + 45),
          alert_message: null,
        }
      }
    });
  }
  console.log('4 eventos inyectados en trip1 (PROGRAMADO)');

  await prisma.$disconnect();
  console.log('\n✅ DONE! Datos de prueba inyectados correctamente.');
}
main().catch(e => { console.error(e); process.exit(1); });
