import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PARAMETERS = [
  // Generales de Interfaz y Plataforma
  { key: 'DEFAULT_LANGUAGE', value: 'es', type: 'string', editable: true, desc: 'Idioma por defecto de la plataforma (es, en, pt)' },
  { key: 'DEFAULT_TIMEZONE', value: 'America/Argentina/Buenos_Aires', type: 'string', editable: true, desc: 'Zona horaria por defecto' },
  { key: 'SESSION_TIMEOUT_MINUTES', value: '120', type: 'number', editable: false, desc: 'Tiempo de inactividad antes de cerrar sesión' },
  
  // Parámetros de Telemetría AVL
  { key: 'MIN_GPS_REPORT_INTERVAL_SEC', value: '10', type: 'number', editable: false, desc: 'Intervalo mínimo permitido para reporte GPS' },
  { key: 'TELEMETRY_RETENTION_DAYS', value: '90', type: 'number', editable: false, desc: 'Días de retención de data cruda de telemetría' },
  { key: 'OFFLINE_DEVICE_TIMEOUT_MIN', value: '15', type: 'number', editable: true, desc: 'Minutos sin conexión para considerar un equipo offline' },
  { key: 'GPS_DRIFT_FILTER_METERS', value: '15', type: 'number', editable: false, desc: 'Filtro de deriva estática (metros)' },
  
  // Configuración de Mapas y UI
  { key: 'MAP_DEFAULT_CENTER', value: '{"lat": -34.6037, "lng": -58.3816}', type: 'json', editable: true, desc: 'Coordenadas centrales por defecto del mapa' },
  { key: 'MAP_DEFAULT_ZOOM', value: '12', type: 'number', editable: true, desc: 'Nivel de zoom inicial del mapa' },
  
  // Unidades de Medida
  { key: 'DISTANCE_UNIT', value: 'KM', type: 'string', editable: true, desc: 'Unidad de distancia (KM, MILES)' },
  { key: 'SPEED_UNIT', value: 'KPH', type: 'string', editable: true, desc: 'Unidad de velocidad (KPH, MPH)' },
  { key: 'VOLUME_UNIT', value: 'LITERS', type: 'string', editable: true, desc: 'Unidad de volumen (LITERS, GALLONS)' },
  
  // Límites y Tolerancias de Seguridad / Riesgos
  { key: 'OVERSPEED_TOLERANCE_KPH', value: '5', type: 'number', editable: true, desc: 'Tolerancia en km/h sobre el límite de velocidad' },
  { key: 'IDLING_TIMEOUT_MIN', value: '10', type: 'number', editable: true, desc: 'Minutos con motor encendido sin movimiento para generar alerta' },
  
  // Notificaciones y Correos
  { key: 'ALERT_EMAIL_SENDER', value: 'noreply@rusertech.com', type: 'string', editable: false, desc: 'Remitente por defecto de alertas' }
];

async function main() {
  console.log('Seeding system parameters...');
  for (const p of PARAMETERS) {
    const existing = await prisma.parameterSetting.findFirst({
      where: { tenant_id: null, parameter_key: p.key }
    });
    
    if (!existing) {
      await prisma.parameterSetting.create({
        data: {
          parameter_key: p.key,
          parameter_value: p.value,
          data_type: p.type,
          description: p.desc,
          is_editable_by_account_owner: p.editable
        }
      });
      console.log(`Created parameter: ${p.key}`);
    } else {
      console.log(`Parameter ${p.key} already exists, skipping.`);
    }
  }
  console.log('Parameters seeded successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
