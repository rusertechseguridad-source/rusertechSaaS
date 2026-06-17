import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

let connectionUrl = process.env.REDIS_URL || 'redis://localhost:6379';
if (connectionUrl.startsWith('https://')) {
  const url = new URL(connectionUrl);
  const host = url.host;
  const password = process.env.REDIS_TOKEN || '';
  connectionUrl = `rediss://default:${password}@${host}:6379`;
}
const redis = new Redis(connectionUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: connectionUrl.startsWith('rediss://') ? {} : undefined,
});

async function run() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
  if (!tenant) {
    console.log('Demo tenant not found');
    return;
  }

  const configs = await prisma.sensorConfig.findMany();
  console.log('All configs in DB:', configs);

  const vehicle = await prisma.vehicle.findFirst({
    where: { status: 'active', tenant_id: tenant.id },
  });

  if (!vehicle) {
    console.log('No active vehicle found in Demo tenant');
    return;
  }

  if (!vehicle.hub_asset_id) {
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { hub_asset_id: `DEMO-ASSET-${vehicle.plate}` }
    });
    vehicle.hub_asset_id = `DEMO-ASSET-${vehicle.plate}`;
  }

  console.log(`Using vehicle ${vehicle.plate} (${vehicle.id}) with asset ${vehicle.hub_asset_id}`);

  await prisma.sensorConfig.deleteMany({
    where: { tenant_id: tenant.id }
  });

  // Ensure a sensor config exists
  await prisma.sensorConfig.create({
    data: {
      tenant_id: vehicle.tenant_id,
      sensor_type: 'temperature',
      scope_type: 'vehicle',
      scope_id: vehicle.id,
      value_min: -5,
      value_max: 5,
      tolerance: 1,
      duration_seconds: 60,
      spike_delta: 5,
      is_active: true,
    }
  });

  await prisma.sensorConfig.create({
    data: {
      tenant_id: vehicle.tenant_id,
      sensor_type: 'humidity',
      scope_type: 'vehicle',
      scope_id: vehicle.id,
      value_min: 30,
      value_max: 60,
      tolerance: 5,
      duration_seconds: 60,
      spike_delta: 10,
      is_active: true,
    }
  });

  // Inject 20 points for the last 20 minutes (1 per minute)
  for (let i = 20; i >= 0; i--) {
    const timestamp = new Date(Date.now() - i * 60000);
    // Sine wave temperature between -10 and 10 to trigger alerts
    const temp = Math.sin(i / 2) * 10;
    
    await prisma.$executeRawUnsafe(`
      INSERT INTO telemetry (
        id, tenant_id, vehicle_id, avl_user_id, timestamp, 
        latitude, longitude, temperature_c, humidity_pct, raw_payload
      ) VALUES (
        gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4::timestamp, 
        -34.6037, -58.3816, $5, $6, '{}'
      )
    `, vehicle.tenant_id, vehicle.id, vehicle.avl_user_id, timestamp, temp, 50 + temp);
  }

  // Update Redis with the latest position
  const latestTemp = Math.sin(0 / 2) * 10;
  await redis.set(`vehicle:pos:${vehicle.hub_asset_id}`, JSON.stringify({
    timestamp: new Date().toISOString(),
    temperature_c: latestTemp,
    humidity_pct: 50 + latestTemp,
    latitude: -34.6037,
    longitude: -58.3816
  }));

  console.log('Inserted 20 mock telemetry points and updated Redis.');
  
  await prisma.$disconnect();
  redis.disconnect();
}

run();
