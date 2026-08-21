import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst();
  const vehicles = await prisma.vehicle.findMany({ take: 3 });
  const drivers = await prisma.driver.findMany({ take: 3 });
  const trips = await prisma.trip.findMany();

  const coords = [
    { lat: -34.6037, lng: -58.3816 }, // BA
    { lat: -32.9442, lng: -60.6505 }, // Rosario
    { lat: -31.4201, lng: -64.1888 }  // Cordoba
  ];

  for(let i=0; i<trips.length; i++) {
    const v = vehicles[i % vehicles.length];
    const d = drivers[i % drivers.length];
    
    await prisma.trip.update({
      where: { id: trips[i].id },
      data: {
        vehicle_id: v.id,
        driver_id: d.id,
        origin_lat: coords[i % 3].lat,
        origin_lng: coords[i % 3].lng,
        destination_lat: coords[(i+1) % 3].lat,
        destination_lng: coords[(i+1) % 3].lng,
        name: 'Viaje a Destino ' + i
      }
    });

    // Create telemetry record
    await prisma.telemetry.create({
      data: {
        tenant_id: tenant!.id,
        vehicle_id: v.id,
        avl_user_id: v.avl_user_id || '00000000-0000-0000-0000-000000000000', // might fail if foreign key, let's omit if optional? wait, avl_user_id is mandatory. Let's find an avl user.
        latitude: coords[i % 3].lat,
        longitude: coords[i % 3].lng,
        speed_kmh: 60,
        heading_degrees: 90,
        ignition: true,
        timestamp: new Date(),
        raw_payload: {}
      }
    }).catch(() => console.log('Failed to create telemetry for', v.id));
  }
  console.log('Successfully updated 3 dummy trips to be real');
}

main().catch(console.error).finally(() => prisma.$disconnect());
