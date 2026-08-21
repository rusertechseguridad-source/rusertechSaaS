import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found');
  const user = await prisma.user.findFirst();
  if (!user) throw new Error('No user found');

  console.log('Cleaning up old trips and events...');
  await prisma.tripRiskHistory.deleteMany({});
  await prisma.tripRiskLevel.deleteMany({});
  await prisma.tripEvent.deleteMany({});
  await prisma.eventLog.deleteMany({});
  await prisma.telemetry.deleteMany({});
  await prisma.trip.deleteMany({});

  console.log('Creating demo data...');
  const carrier = await prisma.carrier.findFirst() || await prisma.carrier.create({
    data: { tenant_id: tenant.id, name: 'Logistica Global S.A.' }
  });

  const coords = [
    { lat: -34.6037, lng: -58.3816 }, // BA
    { lat: -32.9442, lng: -60.6505 }, // Rosario
    { lat: -31.4201, lng: -64.1888 }, // Cordoba
    { lat: -32.8894, lng: -68.8458 }, // Mendoza
    { lat: -26.8241, lng: -65.2226 }  // Tucuman
  ];

  for(let i=0; i<5; i++) {
    const v = await prisma.vehicle.create({
      data: { tenant_id: tenant.id, plate: `DEMO${i}XX`, carrier_id: carrier.id }
    });
    
    const d = await prisma.driver.create({
      data: { tenant_id: tenant.id, full_name: `Chofer Demo ${i}`, carrier_id: carrier.id }
    });

    const trip = await prisma.trip.create({
      data: {
        tenant_id: tenant.id,
        created_by_user_id: user.id,
        name: `Ruta Especial ${i}`,
        status: 'EN_CURSO',
        vehicle_id: v.id,
        driver_id: d.id,
        origin_lat: coords[i].lat,
        origin_lng: coords[i].lng,
        destination_lat: coords[(i+1)%5].lat,
        destination_lng: coords[(i+1)%5].lng,
        planned_start: new Date(),
        planned_end: new Date(Date.now() + 86400000)
      }
    });

    // Device telemetry (simulated positions)
    await prisma.telemetry.create({
      data: {
        tenant_id: tenant.id,
        vehicle_id: v.id,
        avl_user_id: '00000000-0000-0000-0000-000000000000', // Mock
        latitude: coords[i].lat,
        longitude: coords[i].lng,
        speed_kmh: 80,
        heading_degrees: 90,
        ignition: true,
        timestamp: new Date(),
        raw_payload: {}
      }
    }).catch(() => {});

    // Create some simulated active alarms (EventLogs)
    if (i % 2 === 0) { // Some trips have alarms
      await prisma.eventLog.create({
        data: {
          tenant_id: tenant.id,
          vehicle_id: v.id,
          trip_id: trip.id,
          event_type: 'panic_button',
          severity: 'critical',
          status: 'open',
          latitude: coords[i].lat,
          longitude: coords[i].lng,
          metadata_json: { details: 'Botón de pánico presionado por el chofer' }
        }
      });
      // also set trip risk
      await prisma.tripRiskLevel.upsert({
        where: { trip_id: trip.id },
        update: { risk_level: 'riesgo_critico', risk_score: 90 },
        create: {
          trip_id: trip.id,
          tenant_id: tenant.id,
          risk_level: 'riesgo_critico',
          risk_score: 90
        }
      });
    }
  }

  console.log('Done! Created 5 vehicles, 5 trips, and 3 active alarms.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
