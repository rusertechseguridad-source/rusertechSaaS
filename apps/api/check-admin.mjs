import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@rusertech.com' }
  });
  
  if (!user) {
    console.log('User not found');
    return;
  }
  
  const payload = {
    sub: user.id,
    email: user.email,
    tenantId: user.tenant_id,
    role: user.role_code
  };
  
  // Use a dummy secret or find the real one
  // Wait, I can't sign a valid token without the JWT_SECRET from .env
  console.log('User role:', user.role_code);
  console.log('User tenant:', user.tenant_id);
}

main().finally(() => prisma.$disconnect());
