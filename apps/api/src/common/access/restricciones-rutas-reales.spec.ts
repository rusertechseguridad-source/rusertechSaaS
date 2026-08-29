import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { VehiclesController } from '../../vehicles/vehicles.controller';
import { VehiclesService } from '../../vehicles/vehicles.service';
import { AlertsController } from '../../alerts/alerts.controller';
import { AlertsService } from '../../alerts/alerts.service';
import { LivePositionsService } from '../live-positions/live-positions.service';
import { MonitoringConfigService } from '../monitoring/monitoring-config.service';
import { AccesoEntidadesService } from './acceso-entidades.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../../mail/mail.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { FiltroDeExcepciones } from '../filters/excepciones.filter';

/**
 * LAS RESTRICCIONES POR ENTIDAD, CONTRA LAS RUTAS REALES.
 *
 * ⚠️ Ésta es la prueba que faltó en la Tanda 3, y el motivo por el que la
 * escalada seguía abierta: había 12 pruebas de una función pura y ninguna
 * verificaba que una ruta la usara.
 *
 * Acá corren los CONTROLLERS y los SERVICIOS de verdad —incluido
 * `AccesoEntidadesService`— y sólo se simula Prisma. El escenario es el del
 * informe, con sus números: un usuario restringido a 3 vehículos de una flota
 * de 120.
 */
const TENANT = '11111111-1111-1111-1111-111111111111';
const PERMITIDO = 'aaaa0001-0000-4000-8000-000000000001';
const PROHIBIDO = 'bbbb0002-0000-4000-8000-000000000002';

const restringido = {
  id: 'user-restringido', tenantId: TENANT, role: 'viewer',
  permissions: ['view_map', 'view_vehicles', 'view_alerts'],
};

