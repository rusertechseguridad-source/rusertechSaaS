import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const trips = await prisma.trip.findMany();
  console.log('Trips count:', trips.length);
  if (trips.length > 0) {
    console.log('Sample trip:', trips[0].name, 'vehicle:', trips[0].vehicle_id);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
