const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const alerts = await prisma.eventLog.findMany();
  console.log('Total alerts in DB:', alerts.length);
  for (let i = 0; i < alerts.length; i++) {
    const lat = -34.6 + (Math.random() * 5 - 2.5);
    const lng = -68.0 + (Math.random() * 10 - 5);
    await prisma.eventLog.update({
      where: { id: alerts[i].id },
      data: { latitude: lat, longitude: lng }
    });
  }
  const check = await prisma.eventLog.findMany({ select: { id: true, latitude: true, longitude: true }});
  console.log('Sample updated:', check[0]);
  console.log('Coordinates updated for ' + alerts.length + ' alerts');
}

main().catch(console.error).finally(() => prisma.$disconnect());
