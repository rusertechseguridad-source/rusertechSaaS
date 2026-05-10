const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const user = await prisma.user.findUnique({ where: { email: 'admin@rusertech.com' } });
  console.log('User found:', user);
  
  const bcrypt = require('bcrypt');
  const match = await bcrypt.compare('Gusta_Rusertech86', user.password_hash);
  console.log('Password match:', match);
  
  await prisma.$disconnect();
}
check();
