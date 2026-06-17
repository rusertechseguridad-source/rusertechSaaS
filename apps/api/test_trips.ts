import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function run() {
  const user = await p.user.findUnique({ where: { email: 'admin@rusertech.com' } });
  if (!user) return;
  const tenant = await p.tenant.findUnique({ where: { slug: 'demo' } });
  if (!tenant) return;
  const vehicle = await p.vehicle.findFirst({ where: { tenant_id: tenant.id } });
  if (!vehicle) return;

  const trip = await p.trip.create({
    data: {
      created_by_user_id: user.id,
      tenant_id: tenant.id,
      vehicle_id: vehicle.id,
      status: 'in_progress',
      name: 'Viaje de Test',
      origin_name: 'Base Test',
      destination_name: 'Cliente Final',
      planned_start: new Date(),
      planned_end: new Date(Date.now() + 86400000),
    }
  }).catch(() => null);

  console.log('Created trip:', trip ? trip.id : 'failed');
  await p.$disconnect();
}
run();
