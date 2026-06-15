const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const trips = await prisma.trip.findMany({ include: { vehicle: true } });
  console.log('TRIPS:', JSON.stringify(trips.map(t => ({ id: t.id, name: t.name, status: t.status, vehicle_id: t.vehicle_id, tenant_id: t.tenant_id })), null, 2));
  
  const driver = await prisma.driver.findFirst();
  console.log('DRIVER:', JSON.stringify(driver));
  
  const carrier = await prisma.carrier.findFirst();
  console.log('CARRIER:', JSON.stringify(carrier));
  
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
