import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found');
  
  const trip = await prisma.trip.findFirst({
    where: { tenant_id: tenant.id, vehicle_id: { not: null } }
  });

  if (!trip) throw new Error('No trip with a vehicle found');

  // Create an open alert
  await prisma.eventLog.create({
    data: {
      tenant_id: tenant.id,
      vehicle_id: trip.vehicle_id as string,
      trip_id: trip.id,
      event_type: 'speed_violation',
      severity: 'critical',
      status: 'open',
      latitude: -32.9468,
      longitude: -60.6393,
      address: 'Au. Rosario-Buenos Aires, Km 280',
      metadata_json: { speed: 110, limit: 80 }
    }
  });

  // Create a warning alert
  await prisma.eventLog.create({
    data: {
      tenant_id: tenant.id,
      vehicle_id: trip.vehicle_id as string,
      trip_id: trip.id,
      event_type: 'panic_button',
      severity: 'warning',
      status: 'open',
      latitude: -32.9468,
      longitude: -60.6393,
      address: 'Au. Rosario-Buenos Aires, Km 285',
      metadata_json: { }
    }
  });

  console.log('Sample alerts created');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
