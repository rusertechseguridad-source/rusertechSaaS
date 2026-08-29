import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { readFileSync } from 'fs';
import { join } from 'path';

import { VehiclesController } from '../../vehicles/vehicles.controller';
import { VehiclesService } from '../../vehicles/vehicles.service';
import { DriversController } from '../../drivers/drivers.controller';
import { DriversService } from '../../drivers/drivers.service';
import { CarriersController } from '../../carriers/carriers.controller';
import { CarriersService } from '../../carriers/carriers.service';
import { DevicesController } from '../../devices/devices.controller';
import { DevicesService } from '../../devices/devices.service';
import { SettingsController } from '../../settings/settings.controller';
import { SettingsService } from '../../settings/settings.service';
import { AvlUsersController } from '../../avl-users/avl-users.controller';
import { AvlUsersService } from '../../avl-users/avl-users.service';
import { AvlMonitorService } from '../../avl-users/avl-monitor.service';
import { MonitoringConfigService } from '../monitoring/monitoring-config.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { FiltroDeExcepciones } from '../filters/excepciones.filter';

/**
 * LAS SEIS PANTALLAS DE EDICIÓN, CONTRA LA PILA HTTP REAL.
 *
 * Qué se levanta de verdad: el `ValidationPipe` con las mismas opciones que
 * `main.ts`, el `FiltroDeExcepciones`, los controllers reales y los DTOs
 * reales. Lo único simulado son los servicios y los guards de autenticación —
 * o sea, todo lo que esta tanda NO cambia.
 *
 * Por qué así y no contra una base: el pipe corta ANTES de que el servicio
 * toque Prisma, así que lo que hay que demostrar es qué cuerpo llega al
 * servicio y cuál se rechaza. Espiar el argumento del servicio es evidencia
 * MÁS fuerte que mirar la fila después: muestra exactamente lo que habría
 * llegado a la base. (Además, el cliente de Prisma de este entorno se generó
 * sin motores —están bloqueados con 403— y exige una URL `prisma://`.)
 *
 * Los cuerpos NO son inventados: son los que hoy manda cada formulario, con
 * la referencia al archivo y la línea.
 */

const TENANT_A = '11111111-1111-1111-1111-111111111111';
// v4 válido a propósito: con un UUID mal formado, la prueba de abajo pasaría
// por 'formato inválido' aunque el campo estuviera permitido. Lo cazó la
// prueba negativa de esta misma tanda.
const TENANT_B = '9f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const OWNER = 'aaaaaaaa-0000-0000-0000-000000000001';
const OTRO_USUARIO = 'aaaaaaaa-0000-0000-0000-000000000002';
const UUID = 'babe0001-0000-0000-0000-000000000001';

/** El usuario que los guards simulados inyectan en cada petición. */
const usuarioActual = {
  id: OWNER,
  tenantId: TENANT_A,
  role: 'account_owner',
  permissions: ['manage_vehicles', 'manage_avl', 'manage_settings', 'manage_locations'],
};

const guardQuePasa = {
  canActivate: (ctx: any) => {
    ctx.switchToHttp().getRequest().user = usuarioActual;
    return true;
  },
};

