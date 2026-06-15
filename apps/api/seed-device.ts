import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found');
  
  const avl = await prisma.avlUser.findFirst({ where: { tenant_id: tenant.id } });

  await prisma.device.create({
    data: {
      tenant_id: tenant.id,
      name: 'Mochila GPS Alpha',
      imei: '865123456789012',
      device_code: '865123456789012',
      device_type: 'PORTABLE_GPS',
      status: 'ACTIVE',
      battery_level: 85,
      signal_strength: 90,
      avl_user_id: avl ? avl.id : undefined,
    }
  });

  console.log('Sample device created');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
