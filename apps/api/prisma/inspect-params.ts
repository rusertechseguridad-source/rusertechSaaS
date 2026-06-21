import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.parameterSetting.count();
  const allParams = await prisma.parameterSetting.findMany();
  console.log(`Total parameters: ${count}`);
  console.log(JSON.stringify(allParams, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
