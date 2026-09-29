import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AlertsController } from '../../alerts/alerts.controller';
import { AlertsService } from '../../alerts/alerts.service';
import { SimulatorController } from '../../simulator/simulator.controller';
import { SimulatorService } from '../../simulator/simulator.service';
import { SettingsController } from '../../settings/settings.controller';
import { SettingsService } from '../../settings/settings.service';
import { MonitoringConfigService } from '../monitoring/monitoring-config.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FiltroDeExcepciones } from '../filters/excepciones.filter';
import { SYSTEM_PERMISSIONS } from '../constants/permissions';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * LOS TRES AGUJEROS DE PERMISOS, CONTRA LAS RUTAS REALES
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ LOS GUARDS SON LOS DE VERDAD. Las otras suites de rutas reales los
 * reemplazan por uno que siempre pasa, y con razón: prueban otra cosa. Esta
 * prueba justamente la autorización, así que sólo se reemplaza `JwtAuthGuard`
 * —para poner el usuario— y `PermissionsGuard` y `RolesGuard` corren tal cual.
 *
 * Por qué hace falta y no alcanza con R3: R3 mira las rutas de ESCRITURA.
 * `GET /alerts`, `GET /settings/users` y `GET /simulator/status` son lecturas,
 * y dos de los tres agujeros eran lecturas. Y R3 comprueba que haya un
 * `@Roles(`, no QUÉ roles dice: la matriz de abajo es la que demuestra que
 * pasar los `if` a decoradores no cambió quién entra.
 */
const TENANT = '11111111-1111-1111-1111-111111111111';

/** Los roles del seed (`prisma/seed.ts`). */
const ROLES = [
  'rusertech_admin', 'account_owner', 'manager', 'operator',
  'viewer', 'driver', 'gerencia', 'key_user',
] as const;

