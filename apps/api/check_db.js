const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  try {
    const tel = await p.telemetry.findMany();
    console.log('Telemetry rows:', tel.length);
    const outbox = await p.$queryRawUnsafe('SELECT * FROM outbox_messages');
    console.log('Outbox rows:', outbox.length);
    if (outbox.length > 0) {
      console.log('Outbox sample:', outbox[0].status);
    }
  } catch(e) {
    console.error(e);
  } finally {
    await p.$disconnect();
  }
}
check();