describe('Restricciones por entidad · rutas reales', () => {
  let app: INestApplication;
  let usuarioActual: any = restringido;

  const prisma: any = {
    user: { findUnique: jest.fn() },
    vehicle: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    eventLog: { findMany: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  // `vehicles.findOne` consulta por el cliente EXTENDIDO (el que setea el
  // tenant en la conexión), no por el base. Apuntan al mismo mock.
  prisma.extended = prisma;
  const livePositions = { obtenerParaMapa: jest.fn(), obtenerPorVehiculo: jest.fn() };
  const monitoring = { obtenerUmbrales: jest.fn().mockResolvedValue({ ventana_mapa_horas: 6 }) };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [VehiclesController, AlertsController],
      providers: [
        VehiclesService, AlertsService, AccesoEntidadesService,
        { provide: PrismaService, useValue: prisma },
        { provide: LivePositionsService, useValue: livePositions },
        { provide: MonitoringConfigService, useValue: monitoring },
        // Dependencias de VehiclesService que esta suite no ejercita.
        { provide: RedisService, useValue: {} },
        { provide: MailService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({
        canActivate: (ctx: any) => { ctx.switchToHttp().getRequest().user = usuarioActual; return true; },
      })
      .overrideGuard(PermissionsGuard).useValue({ canActivate: () => true })
      .compile();

    app = modulo.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new FiltroDeExcepciones());
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  beforeEach(() => {
    jest.clearAllMocks();
    usuarioActual = restringido;
    // El usuario está restringido a UN vehículo: `PERMITIDO`.
    prisma.user.findUnique.mockResolvedValue({
      entity_restrictions: { vehicles: [PERMITIDO] },
    });
    livePositions.obtenerParaMapa.mockResolvedValue({ positions: [], summary: {}, thresholds: {} });
    livePositions.obtenerPorVehiculo.mockResolvedValue(null);
    prisma.eventLog.findMany.mockResolvedValue([]);
  });

  // ── EL ESCENARIO DEL INFORME ──────────────────────────────────────────
  it('🔴 el MAPA recibe la lista de vehículos permitidos', async () => {
    // "Abre Vehículos y ve 3 — la restricción funciona. Después abre el mapa y
    // ve los 120 del tenant." Éste es el sitio donde más se notaba.
    await request(app.getHttpServer()).get('/api/v1/vehicles/live').expect(200);
    expect(livePositions.obtenerParaMapa).toHaveBeenCalledWith(TENANT, [PERMITIDO]);
  });

  it('el DETALLE de un vehículo permitido se abre', async () => {
    prisma.vehicle.findFirst.mockResolvedValue({ id: PERMITIDO, plate: 'AAA111' });
    await request(app.getHttpServer()).get(`/api/v1/vehicles/${PERMITIDO}`).expect(200);
  });

  it('🔴 el DETALLE de un vehículo PROHIBIDO da 404, y no llega a consultarlo', async () => {
    // 404 y no 403: un 403 confirmaría que el vehículo existe.
    await request(app.getHttpServer()).get(`/api/v1/vehicles/${PROHIBIDO}`).expect(404);
    expect(prisma.vehicle.findFirst).not.toHaveBeenCalled();
  });

  it('🔴 las ALERTAS se piden filtradas por los vehículos permitidos', async () => {
    await request(app.getHttpServer()).get('/api/v1/alerts').expect(200);
    const where = prisma.eventLog.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ tenant_id: TENANT, vehicle_id: { in: [PERMITIDO] } });
  });

  // ── UN USUARIO SIN RESTRICCIÓN NO PIERDE NADA ─────────────────────────
  describe('sin restricción configurada', () => {
    beforeEach(() => { prisma.user.findUnique.mockResolvedValue({ entity_restrictions: {} }); });

    it('el mapa se pide sin lista de ids', async () => {
      await request(app.getHttpServer()).get('/api/v1/vehicles/live').expect(200);
      expect(livePositions.obtenerParaMapa).toHaveBeenCalledWith(TENANT, null);
    });

    it('el detalle de cualquier vehículo del tenant se abre', async () => {
      prisma.vehicle.findFirst.mockResolvedValue({ id: PROHIBIDO, plate: 'BBB222' });
      await request(app.getHttpServer()).get(`/api/v1/vehicles/${PROHIBIDO}`).expect(200);
    });

    it('las alertas se piden sin filtro de vehículo', async () => {
      await request(app.getHttpServer()).get('/api/v1/alerts').expect(200);
      expect(prisma.eventLog.findMany.mock.calls[0][0].where.vehicle_id).toBeUndefined();
    });
  });

  // ── LOS ROLES EXENTOS SIGUEN VIENDO TODO ──────────────────────────────
  it('el account_owner no queda sujeto a restricciones, aunque las tenga guardadas', async () => {
    // Es quien las CONFIGURA: si quedara sujeto, un tilde mal puesto lo dejaría
    // fuera de su propio tenant sin nadie adentro que pueda revertirlo.
    usuarioActual = { ...restringido, role: 'account_owner' };
    await request(app.getHttpServer()).get('/api/v1/vehicles/live').expect(200);
    expect(livePositions.obtenerParaMapa).toHaveBeenCalledWith(TENANT, null);
  });

  // ── FALLA CERRADO ─────────────────────────────────────────────────────
  it('🔴 restricciones ilegibles → 403, y NO se consulta nada', async () => {
    prisma.user.findUnique.mockResolvedValue({ entity_restrictions: 'basura-no-json' });
    await request(app.getHttpServer()).get('/api/v1/vehicles/live').expect(403);
    expect(livePositions.obtenerParaMapa).not.toHaveBeenCalled();
  });

  it('🔴 token de un usuario que ya no existe → 403', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer()).get('/api/v1/alerts').expect(403);
    expect(prisma.eventLog.findMany).not.toHaveBeenCalled();
  });

  it('una lista VACÍA se trata como "sin restricción", que es la decisión tomada', async () => {
    // ⚠️ Escribí esta prueba esperando lo contrario —`[]` = "no ve ninguno"— y
    // el código tenía razón. `entity-restrictions.ts:118-124` lo documenta: la
    // pantalla de Configuración manda `{vehicles: [], locations: []}` para todo
    // viewer al que no se le tildó nada, y esos usuarios hoy ven su tenant
    // entero. Tratar `[]` como "no ve nada" los dejaría sin pantalla de un día
    // para el otro.
    //
    // La ambigüedad de fondo —`[]` no distingue "sin configurar" de
    // "expresamente nada"— es un límite del modelo jsonb, y se resuelve
    // migrando `entity_restrictions` a tablas relacionales, que ya está
    // anotado en el cierre de la auditoría.
    prisma.user.findUnique.mockResolvedValue({ entity_restrictions: { vehicles: [] } });
    await request(app.getHttpServer()).get('/api/v1/vehicles/live').expect(200);
    expect(livePositions.obtenerParaMapa).toHaveBeenCalledWith(TENANT, null);
  });
});
