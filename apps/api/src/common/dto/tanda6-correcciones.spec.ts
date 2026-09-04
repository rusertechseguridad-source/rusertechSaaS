import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { globSync } from 'glob';

import { CarriersController } from '../../carriers/carriers.controller';
import { CarriersService } from '../../carriers/carriers.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { FiltroDeExcepciones } from '../filters/excepciones.filter';

/**
 * LAS CINCO CORRECCIONES DE LA TANDA 6, cada una contra lo que la produjo.
 *
 * Las cinco vienen de una verificación en pantalla, no de una lectura del
 * código. Por eso cada bloque de abajo prueba el SÍNTOMA que Gustavo vio, no
 * la función que lo causa: una prueba de la función pura ya pasó tres veces
 * en esta serie mientras el sistema real seguía roto.
 *
 * Cada `it` de barrido se probó al revés antes de confiar en él: se deshizo la
 * corrección y se comprobó que el `it` falla. Lo que no se pudo hacer fallar
 * no está acá.
 */

const UUID = '00000000-0000-4000-8000-000000000001';
const TENANT = '11111111-1111-4111-8111-111111111111';

// ── El frontend, para los barridos ──────────────────────────────────────────
// Corre desde `apps/api`, que es donde vive jest. La ruta se normaliza porque
// el separador de Windows ya rompió un barrido en la Tanda 4.
const WEB = join(__dirname, '..', '..', '..', '..', 'web', 'src');
const leer = (rel: string) => readFileSync(join(WEB, rel), 'utf-8');
const hayWeb = (() => { try { return globSync('**/*.tsx', { cwd: WEB }).length > 0; } catch { return false; } })();
const siHayWeb = hayWeb ? describe : describe.skip;

