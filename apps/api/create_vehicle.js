const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  try {
    const user = await p.avlUser.findFirst({ where: { user_avl_code: 'TEST_01' } });
    if (!user) throw new Error('No user found');
    const vehicle = await p.vehicle.create({
      data: {
        hub_asset_id: 'ASSET_123',
        avl_user_id: user.id,
        tenant_id: user.tenant_id,
        alias: 'Truck 1',
        plate: 'ABC-123'
      }
    });
    console.log('Vehicle created:', vehicle.id);
  } catch (e) {
    if (e.code === 'P2002') console.log('Vehicle already exists');
    else console.error(e);
  } finally {
    await p.$disconnect();
  }
}
run();
