import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

async function run() {
  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({
    where: { email: 'admin@rusertech.com' }
  });
  console.log('User in DB:', user?.email, 'tenant:', user?.tenant_id);

  const configs = await prisma.sensorConfig.findMany({
    where: { tenant_id: user?.tenant_id }
  });
  console.log('Configs for this tenant:', configs.length);

  await prisma.$disconnect();
}
run();
