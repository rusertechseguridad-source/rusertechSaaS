import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Inserting mock data for Analytics & Carbon...');
  
  // Find a tenant
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('No tenant found!');
    process.exit(1);
  }

  // Find a user for created_by
  const user = await prisma.user.findFirst({ where: { tenant_id: tenant.id }});
  if (!user) {
    console.error('No user found!');
    process.exit(1);
  }

  // Find or create vehicles
  let vehicles = await prisma.vehicle.findMany({ where: { tenant_id: tenant.id }, take: 3 });
  if (vehicles.length === 0) {
    console.log('Creating mock vehicles...');
    await prisma.vehicle.createMany({
      data: [
        { tenant_id: tenant.id, plate: 'AAA-123', vehicle_type: 'truck', fuel_type: 'diesel' },
        { tenant_id: tenant.id, plate: 'BBB-456', vehicle_type: 'van', fuel_type: 'gasoline' },
        { tenant_id: tenant.id, plate: 'CCC-789', vehicle_type: 'car', fuel_type: 'hybrid' }
      ]
    });
    vehicles = await prisma.vehicle.findMany({ where: { tenant_id: tenant.id }, take: 3 });
  }

  // Insert mock trips
  console.log('Inserting mock trips...');
  const statuses = ['FINALIZADO', 'FINALIZADO', 'EN_CURSO', 'CANCELADO', 'BORRADOR'];
  for (let i = 0; i < 15; i++) {
    const v = vehicles[i % vehicles.length];
    const status = statuses[i % statuses.length];
    
    // Spread dates across the last 30 days
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    await prisma.trip.create({
      data: {
        tenant_id: tenant.id,
        created_by_user_id: user.id,
        vehicle_id: v.id,
        status: status,
        planned_start: date,
        planned_end: new Date(date.getTime() + 1000 * 60 * 60 * 4), // +4 hours
        actual_start: status !== 'BORRADOR' ? date : null,
        actual_end: status === 'FINALIZADO' ? new Date(date.getTime() + 1000 * 60 * 60 * 4) : null,
        created_at: date,
      }
    });
  }

  // Insert mock Carbon Logs
  console.log('Inserting mock carbon logs...');
  for (let i = 0; i < 30; i++) {
    const v = vehicles[i % vehicles.length];
    
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    const distance = 50 + Math.random() * 400; // 50 to 450 km
    const fuel = distance * (v.vehicle_type === 'truck' ? 0.35 : 0.15); 
    const co2 = fuel * 2.68; // diesel equivalent

    await prisma.carbonLog.create({
      data: {
        tenant_id: tenant.id,
        vehicle_id: v.id,
        period_start: date,
        period_end: new Date(date.getTime() + 1000 * 60 * 60 * 2),
        distance_km: distance,
        avg_speed_kmh: 60 + Math.random() * 30,
        fuel_liters: fuel,
        co2_kg: co2,
        calculation_method: 'formula',
      }
    });
  }

  // Insert mock Alerts
  console.log('Inserting mock alerts...');
  const eventTypes = ['SPEED_VIOLATION', 'GEOFENCE_EXIT', 'HARSH_BRAKING', 'SIGNAL_LOST'];
  const severities = ['critical', 'warning', 'info'];
  for (let i = 0; i < 40; i++) {
    const v = vehicles[i % vehicles.length];
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    await prisma.eventLog.create({
      data: {
        tenant_id: tenant.id,
        vehicle_id: v.id,
        event_type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
        severity: severities[Math.floor(Math.random() * severities.length)],
        triggered_at: date,
        metadata_json: {},
      }
    });
  }

  console.log('Mock data inserted successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
