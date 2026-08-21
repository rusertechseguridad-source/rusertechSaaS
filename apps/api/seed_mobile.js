require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.log('No tenant found!');
    return;
  }

  const existing = await prisma.avlUser.findFirst({
    where: { user_avl_code: 'Rusertech_Mobile' }
  });

  if (existing) {
    console.log(`AVL User Rusertech_Mobile already exists. API KEY: ${existing.api_key}`);
    return;
  }

  const apiKey = 'rtech_mob_' + crypto.randomBytes(16).toString('hex');

  const avlUser = await prisma.avlUser.create({
    data: {
      tenant_id: tenant.id,
      user_avl_code: 'Rusertech_Mobile',
      name: 'Rusertech Mobile App',
      description: 'Integración para la app móvil de conductores',
      api_key: apiKey,
      is_active: true
    }
  });

  console.log(`Successfully created AVL User: Rusertech_Mobile`);
  console.log(`API KEY: ${avlUser.api_key}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
