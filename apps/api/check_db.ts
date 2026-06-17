import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany();
  console.log('Tenants:', tenants.map(t => t.id));

  const trips = await prisma.trip.findMany();
  console.log(`Total Trips: ${trips.length}`);
  if (trips.length > 0) {
    console.log('Sample Trip Tenant ID:', trips[0].tenant_id);
    console.log('Sample Trip Created At:', trips[0].created_at);
  }

  const logs = await prisma.carbonLog.findMany();
  console.log(`Total Carbon Logs: ${logs.length}`);

  const eventLogs = await prisma.eventLog.findMany();
  console.log(`Total Event Logs: ${eventLogs.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
