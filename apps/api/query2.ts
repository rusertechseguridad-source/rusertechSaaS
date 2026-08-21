import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const vehicles = await prisma.vehicle.findMany({ include: { carrier: true } });
  console.log('Vehicles:', vehicles.length);
  const drivers = await prisma.driver.findMany();
  console.log('Drivers:', drivers.length);
  const eventRules = await prisma.eventRule.findMany();
  console.log('EventRules:', eventRules.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
