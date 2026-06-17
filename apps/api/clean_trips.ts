import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanMockTrips() {
  console.log('Cleaning invalid trips...');
  
  // Delete trips in BORRADOR
  const deleted = await prisma.trip.deleteMany({
    where: {
      status: {
        in: ['BORRADOR', 'in_progress']
      }
    }
  });

  console.log(`Deleted ${deleted.count} invalid trips.`);
}

cleanMockTrips().catch(console.error).finally(() => prisma.$disconnect());