describe('Permisos · rutas reales, con los guards de verdad', () => {
  let app: INestApplication;
  let usuarioActual: any;

  const alertas = { findAll: jest.fn().mockResolvedValue([]) };
  const simulador = {
    sendPoint: jest.fn().mockResolvedValue({ ok: true }),
    sendAlert: jest.fn().mockResolvedValue({ ok: true }),
    startRoute: jest.fn().mockResolvedValue({ ok: true }),
    getStatus: jest.fn().mockResolvedValue({ ok: true }),
    deleteRoute: jest.fn().mockResolvedValue({ ok: true }),
  };
  const ajustes = {
    updateProfile: jest.fn().mockResolvedValue({ ok: true }),
    getUsers: jest.fn().mockResolvedValue([]),
    inviteUser: jest.fn().mockResolvedValue({ ok: true }),
    updateUser: jest.fn().mockResolvedValue({ ok: true }),
  };

  const como = (role: string, permissions: string[] = []) => {
    usuarioActual = { id: 'u-1', tenantId: TENANT, role, permissions };
  };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [AlertsController, SimulatorController, SettingsController],
      providers: [
        { provide: AlertsService, useValue: alertas },
        { provide: SimulatorService, useValue: simulador },
        { provide: SettingsService, useValue: ajustes },
        { provide: MonitoringConfigService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({
        canActivate: (ctx: any) => { ctx.switchToHttp().getRequest().user = usuarioActual; return true; },
      })
      .compile();

    app = modulo.createNestApplication();
    app.useGlobalFilters(new FiltroDeExcepciones());
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AVL_SIMULATOR_ENABLED = 'true';
  });

  afterEach(() => { delete process.env.AVL_SIMULATOR_ENABLED; });

  // ── a · GET /alerts ────────────────────────────────────────────────────
  describe('a · la lista de alertas exige view_alerts, como la campana', () => {
    it('🔴 sin view_alerts: 403, y el servicio NO se consulta', async () => {
      // Es el agujero: cualquier usuario autenticado del cliente listaba las
      // alertas. Se afirma también que el servicio no corrió — un 403 que
      // llega después de leer la base ya filtró el tiempo de respuesta.
      como('operator', ['view_map']);
      await request(app.getHttpServer()).get('/api/v1/alerts').expect(403);
      expect(alertas.findAll).not.toHaveBeenCalled();
    });

    it('con view_alerts: pasa', async () => {
      como('operator', ['view_alerts']);
      await request(app.getHttpServer()).get('/api/v1/alerts').expect(200);
      expect(alertas.findAll).toHaveBeenCalled();
    });
  });

  // ── b · simulator ──────────────────────────────────────────────────────
  describe('b · el simulador exige su permiso aunque el interruptor esté encendido', () => {
    it.each([
      ['post', '/api/v1/simulator/send'],
      ['post', '/api/v1/simulator/alert'],
      ['post', '/api/v1/simulator/route'],
      ['delete', '/api/v1/simulator/route/job-1'],
    ] as const)('🔴 %s %s sin use_simulator: 403', async (verbo, ruta) => {
      // Con `AVL_SIMULATOR_ENABLED=true` —un entorno de prueba o de demo—
      // cualquier usuario inyectaba puntos y alertas falsas en su cliente.
      como('operator', ['view_simulator']);
      await request(app.getHttpServer())[verbo](ruta).send({}).expect(403);
      expect(simulador.sendPoint).not.toHaveBeenCalled();
      expect(simulador.deleteRoute).not.toHaveBeenCalled();
    });

    it('🔴 GET /simulator/status sin view_simulator: 403', async () => {
      como('operator', ['view_map']);
      await request(app.getHttpServer()).get('/api/v1/simulator/status').expect(403);
    });

    it('con use_simulator: pasa', async () => {
      como('account_owner', ['use_simulator']);
      await request(app.getHttpServer()).post('/api/v1/simulator/send').send({}).expect(201);
      expect(simulador.sendPoint).toHaveBeenCalled();
    });

    it('el interruptor sigue mandando: con el permiso y apagado, no hay simulador', async () => {
      // Los permisos no reemplazan al interruptor: deciden QUIÉN, no DÓNDE.
      delete process.env.AVL_SIMULATOR_ENABLED;
      como('account_owner', ['use_simulator']);
      await request(app.getHttpServer()).post('/api/v1/simulator/send').send({}).expect(403);
      expect(simulador.sendPoint).not.toHaveBeenCalled();
    });
  });

  // ── c · settings: nadie gana ni pierde acceso ──────────────────────────
  describe('c · settings: los cuatro handlers, rol por rol, IGUAL que antes', () => {
    /**
     * ⚠️ LAS LISTAS SE COPIAN DE LOS `if` VIEJOS, no de la constante nueva.
     * Compararlas contra la constante sería una tautología: si alguien le
     * agrega `manager` a quién invita, la prueba seguiría verde. Éstas son las
     * que decían los `if` de `settings.controller.ts` en `26e0165`.
     */
    const ANTES: [string, string, string, readonly string[]][] = [
      ['put', '/api/v1/settings/profile', 'updateProfile', ['account_owner', 'rusertech_admin']],
      ['get', '/api/v1/settings/users', 'getUsers', ['account_owner', 'manager', 'rusertech_admin']],
      ['post', '/api/v1/settings/users/invite', 'inviteUser', ['account_owner', 'rusertech_admin']],
      ['put', '/api/v1/settings/users/u-2', 'updateUser', ['account_owner', 'rusertech_admin']],
    ];

    const casos = ANTES.flatMap(([verbo, ruta, metodo, admitidos]) =>
      ROLES.map((rol) => [verbo, ruta, metodo, rol, admitidos.includes(rol)] as const),
    );

    it.each(casos)('%s %s (%s) · %s → admitido: %s', async (verbo, ruta, metodo, rol, admitido) => {
      // Todos los permisos del catálogo: lo que se prueba es el ROL, que es
      // lo que miraban los `if`. Un permiso no puede abrir estas rutas.
      como(rol, Object.keys(SYSTEM_PERMISSIONS));
      const res = await (request(app.getHttpServer()) as any)[verbo](ruta).send({});

      // UN código exacto por caso, no un rango: `toBeLessThan(300)` aceptaba
      // cualquier 2xx. Nest responde 201 a un POST y 200 al resto.
      const esperado = !admitido ? 403 : verbo === 'post' ? 201 : 200;
      expect(res.status).toBe(esperado);
      if (admitido) {
        expect((ajustes as any)[metodo]).toHaveBeenCalled();
      } else {
        expect((ajustes as any)[metodo]).not.toHaveBeenCalled();
      }
    });
  });

  // ── El motivo: dice qué falta, y nada más ──────────────────────────────
  describe('el rechazo dice QUÉ falta, sin contar de más', () => {
    it('🔴 sin permiso: nombra el permiso que falta, con su nombre del catálogo', async () => {
      como('operator', ['view_map']);
      const res = await request(app.getHttpServer()).get('/api/v1/alerts').expect(403);
      // Antes decía «Forbidden resource», y la pantalla de alertas lo
      // mostraba tal cual: un rechazo sin motivo parece una función rota.
      expect(res.body.message).not.toMatch(/Forbidden resource/i);
      expect(res.body.message).toContain('«Ver Alertas»');
    });

    it('🔴 y NO enumera los demás permisos del sistema', async () => {
      como('operator', ['view_map']);
      const res = await request(app.getHttpServer()).get('/api/v1/alerts').expect(403);
      const otros = Object.entries(SYSTEM_PERMISSIONS)
        .filter(([clave]) => clave !== 'view_alerts')
        .map(([, nombre]) => nombre);
      expect(otros.filter((nombre) => res.body.message.includes(nombre))).toEqual([]);
    });

    it('🔴 sin rol: nombra el rol de cliente que hace falta', async () => {
      como('operator', Object.keys(SYSTEM_PERMISSIONS));
      const res = await request(app.getHttpServer())
        .post('/api/v1/settings/users/invite').send({}).expect(403);
      expect(res.body.message).not.toMatch(/Forbidden resource/i);
      expect(res.body.message).toContain('«account_owner»');
    });

    it('🔴 y NO nombra el rol de plataforma', async () => {
      // Un cliente no puede pedir `rusertech_admin`: nombrarlo es contarle
      // cómo está armada la administración del sistema.
      como('operator', Object.keys(SYSTEM_PERMISSIONS));
      const res = await request(app.getHttpServer())
        .post('/api/v1/settings/users/invite').send({}).expect(403);
      expect(res.body.message).not.toContain('rusertech_admin');
    });
  });
});
