import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Get a tenant & user
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found');
  const user = await prisma.user.findFirst();
  if (!user) throw new Error('No user found');
  
  // 2. Clear QA Test Trips and any Trips without a vehicle
  await prisma.trip.deleteMany({
    where: { 
      OR: [
        { name: 'QA Test Trip' },
        { vehicle_id: null }
      ]
    }
  });
  console.log('Cleared dummy QA trips');

  // 3. Get Vehicles and Drivers
  const vehicles = await prisma.vehicle.findMany({ take: 5 });
  const drivers = await prisma.driver.findMany({ take: 5 });

  // 4. Create 3 active trips in Argentina
  const coords = [
    { lat: -34.6037, lng: -58.3816 }, // BA
    { lat: -32.9442, lng: -60.6505 }, // Rosario
    { lat: -31.4201, lng: -64.1888 }  // Cordoba
  ];

  for(let i=0; i<Math.min(3, vehicles.length); i++) {
    const v = vehicles[i];
    const d = drivers[i];
    
    await prisma.trip.create({
      data: {
        tenant_id: tenant.id,
        created_by_user_id: user.id,
        name: 'Viaje a Destino ' + i,
        status: 'EN_CURSO',
        vehicle_id: v.id,
        driver_id: d.id,
        origin_lat: coords[i].lat,
        origin_lng: coords[i].lng,
        destination_lat: coords[2-i].lat,
        destination_lng: coords[2-i].lng,
        planned_start: new Date(),
        planned_end: new Date(Date.now() + 86400000)
      }
    });
  }
  
  console.log('Successfully created 3 trips');
}

main().catch(console.error).finally(() => prisma.$disconnect());
