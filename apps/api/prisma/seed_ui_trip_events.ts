import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst();
  const trips = await prisma.trip.findMany({ where: { status: 'EN_CURSO' } });

  for(const trip of trips) {
    if (!trip.origin_lat || !trip.origin_lng) continue;
    await prisma.tripEvent.create({
      data: {
        tenant_id: tenant!.id,
        trip_id: trip.id,
        event_type: 'position',
        severity: 'info',
        latitude: trip.origin_lat,
        longitude: trip.origin_lng,
        metadata_json: { speed: 80, address: 'Ruta simulada' },
        timestamp: new Date()
      }
    });
  }
  console.log('Created TripEvents for ' + trips.length + ' trips');
}

main().catch(console.error).finally(() => prisma.$disconnect());