// ════════════════════════════════════════════════════════════════════════════
// 1 · TRANSPORTISTAS: las tres columnas nuevas
// ════════════════════════════════════════════════════════════════════════════
describe('Tanda 6 · 1 · transportistas · fleet_size, insurance_info y notes', () => {
  let app: INestApplication;
  const carriers = { create: jest.fn(), update: jest.fn(), findAll: jest.fn(), remove: jest.fn() };
  const guardQuePasa = {
    canActivate: (ctx: any) => {
      ctx.switchToHttp().getRequest().user = { tenantId: TENANT, userId: UUID, permissions: ['*'] };
      return true;
    },
  };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [CarriersController],
      providers: [{ provide: CarriersService, useValue: carriers }],
    })
      .overrideGuard(JwtAuthGuard).useValue(guardQuePasa)
      .overrideGuard(PermissionsGuard).useValue(guardQuePasa)
      .compile();

    app = modulo.createNestApplication();
    // Idénticas a main.ts. Si allá cambian y acá no, esto deja de probar lo
    // que corre en producción.
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false, exposeUnsetFields: false },
    }));
    app.useGlobalFilters(new FiltroDeExcepciones());
    await app.init();
  });

  afterAll(async () => { await app?.close(); });
  beforeEach(() => { jest.clearAllMocks(); });

  it('🔴 el síntoma exacto: el cuerpo del formulario ya NO se rechaza', async () => {
    // Este es el cuerpo que manda `CarrierModal.tsx`. Antes devolvía
    // "property fleet_size should not exist" y el transportista no se guardaba.
    const cuerpo = {
      name: 'Transportes Uno', tax_id: '30-1234', contact_name: 'Ana',
      contact_phone: '111', contact_email: '', address: 'Av 1',
      google_maps_link: '', operating_bases: 'Base 1',
      fleet_size: 12, insurance_info: 'Póliza 998', notes: 'Opera de noche',
      status: 'active',
    };
    carriers.update.mockResolvedValue({ id: UUID });
    await request(app.getHttpServer()).put(`/api/v1/carriers/${UUID}`).send(cuerpo).expect(200);
    expect(carriers.update.mock.calls[0][2]).toEqual(cuerpo);
  });

  it('fleet_size llega como string desde el <input> y se guarda como número', async () => {
    // La advertencia de Gustavo. El pipe corre con `enableImplicitConversion:
    // false`, así que sin el `@Transform` del DTO un "12" sería rechazado por
    // `@IsInt`. Se prueba con el string, no con el número.
    carriers.update.mockResolvedValue({ id: UUID });
    await request(app.getHttpServer())
      .put(`/api/v1/carriers/${UUID}`).send({ fleet_size: '12' }).expect(200);
    const recibido = carriers.update.mock.calls[0][2];
    expect(recibido.fleet_size).toBe(12);
    expect(typeof recibido.fleet_size).toBe('number');
  });

  it('el campo vacío se guarda como null, NO como 0', async () => {
    // Una flota de tamaño desconocido no es una flota de cero camiones, y la
    // columna es nullable (verificado contra information_schema).
    carriers.update.mockResolvedValue({ id: UUID });
    await request(app.getHttpServer())
      .put(`/api/v1/carriers/${UUID}`).send({ fleet_size: '' }).expect(200);
    expect(carriers.update.mock.calls[0][2].fleet_size).toBeNull();
  });

  it('un fleet_size que no es número se rechaza, y el mensaje lo nombra', async () => {
    // Sin esto, `Number('abc')` sería NaN y `@IsInt` lo dejaría pasar en
    // algunos caminos. El `@Transform` devuelve el original a propósito.
    const res = await request(app.getHttpServer())
      .put(`/api/v1/carriers/${UUID}`).send({ fleet_size: 'muchos' }).expect(400);
    expect(JSON.stringify(res.body)).toMatch(/fleet_size/);
  });

  it('🔴 el ALTA usa el mismo DTO que la edición', async () => {
    // El alta y la edición son el MISMO formulario (`CarrierModal` elige POST
    // o PUT). Con el alta sin DTO, `fleet_size: '12'` habría entrado como
    // string a Prisma y el `id` elegido por el cliente habría pasado por el
    // spread del servicio.
    carriers.create.mockResolvedValue({ id: UUID });
    await request(app.getHttpServer())
      .post('/api/v1/carriers')
      .send({ name: 'Nuevo', fleet_size: '7', id: 'un-id-elegido-por-el-cliente' })
      .expect(400); // `forbidNonWhitelisted` corta por el `id`

    carriers.create.mockClear();
    await request(app.getHttpServer())
      .post('/api/v1/carriers').send({ name: 'Nuevo', fleet_size: '7' }).expect(201);
    expect(carriers.create.mock.calls[0][1].fleet_size).toBe(7);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2 · PERMISOS: mostrar siempre, deshabilitar con el motivo
// ════════════════════════════════════════════════════════════════════════════
siHayWeb('Tanda 6 · 2 · nunca esconder un control de escritura', () => {
  // Las cuatro pantallas nombradas en la verificación. No es toda la app: lo
  // que queda envuelto en `RequirePermission` está enumerado en el reporte.
  const PANTALLAS = [
    'pages/vehicles/VehiclesPage.tsx',
    'pages/carriers/CarriersPage.tsx',
    'pages/drivers/DriversPage.tsx',
    'pages/devices/DevicesPage.tsx',
  ];

  it.each(PANTALLAS)('🔴 %s ya no esconde botones con RequirePermission', (rel) => {
    // El envoltorio escondía el botón ANTES de que el `disabled` se dibujara:
    // el `title` con el motivo era código muerto. Se busca el uso como
    // etiqueta JSX, no el nombre suelto, para no dar por bueno un comentario
    // que lo mencione.
    expect(leer(rel)).not.toMatch(/<RequirePermission[\s>]/);
  });

  it.each(PANTALLAS)('%s deshabilita con el motivo, y el motivo nombra el permiso', (rel) => {
    const t = leer(rel);
    expect(t).toMatch(/propsSinPermiso\(/);
    // El segundo argumento es la clave del permiso: sin él el operador no
    // sabe cuál pedirle a su administrador.
    expect(t).toMatch(/propsSinPermiso\(\s*\w+\s*,\s*'[a-z_]+'/);
    // Y se tiene que VER deshabilitado.
    expect(t).toMatch(/CLASES_DESHABILITADO/);
  });

  it('🔴 el menú muestra los ítems sin permiso, apagados, en vez de omitirlos', () => {
    const t = leer('layouts/AppLayout.tsx');
    // Las dos preguntas separadas: fuera de alcance (se esconde) vs. sin
    // permiso (se muestra apagado). Con un solo `puedeVer` que devolvía false,
    // el ítem de Dispositivos no existía para `operator`.
    expect(t).toMatch(/estaFueraDeAlcance/);
    expect(t).toMatch(/estaHabilitado/);
    expect(t).not.toMatch(/const puedeVer =/);
    // Y el ítem apagado se dibuja de verdad, con el motivo.
    expect(t).toMatch(/aria-disabled/);
    expect(t).toMatch(/motivoSinPermiso\(/);
  });

  it('el motivo nombra el permiso que falta', () => {
    // `motivoSinPermiso` es la única fuente del texto; si deja de interpolar
    // el permiso, el administrador vuelve a tener que adivinar entre veinte.
    const t = leer('components/RequirePermission.tsx');
    expect(t).toMatch(/export function motivoSinPermiso/);
    expect(t).toMatch(/Requiere el permiso \$\{permission\}/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3 · SENSORES: la puerta cerrada desde afuera
// ════════════════════════════════════════════════════════════════════════════
siHayWeb('Tanda 6 · 3 · configurar el primer sensor', () => {
  it('🔴 el tablero tiene una entrada para configurar un vehículo sin sensores', () => {
    const t = leer('pages/sensors/SensorsDashboardPage.tsx');
    // Antes, `SensorConfigModal` sólo se abría desde `TripDetailsPage`: había
    // que entrar a un viaje para llegar. Con `sensor_configs` vacía —0 filas,
    // medido en la base— la pantalla no tenía ninguna salida.
    expect(t).toMatch(/<SensorConfigModal[\s>]/);
    expect(t).toMatch(/<SelectorVehiculoSensor[\s>]/);
  });

  it('el selector de vehículo existe y no se arma con la lista del tablero', () => {
    // El tablero sólo conoce los vehículos QUE YA TIENEN sensor. Si el
    // selector se alimentara de ahí, seguiría sin poder configurarse el
    // primero: tiene que pedir `/vehicles`.
    const ruta = join(WEB, 'pages/sensors/SelectorVehiculoSensor.tsx');
    expect(existsSync(ruta)).toBe(true);
    expect(readFileSync(ruta, 'utf-8')).toMatch(/api\/v1\/vehicles/);
  });

  it('el vacío por tabla vacía no se confunde con el vacío por filtro', () => {
    // "No se encontraron sensores o vehículos para tu búsqueda" era falso
    // cuando no había ninguna búsqueda: no había nada configurado.
    const t = leer('pages/sensors/SensorsDashboardPage.tsx');
    expect(t).toMatch(/data\.length === 0/);
    expect(t).toMatch(/sensors\.empty_title/);
  });

  it('🔴 el modal lee las columnas reales: value_min / value_max', () => {
    // Segunda mitad del hallazgo de cadena de frío. Arreglar el filtro por
    // `scope_id` no alcanzaba: se leía `min_value` / `max_value`, que no
    // existen. El vehículo ya configurado se veía en blanco, y guardar pisaba
    // sus umbrales buenos.
    const t = leer('pages/sensors/SensorConfigModal.tsx');
    expect(t).toMatch(/numero\(tc\.value_min\)/);
    expect(t).toMatch(/numero\(hc\.value_max\)/);
    // Ninguna LECTURA por el nombre invertido. (`value_min:` como clave del
    // cuerpo que se manda sí está, y es lo correcto.)
    expect(t).not.toMatch(/\.\s*min_value/);
    expect(t).not.toMatch(/\.\s*max_value/);
  });

  it('no se guarda un umbral incompleto: las columnas son NOT NULL', () => {
    const t = leer('pages/sensors/SensorConfigModal.tsx');
    expect(t).toMatch(/rangoInvalido/);
    expect(t).toMatch(/Completá el mínimo y el máximo/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4 · VEHÍCULOS: quitar y reemplazar imágenes
// ════════════════════════════════════════════════════════════════════════════
siHayWeb('Tanda 6 · 4 · las imágenes del vehículo se pueden quitar', () => {
  it('🔴 existe un camino para volver a "sin imagen"', () => {
    const ruta = join(WEB, 'pages/vehicles/CampoImagenVehiculo.tsx');
    expect(existsSync(ruta)).toBe(true);
    const t = readFileSync(ruta, 'utf-8');
    // Quitar = mandar '' hacia arriba. El formulario lo convierte en `null` al
    // guardar (`imageFrontUrl || null`), y la columna es nullable.
    expect(t).toMatch(/onCambiar\(''\)/);
  });

  it('el formulario usa el componente en los tres lados, sin inputs sueltos', () => {
    const t = leer('pages/vehicles/VehiclesPage.tsx');
    expect((t.match(/<CampoImagenVehiculo/g) ?? []).length).toBe(3);
    // El bloque repetido tres veces ya no está.
    expect(t).not.toMatch(/type="file"/);
  });

  it('una subida fallida se avisa, y el mismo archivo se puede reintentar', () => {
    const t = readFileSync(join(WEB, 'pages/vehicles/CampoImagenVehiculo.tsx'), 'utf-8');
    // Antes: `if (res.ok)` sin `else` y un `catch` con `console.error`. El
    // operador elegía el archivo y no pasaba nada.
    expect(t).toMatch(/avisar\.error\(/);
    // Y el `<input type=file>` no dispara `change` con el mismo valor: sin
    // limpiarlo, reintentar era imposible sin recargar la página.
    expect(t).toMatch(/inputRef\.current\.value = ''/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5 · EL CONTADOR DEL LOG
// ════════════════════════════════════════════════════════════════════════════
describe('Tanda 6 · 5 · el contador de monitoreo cuenta los manuales', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { VehiculosActivosService } = require('../../motor/vehiculos-activos.service');

  const armar = (deltas: number[], filas: { motivo: string; total: bigint }[]) => {
    const prisma: any = {
      $executeRaw: jest.fn()
        .mockResolvedValueOnce(deltas[0])
        .mockResolvedValueOnce(deltas[1])
        .mockResolvedValueOnce(deltas[2]),
      $queryRaw: jest.fn().mockResolvedValue(filas),
    };
    return { servicio: new VehiculosActivosService(prisma), prisma };
  };

  it('🔴 el resultado incluye los vehículos activados a mano', async () => {
    // El síntoma: "4 por estado, 0 por red de seguridad, 0 bajas" con un
    // vehículo activado a mano que no aparecía por ningún lado. Los tres
    // números son el DELTA de la corrida; las activaciones manuales no pasan
    // por `sincronizar`, así que nunca podían salir ahí.
    const { servicio } = armar([4, 0, 0], [
      { motivo: 'estado', total: 4n },
      { motivo: 'manual', total: 1n },
    ]);
    const r = await servicio.sincronizar();

    expect(r.activados_por_estado).toBe(4);
    expect(r.total_monitoreados).toBe(5);
    expect(r.por_motivo).toEqual({ estado: 4, manual: 1 });
  });

  it('la línea del log dice el total y el desglose, no sólo el delta', async () => {
    const { servicio } = armar([4, 0, 0], [
      { motivo: 'estado', total: 4n },
      { motivo: 'manual', total: 1n },
    ]);
    const escritas: string[] = [];
    jest.spyOn((servicio as any).logger, 'log').mockImplementation((m: any) => { escritas.push(String(m)); });

    await servicio.sincronizar();

    expect(escritas).toHaveLength(1);
    expect(escritas[0]).toMatch(/quedan 5 monitoreados/);
    expect(escritas[0]).toMatch(/1 manual/);
  });

  it('el BigInt de count(*) no se suma como texto', async () => {
    // `BigInt + number` explota en runtime y `'4' + 1` daría '41'. Los dos
    // fallos se ven igual desde el log: un número imposible.
    const { servicio } = armar([1, 0, 0], [
      { motivo: 'estado', total: 10n },
      { motivo: 'manual', total: 2n },
    ]);
    const r = await servicio.sincronizar();
    expect(r.total_monitoreados).toBe(12);
    expect(typeof r.total_monitoreados).toBe('number');
  });

  it('sin cambios no escribe la línea, pero igual devuelve el estado', async () => {
    // La línea se emite sólo cuando algo cambió; el estado se calcula siempre,
    // porque lo consumen las pruebas y podría consumirlo el panel del motor.
    const { servicio } = armar([0, 0, 0], [{ motivo: 'manual', total: 3n }]);
    const escritas: string[] = [];
    jest.spyOn((servicio as any).logger, 'log').mockImplementation((m: any) => { escritas.push(String(m)); });

    const r = await servicio.sincronizar();
    expect(escritas).toEqual([]);
    expect(r.total_monitoreados).toBe(3);
  });

  it('una activación manual deja rastro en el log', async () => {
    // Hasta ahora no dejaba ninguno: el operador activaba un vehículo y el
    // sistema no decía nada.
    const prisma: any = {
      vehicle: { findFirst: jest.fn().mockResolvedValue({ id: UUID, tenant_id: TENANT }) },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const servicio = new VehiculosActivosService(prisma);
    const escritas: string[] = [];
    jest.spyOn((servicio as any).logger, 'log').mockImplementation((m: any) => { escritas.push(String(m)); });

    await servicio.activarManual(UUID, TENANT, null);

    expect(escritas).toHaveLength(1);
    expect(escritas[0]).toMatch(/Monitoreo activado a mano/);
    expect(escritas[0]).toMatch(UUID);
  });
});