describe('Validación del cuerpo · las seis pantallas de edición', () => {
  let app: INestApplication;
  const servicios = {
    vehicles: { create: jest.fn(), update: jest.fn() },
    drivers: { create: jest.fn(), update: jest.fn() },
    carriers: { create: jest.fn(), update: jest.fn() },
    devices: { create: jest.fn(), update: jest.fn() },
    settings: { updateUser: jest.fn() },
    avl: { addDictionaryEntry: jest.fn() },
  };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [
        VehiclesController, DriversController, CarriersController,
        DevicesController, SettingsController, AvlUsersController,
      ],
      providers: [
        { provide: VehiclesService, useValue: servicios.vehicles },
        { provide: DriversService, useValue: servicios.drivers },
        { provide: CarriersService, useValue: servicios.carriers },
        { provide: DevicesService, useValue: servicios.devices },
        { provide: SettingsService, useValue: servicios.settings },
        { provide: AvlUsersService, useValue: servicios.avl },
        { provide: AvlMonitorService, useValue: {} },
        // Dependencia de SettingsController que esta suite no ejercita.
        { provide: MonitoringConfigService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue(guardQuePasa)
      .overrideGuard(PermissionsGuard).useValue(guardQuePasa)
      .overrideGuard(RolesGuard).useValue(guardQuePasa)
      .compile();

    app = modulo.createNestApplication();
    // ⚠️ Idénticas a main.ts. Si allá cambian y acá no, esta suite deja de
    // probar lo que corre en producción.
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false, exposeUnsetFields: false },
    }));
    app.useGlobalFilters(new FiltroDeExcepciones());
    await app.init();
  });

  afterAll(async () => { await app.close(); });
  beforeEach(() => jest.clearAllMocks());

  // ── LO QUE LAS PANTALLAS MANDAN HOY TIENE QUE SEGUIR FUNCIONANDO ────────
  describe('las pantallas siguen funcionando', () => {
    it('vehículos · el cuerpo de VehiclesPage.tsx:198-213 pasa entero', async () => {
      const cuerpo = {
        plate: 'AAA111', alias: 'Camión 1', brand: 'Scania', model: 'R450',
        vehicle_type: 'truck', fuel_type: 'diesel', fuel_efficiency_lper100km: 32.5,
        avl_user_id: null, hub_asset_id: null, dictionary_category: null,
        carrier_id: null, image_front_url: null, image_rear_url: null, image_side_url: null,
      };
      servicios.vehicles.update.mockResolvedValue({ id: UUID });
      await request(app.getHttpServer()).put(`/api/v1/vehicles/${UUID}`).send(cuerpo).expect(200);

      // No alcanza con el 200: hay que ver que NINGÚN campo se haya perdido en
      // el camino. El `whitelist` descarta en silencio, y un DTO al que le
      // falta una columna dejaría de guardarla sin que nadie se entere.
      const recibido = servicios.vehicles.update.mock.calls[0][2];
      expect(recibido).toMatchObject(cuerpo);

      // Y al revés: nada con VALOR que la pantalla no haya mandado.
      // Las claves declaradas en el DTO y no enviadas llegan como `undefined`
      // —con target ES2023, TypeScript define igual todos los campos de la
      // clase— y Prisma las ignora, que es por qué esto es inocuo. Se afirma
      // explícitamente para que si algún día dejaran de ser `undefined`, esta
      // prueba lo cace.
      const conValor = Object.entries(recibido).filter(([, v]) => v !== undefined);
      expect(Object.fromEntries(conValor)).toEqual(cuerpo);
    });

    it('🔴 vehículos · el MISMO formulario con los selects vacíos como "" ', async () => {
      // Ésta es la regresión que rompió producción: `400 carrier_id must be a
      // UUID`. La prueba de arriba usaba `null` y daba 200; el formulario real
      // puede mandar `''`, y `@IsOptional()` no saltea el string vacío.
      const cuerpo = {
        plate: 'AAA111', alias: '', brand: '', model: '',
        vehicle_type: 'truck', fuel_type: 'diesel', fuel_efficiency_lper100km: 0,
        avl_user_id: '', hub_asset_id: '', dictionary_category: '',
        carrier_id: '', image_front_url: '', image_rear_url: '', image_side_url: '',
      };
      servicios.vehicles.update.mockResolvedValue({ id: UUID });
      await request(app.getHttpServer()).put(`/api/v1/vehicles/${UUID}`).send(cuerpo).expect(200);

      // Y los ids vacíos llegan como `null`, no como '': un '' en una clave
      // foránea revienta en Prisma con un 500 evitable.
      const recibido = servicios.vehicles.update.mock.calls[0][2];
      expect(recibido.carrier_id).toBeNull();
      expect(recibido.avl_user_id).toBeNull();
    });

    it('🔴 vehículos · un carrier_id con dígito de versión fuera de 1-5', async () => {
      // `@IsUUID('all')` los rechazaba. Esta base la comparten tres productos y
      // tiene ids que no salieron de `uuid_generate_v4()`.
      servicios.vehicles.update.mockResolvedValue({ id: UUID });
      await request(app.getHttpServer())
        .put(`/api/v1/vehicles/${UUID}`)
        .send({ carrier_id: '22222222-2222-2222-2222-222222222222' })
        .expect(200);
    });

    it('conductores · DriverModal.tsx:103 con los campos opcionales vacíos', async () => {
      // El formulario manda `email/address/notes` como `undefined` cuando están
      // vacíos, y JSON.stringify descarta esas claves: nunca llegan al servidor.
      const cuerpo = {
        full_name: 'Juan Pérez', document: '30111222', license_number: 'B-9911',
        phone: '1155667788', status: 'active',
      };
      servicios.drivers.update.mockResolvedValue({ id: UUID });
      await request(app.getHttpServer()).put(`/api/v1/drivers/${UUID}`).send(cuerpo).expect(200);
      expect(servicios.drivers.update.mock.calls[0][2]).toEqual(cuerpo);
    });

    it('transportistas · CarrierModal.tsx:75 con contact_email vacío', async () => {
      // El '' es el caso que `@IsOptional()` NO cubre y que rompería el alta de
      // un transportista sin correo. Por eso el DTO usa `@ValidateIf`.
      const cuerpo = {
        name: 'Transportes Uno', tax_id: '30-1234', contact_name: 'Ana',
        contact_phone: '111', contact_email: '', address: 'Av 1',
        google_maps_link: '', operating_bases: 'Base 1', status: 'active',
      };
      servicios.carriers.update.mockResolvedValue({ id: UUID });
      await request(app.getHttpServer()).put(`/api/v1/carriers/${UUID}`).send(cuerpo).expect(200);
      expect(servicios.carriers.update.mock.calls[0][2]).toEqual(cuerpo);
    });

    it('transportistas · un correo mal escrito sí se rechaza', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/carriers/${UUID}`).send({ contact_email: 'no-es-un-correo' }).expect(400);
    });

    it('dispositivos · DevicesPage.tsx:68-74 pasa entero', async () => {
      const cuerpo = {
        name: 'GPS 1', imei: '860123456789012', device_code: '860123456789012',
        device_type: 'PORTABLE_GPS', status: 'ACTIVE', avl_user_id: null,
      };
      servicios.devices.update.mockResolvedValue({ id: UUID });
      await request(app.getHttpServer()).put(`/api/v1/devices/${UUID}`).send(cuerpo).expect(200);
      expect(servicios.devices.update.mock.calls[0][2]).toEqual(cuerpo);
    });

    it('usuarios · SettingsPage.tsx:195, el formulario completo', async () => {
      const cuerpo = { role_code: 'viewer', full_name: 'Otro A', entity_restrictions: {} };
      servicios.settings.updateUser.mockResolvedValue({ id: OTRO_USUARIO });
      await request(app.getHttpServer())
        .put(`/api/v1/settings/users/${OTRO_USUARIO}`).send(cuerpo).expect(200);
      expect(servicios.settings.updateUser.mock.calls[0][2]).toEqual(cuerpo);
    });

    it('usuarios · changeRole (SettingsPage.tsx:182), sólo role_code', async () => {
      servicios.settings.updateUser.mockResolvedValue({ id: OTRO_USUARIO });
      await request(app.getHttpServer())
        .put(`/api/v1/settings/users/${OTRO_USUARIO}`).send({ role_code: 'manager' }).expect(200);
    });

    it('diccionario AVL · AvlEventDictionaryPage.tsx:39 pasa entero', async () => {
      const cuerpo = {
        category: 'event.enum', raw_code: '901', event_type: 'panic',
        description: 'Botón de pánico', triggers_alert: true, severity: 'critical',
      };
      servicios.avl.addDictionaryEntry.mockResolvedValue({ id: UUID });
      await request(app.getHttpServer())
        .post(`/api/v1/avl-users/${UUID}/dictionary`).send(cuerpo).expect(201);
      expect(servicios.avl.addDictionaryEntry.mock.calls[0][2]).toEqual(cuerpo);
    });
  });

  // ── LAS DOS PRUEBAS NEGATIVAS DEL ENCARGO ──────────────────────────────
  describe('🔴 las dos pruebas negativas del encargo', () => {
    it('un PUT a /vehicles/:id con tenant_id FALLA, y no llega nada al servicio', async () => {
      // Ésta es la que motivó la tanda: el cuerpo crudo iba a Prisma y un
      // `tenant_id` MOVÍA el vehículo a otro cliente. No era una lectura
      // indebida: era una transferencia de propiedad.
      const res = await request(app.getHttpServer())
        .put(`/api/v1/vehicles/${UUID}`)
        .send({ alias: 'robado', tenant_id: TENANT_B })
        .expect(400);

      // El motivo importa tanto como el código: `should not exist` es la
      // respuesta específica de `forbidNonWhitelisted`. Afirmar sólo "falla"
      // dejaría pasar un DTO que aceptara el campo y lo rechazara por formato.
      expect(JSON.stringify(res.body.message)).toContain('tenant_id should not exist');
      // Lo que de verdad importa: el servicio NO se llamó. Ni siquiera con el
      // cuerpo depurado — la petición entera se rechaza.
      expect(servicios.vehicles.update).not.toHaveBeenCalled();
    });

    // ⚠️ Las pruebas de la escalada de roles NO van acá, y el motivo es
    // justamente lo que falló en producción: esta suite SIMULA `SettingsService`,
    // así que una regla que viva en el servicio quedaría simulada también — la
    // prueba estaría verificando el mock. Estaban acá, pasaban, y la ruta real
    // no rechazaba nada.
    //
    // Viven en `settings/escalada-rutas-reales.spec.ts`, que levanta los
    // servicios de VERDAD y sólo simula Prisma, y cubre las TRES rutas que
    // escriben `role_code` en vez de una.
  });

  // ── LA SUPERFICIE QUE EL PIPE CIERRA DE PASO ───────────────────────────
  describe('las otras cinco asignaciones masivas', () => {
    it.each([
      ['conductor', 'put', `/api/v1/drivers/${UUID}`, { tenant_id: TENANT_B }],
      ['transportista', 'put', `/api/v1/carriers/${UUID}`, { tenant_id: TENANT_B }],
      ['dispositivo', 'put', `/api/v1/devices/${UUID}`, { tenant_id: TENANT_B }],
      ['usuario', 'put', `/api/v1/settings/users/${OTRO_USUARIO}`, { tenant_id: TENANT_B }],
    ])('%s: tenant_id en el cuerpo → 400 por campo no permitido', async (_n, metodo, ruta, cuerpo) => {
      const res = await (request(app.getHttpServer()) as any)[metodo](ruta).send(cuerpo);
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('tenant_id should not exist');
    });

    it('usuario: password_hash en el cuerpo → 400', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/settings/users/${OTRO_USUARIO}`).send({ password_hash: 'loquesea' }).expect(400);
    });

    it('usuario: email en el cuerpo → 400 (es la clave de login y es única)', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/settings/users/${OTRO_USUARIO}`).send({ email: 'otro@x.com' }).expect(400);
    });

    it('diccionario: el cliente ya no elige el id de la fila → 400', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/avl-users/${UUID}/dictionary`)
        .send({ id: '00000000-dead-0000-0000-000000000000', raw_code: '902', event_type: 'x' })
        .expect(400);
    });

    it('diccionario: tampoco puede colgarla de OTRO avl_user → 400', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/avl-users/${UUID}/dictionary`)
        .send({ avl_user_id: '00000000-0000-0000-0000-000000000009', raw_code: '903', event_type: 'x' })
        .expect(400);
    });

    it('vehículo: is_blocked no se toca por esta ruta (tiene la suya)', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/vehicles/${UUID}`).send({ is_blocked: false }).expect(400);
    });
  });

  // ── LOS SEIS CAMPOS QUE LAS PANTALLAS MANDAN Y NO SON COLUMNAS ─────────
  describe('los seis campos inexistentes que mandan dos formularios', () => {
    it('conductores: email, address y notes → 400 que los nombra', async () => {
      // Antes esto era un 500 mudo de Prisma ("Unknown argument `email`").
      // Ahora es un 400 que dice cuáles sobran. Sigue rompiendo el guardado
      // si el operador los completa: que existan como columnas o salgan del
      // formulario es decisión de producto (Tanda 6).
      const res = await request(app.getHttpServer())
        .put(`/api/v1/drivers/${UUID}`)
        .send({ full_name: 'Juan', email: 'j@x.com', address: 'Calle 1', notes: 'nota' })
        .expect(400);
      const mensaje = JSON.stringify(res.body.message);
      expect(mensaje).toContain('email');
      expect(mensaje).toContain('address');
      expect(mensaje).toContain('notes');
    });

    it('transportistas: fleet_size, insurance_info y notes → 400 que los nombra', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/carriers/${UUID}`)
        .send({ name: 'T', fleet_size: 12, insurance_info: 'Póliza', notes: 'nota' })
        .expect(400);
      const mensaje = JSON.stringify(res.body.message);
      expect(mensaje).toContain('fleet_size');
      expect(mensaje).toContain('insurance_info');
      expect(mensaje).toContain('notes');
    });
  });

  // ── LO QUE ESTA SUITE LEVANTA TIENE QUE SER LO QUE CORRE EN PRODUCCIÓN ─
  describe('main.ts registra de verdad lo que esta suite simula', () => {
    // Esta suite arma su propio ValidationPipe. Si alguien lo saca de main.ts,
    // las 23 pruebas de arriba seguirían en verde sobre un backend desprotegido
    // — exactamente el tipo de falso verde de la Tanda 2. Estas dos leen el
    // archivo real.
    const main = readFileSync(join(__dirname, '..', '..', 'main.ts'), 'utf-8');

    it.each([
      ['useGlobalPipes', 'useGlobalPipes'],
      ['whitelist', 'whitelist: true'],
      ['forbidNonWhitelisted', 'forbidNonWhitelisted: true'],
      ['transform', 'transform: true'],
      ['sin conversión implícita', 'enableImplicitConversion: false'],
    ])('el pipe global declara %s', (_n, fragmento) => {
      expect(main).toContain(fragmento);
    });

    it('el filtro de excepciones está registrado globalmente', () => {
      expect(main).toContain('useGlobalFilters(new FiltroDeExcepciones())');
    });
  });

  // ── EL PIPE NO SE DERRAMA SOBRE LAS OTRAS RUTAS ────────────────────────
  it('una ruta sin DTO sigue recibiendo el cuerpo entero', async () => {
    // El pipe sólo valida cuando el parámetro está tipado con una clase. Éste
    // es el hecho que permite encender `forbidNonWhitelisted` de una vez: el
    // alcance son las rutas con DTO, no las 169.
    servicios.settings.updateUser.mockResolvedValue({});
    const res = await request(app.getHttpServer())
      .put(`/api/v1/settings/profile`).send({ cualquier_campo_raro: 1 });
    expect(res.status).not.toBe(400);
  });
});
