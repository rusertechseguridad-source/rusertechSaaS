import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const trips = await prisma.trip.findMany();
  console.log(JSON.stringify(trips, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
