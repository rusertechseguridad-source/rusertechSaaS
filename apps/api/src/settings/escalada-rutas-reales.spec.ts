import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { globSync } from 'glob';

import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { AdminController } from '../admin/admin.controller';
import { AdminService } from '../admin/admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { MonitoringConfigService } from '../common/monitoring/monitoring-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FiltroDeExcepciones } from '../common/filters/excepciones.filter';

/**
 * LA ESCALADA DE PRIVILEGIOS, CONTRA LAS RUTAS REALES.
 *
 * ⚠️ Por qué existe esta suite y no alcanzaba la anterior: la Tanda 3 cerró la
 * escalada con 12 pruebas de una FUNCIÓN PURA. Ninguna probaba que el `PUT`
 * real la usara. Gustavo verificó en producción que no la usaba: asignó
 * "Admin Master" desde el panel y guardó sin un solo 400 ni 403.
 *
 * Eran TRES rutas escribiendo `role_code` y la regla cubría UNA. Acá se prueban
 * las tres, por HTTP, con los servicios reales — sólo se simula Prisma.
 *
 * Es la lección que yo mismo escribí dos veces y no apliqué: una prueba que
 * pasa no prueba nada hasta que la ves fallar contra el sistema real.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const YO = 'aaaaaaaa-0000-0000-0000-000000000001';
const OTRO = 'aaaaaaaa-0000-0000-0000-000000000002';

const usuarioActual = {
  id: YO, tenantId: TENANT, role: 'rusertech_admin', permissions: [],
};
const guardQuePasa = {
  canActivate: (ctx: any) => {
    ctx.switchToHttp().getRequest().user = usuarioActual;
    return true;
  },
};

describe('Escalada de privilegios · las TRES rutas que escriben role_code', () => {
  let app: INestApplication;
  const prisma: any = {
    user: { update: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
    tenant: { findUnique: jest.fn() },
  };
  const mail = { sendInvitation: jest.fn(), sendVehicleBlockedAlert: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [SettingsController, AdminController],
      providers: [
        SettingsService, AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
        { provide: MonitoringConfigService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue(guardQuePasa)
      .overrideGuard(RolesGuard).useValue(guardQuePasa)
      .compile();

    app = modulo.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true, forbidNonWhitelisted: true, transform: true,
      transformOptions: { enableImplicitConversion: false },
    }));
    app.useGlobalFilters(new FiltroDeExcepciones());
    await app.init();
  });

  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.update.mockResolvedValue({ id: OTRO });
    prisma.user.create.mockResolvedValue({ id: OTRO, email: 'x@y.com' });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.tenant.findUnique.mockResolvedValue({ name: 'Cliente A' });
  });

  // ── LA REPRODUCCIÓN EXACTA DE LO QUE PASÓ EN PRODUCCIÓN ────────────────
  it('🔴 PUT /admin/users/:id con "Admin Master" — la ruta que usó Gustavo', () => {
    // El frontend llama "Admin Master" al rol cuyo `code` es `rusertech_admin`
    // (AdminGlobalUsers.tsx:70-80 manda el code, no el nombre). Esta petición
    // guardaba sin rechazo y dejaba `rusertech_admin` en la base.
    return request(app.getHttpServer())
      .put(`/api/v1/admin/users/${OTRO}`)
      .send({ role_code: 'rusertech_admin', granted_permissions: [], revoked_permissions: [] })
      .expect(403)
      .then(() => expect(prisma.user.update).not.toHaveBeenCalled());
  });

  it('🔴 POST /settings/users/invite con rol de plataforma — la puerta que nadie vio', () => {
    // La peor de las tres: un `account_owner` no necesita editar a nadie.
    // Invita un usuario NUEVO con `rusertech_admin` y entra con esa cuenta.
    return request(app.getHttpServer())
      .post('/api/v1/settings/users/invite')
      .send({ email: 'nuevo@a.com', full_name: 'Nuevo', role_code: 'rusertech_admin' })
      .expect(403)
      .then(() => expect(prisma.user.create).not.toHaveBeenCalled());
  });

  it('🔴 PUT /settings/users/:id con rol de plataforma — la que sí estaba cubierta', () => {
    return request(app.getHttpServer())
      .put(`/api/v1/settings/users/${OTRO}`)
      .send({ role_code: 'rusertech_admin' })
      .expect(403)
      .then(() => expect(prisma.user.update).not.toHaveBeenCalled());
  });

  // ── NADIE EDITA SU PROPIO ROL, POR NINGUNA DE LAS TRES ─────────────────
  it.each([
    ['settings', `/api/v1/settings/users/${YO}`],
    ['admin', `/api/v1/admin/users/${YO}`],
  ])('nadie se cambia el rol a sí mismo · %s', (_n, ruta) => {
    return request(app.getHttpServer())
      .put(ruta).send({ role_code: 'viewer' })
      .expect(403)
      .then(() => expect(prisma.user.update).not.toHaveBeenCalled());
  });

  // ── LO LEGÍTIMO SIGUE FUNCIONANDO ──────────────────────────────────────
  describe('lo que no es escalada sigue pasando', () => {
    it('cambiar a otro usuario a un rol de cliente', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/settings/users/${OTRO}`).send({ role_code: 'manager' }).expect(200);
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('invitar a un usuario con un rol de cliente', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/settings/users/invite')
        .send({ email: 'nuevo@a.com', full_name: 'Nuevo', role_code: 'operator' })
        .expect(201);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('editarse el nombre a uno mismo, sin tocar el rol', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/settings/users/${YO}`).send({ full_name: 'Mi Nombre Nuevo' }).expect(200);
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('el panel de administración sigue pudiendo suspender', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/admin/users/${OTRO}`).send({ status: 'suspended' }).expect(200);
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  // ── EL BARRIDO QUE HABRÍA CAZADO ESTO ──────────────────────────────────
  describe('barrido: ningún servicio escribe role_code sin pasar por la regla', () => {
    // Ésta es la prueba que faltaba. No verifica un caso: verifica que no haya
    // un CUARTO camino. Es el mismo patrón de `tanda1-cableado.spec.ts`, que
    // ya había encontrado dos decoradores inertes.
    const raiz = join(__dirname, '..');
    const servicios = globSync('**/*.service.ts', { cwd: raiz, absolute: true })
      .filter((f) => !f.endsWith('.spec.ts'));

    it('encuentra los servicios a barrer', () => {
      expect(servicios.length).toBeGreaterThan(10);
    });

    it('todo servicio que ESCRIBE role_code llama a exigirRolAsignable', () => {
      const culpables: string[] = [];
      for (const archivo of servicios) {
        const texto = readFileSync(archivo, 'utf-8');
        // Qué cuenta como ESCRITURA: `role_code: <valor>`. Se descartan
        //   · `role_code: true`            → proyección de un `select`
        //   · `role_code: { in: [...] }`   → filtro de un `where`
        //   · comentarios
        // El barrido es un cable trampa, no una demostración: comprueba que el
        // ARCHIVO llame a la regla, no que la llame en ese `update` concreto.
        // Alcanza para lo que falló —un servicio entero sin la regla— y no
        // pretende más de lo que puede.
        const escribe = texto
          .split('\n')
          // `role_code:` en CUALQUIER posición de la línea, no sólo al
          // principio: un `data: { role_code: rol }` en una sola línea se
          // escapaba del barrido. Lo encontró la prueba negativa.
          .filter((l) => /role_code\s*:|\.role_code\s*=/.test(l))
          .filter((l) => !/^\s*(\/\/|\*)/.test(l.trim()))
          .filter((l) => !/role_code:\s*(true|false)\b/.test(l))
          .filter((l) => !/role_code:\s*\{/.test(l));
        if (escribe.length === 0) continue;
        if (!texto.includes('exigirRolAsignable')) {
          // Separador normalizado: en Windows `replace(raiz,'')` deja `\`.
          const relativo = archivo.replace(raiz, '').replace(/\\/g, '/');
          culpables.push(`${relativo} — escribe role_code y no llama a la regla`);
        }
      }
      expect(culpables).toEqual([]);
    });
  });
});
