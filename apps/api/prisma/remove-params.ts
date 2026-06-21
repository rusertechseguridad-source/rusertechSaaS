import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.parameterSetting.deleteMany({
    where: {
      parameter_key: {
        in: ['HARSH_BRAKING_THRESHOLD_G', 'HARSH_ACCEL_THRESHOLD_G']
      }
    }
  });
  console.log('Parameters deleted.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
