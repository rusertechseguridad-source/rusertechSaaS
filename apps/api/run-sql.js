const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  try {
    console.log('Running SQL partitioning scripts...');
    const sql1 = fs.readFileSync(path.join(__dirname, 'prisma/migrations/001_telemetry_partitioned.sql'), 'utf-8');
    const sql2 = fs.readFileSync(path.join(__dirname, 'prisma/migrations/002_telemetry_partition_cron.sql'), 'utf-8');
    
    await client.query(sql1);
    console.log('Executed 001_telemetry_partitioned.sql');
    
    await client.query(sql2);
    console.log('Executed 002_telemetry_partition_cron.sql');
  } catch (error) {
    console.error('Error executing SQL:', error);
  } finally {
    await client.end();
  }
}

main();
