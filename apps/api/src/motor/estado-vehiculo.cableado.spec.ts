import { EstadoVehiculoService } from './estado-vehiculo.service';
import { MotorWorker } from './motor.worker';
import type { EstadoVehiculo, PuntoEvaluable } from './tipos';

/**
 * CABLEADO DEL ESTADO DEL VEHÍCULO — que la posición LLEGUE a la base.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUÉ ESTA SUITE EXISTE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `barrerSinReporte` leía `motor_estado_vehiculo.ultimo_punto` para preguntar
 * si el vehículo callado estaba dentro de una zona sin cobertura. El INSERT de
 * `EstadoVehiculoService` **no escribía esa columna**. Ni en el INSERT ni en el
 * UPDATE. Nunca, para ningún vehículo.
 *
 * No fallaba nada. La latitud llegaba en `null`, el barrido salteaba la
 * consulta de zona y aplicaba el umbral normal. Medido en producción: dos
 * filas, dos con `ultimo_punto_ts`, **cero con `ultimo_punto`**. La supresión
 * por zona sin señal estaba apagada, con 475 pruebas en verde y `tsc` en cero.
 *
 * ⚠️ POR QUÉ NINGUNA PRUEBA LO VIO. Las del evaluador le pasan las coordenadas
 * YA RESUELTAS: prueban la REGLA, no el viaje del dato. Es la forma inversa del
 * defecto de la 3A — allá un método que nadie llamaba, acá un dato que se lee y
 * nadie escribe. Las dos invisibles al compilador y a las pruebas de unidad.
 *
 * Acá corre el SERVICIO de verdad, con un Prisma de mentira que ANOTA EL SQL y
 * los valores enlazados, y el worker de verdad encima. Se afirma sobre lo que
 * se escribió, no sobre lo que se calculó.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ LAS REVERSIONES QUE LA DEMUESTRAN — verificadas, no supuestas
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Corridas contra esta suite MÁS `reglas.spec.ts` (26 pruebas en total):
 *
 *   A · Quitar `ultimo_punto` del INSERT (columna y valor) → CAEN 5:
 *       «entra en el INSERT», «el orden es (lng, lat)», «sin punto va en
 *       NULL», «el worker lleva las coordenadas» y «la fecha y el lugar salen
 *       del mismo punto».
 *
 *       ⚠️ R18 NO CAE, y lo dejo escrito porque lo había supuesto al revés.
 *       La regla pregunta si la columna tiene ALGÚN escritor, y con el
 *       `DO UPDATE SET` todavía puesto lo tiene. Caza el defecto REAL —el que
 *       no estaba en ninguna de las dos ramas, medido: antes de la corrección
 *       R18 daba exactamente `motor_estado_vehiculo.ultimo_punto`— pero no
 *       esta mutilación a medias. Ésa la caza esta suite. Es el reparto, y es
 *       medido, no declarado.
 *
 *   B · Quitar `ultimo_punto = EXCLUDED.ultimo_punto` del DO UPDATE → CAE 1:
 *       «la posición se ACTUALIZA, no sólo se inserta». R18 tampoco cae, por
 *       lo mismo. Y es el caso más peligroso de los tres: el vehículo que ya
 *       tiene fila —o sea, todos, desde el segundo lote— se quedaría con la
 *       primera posición conocida para siempre. Una zona sin señal de hace un
 *       mes contestando sobre un camión que está en otra provincia. Peor que
 *       la columna vacía, porque parece llena.
 *
 *   C · Invertir a `ST_MakePoint(lat, lng)` → CAEN 3: las que miran los
 *       valores ENLAZADOS. Ninguna de las que mira sólo el texto, porque el
 *       texto es idéntico. Sin esto el punto se escribe en otro lugar del
 *       mundo —para estas coordenadas, el Atlántico frente a África— y la zona
 *       sin señal deja de encontrarse: la función queda tan apagada como
 *       estaba, pero ahora con la columna llena.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const VEHICULO = 'aaaa0001-0000-4000-8000-000000000001';
const LAT = -34.6037;
const LNG = -58.3816;
const T0 = new Date('2026-09-21T12:00:00Z');

/** Una escritura tal como salió: el SQL y los valores, ya entrelazados. */
interface Escritura {
  sql: string;
  valores: unknown[];
  /** El SQL con cada valor puesto en su lugar, entre comillas francesas. */
  conValores: string;
}

/**
 * ⚠️ SE MIRAN LOS VALORES ENLAZADOS Y NO SÓLO EL TEXTO.
 *
 * Es la lección de la Tanda 8 y de la 3A: preguntar si el TEXTO contiene una
 * cadena no es preguntar si el lugar que importa la usa. El texto de esta
 * consulta contendría `ST_MakePoint` igual aunque le pasaran dos constantes, o
 * los argumentos al revés. Entrelazar los valores es lo que no se puede fingir.
 */
function anotador() {
  const escrituras: Escritura[] = [];
  const registrar = (strings: TemplateStringsArray, ...valores: unknown[]) => {
    const conValores = strings.reduce(
      (acc, trozo, i) => acc + trozo + (i < valores.length ? `«${String(valores[i])}»` : ''),
      '',
    );
    escrituras.push({ sql: strings.join(' ? '), valores, conValores });
    return Promise.resolve(1);
  };
  return { escrituras, registrar };
}

function armarServicio() {
  const { escrituras, registrar } = anotador();
  const prisma = {
    $executeRaw: jest.fn(registrar),
    $queryRaw: jest.fn((strings: TemplateStringsArray, ...v: unknown[]) => {
      registrar(strings, ...v);
      return Promise.resolve([]);
    }),
  };
  return { servicio: new EstadoVehiculoService(prisma as any), escrituras, prisma };
}

const estadoBase = (over: Partial<EstadoVehiculo> = {}): EstadoVehiculo => ({
  vehicle_id: VEHICULO,
  tenant_id: TENANT,
  ultimo_punto_ts: T0,
  ultima_latitud: LAT,
  ultima_longitud: LNG,
  ultima_velocidad: 40,
  ultima_ignicion: true,
  detenido_desde: null,
  geocercas_dentro: [],
  ...over,
});

const alEstado = (e: Escritura[]): Escritura[] =>
  e.filter((x) => x.sql.includes('INSERT INTO motor_estado_vehiculo'));

/** Lo que va entre `ST_MakePoint(` y el `)` que lo cierra. */
const argumentosDelPunto = (sql: string): string => {
  const i = sql.indexOf('ST_MakePoint(');
  if (i < 0) return '';
  return sql.slice(i + 'ST_MakePoint('.length, sql.indexOf(')', i));
};

describe('EstadoVehiculo · la posición llega a la base', () => {
  it('🔴 la posición ENTRA en el INSERT, con nombre de columna y valor', async () => {
    const { servicio, escrituras } = armarServicio();

    await servicio.guardar(estadoBase(), T0);

    const [escritura] = alEstado(escrituras);
    expect(escritura).toBeDefined();

    // La columna, en la lista del INSERT y no sólo mencionada en un comentario.
    const columnas = escritura.sql.slice(
      escritura.sql.indexOf('motor_estado_vehiculo ('),
      escritura.sql.indexOf(') VALUES'),
    );
    expect(columnas).toContain('ultimo_punto_ts');
    expect(columnas).toContain('ultimo_punto,');

    // Y el valor: las coordenadas viajan enlazadas, no incrustadas.
    expect(escritura.valores).toContain(LAT);
    expect(escritura.valores).toContain(LNG);
  });

  it('🔴 la posición se ACTUALIZA, no sólo se inserta', async () => {
    // Un vehículo que ya tiene fila pasa SIEMPRE por el DO UPDATE. Si la
    // columna estuviera sólo en el INSERT, se congelaría en la primera
    // posición conocida: una zona sin señal de hace un mes contestando sobre
    // un camión que está en otra provincia. Peor que vacía.
    const { servicio, escrituras } = armarServicio();

    await servicio.guardar(estadoBase(), T0);

    const set = alEstado(escrituras)[0].sql.split('DO UPDATE SET')[1] ?? '';
    expect(set).toContain('ultimo_punto');
    expect(set).toMatch(/ultimo_punto\s*=\s*EXCLUDED\.ultimo_punto/);
  });

  it('🔴 el orden es (longitud, latitud) — el de PostGIS, no el del habla', async () => {
    // ⚠️ Invertirlo no rompe nada visible: escribe un punto en otro lugar del
    // mundo. En estas coordenadas, (lat, lng) cae en el Atlántico frente a
    // África. La zona sin señal simplemente deja de encontrarse, y la función
    // queda tan apagada como estaba, pero ahora con la columna llena — que es
    // más difícil de descubrir.
    const { servicio, escrituras } = armarServicio();

    await servicio.guardar(estadoBase(), T0);

    const argumentos = argumentosDelPunto(alEstado(escrituras)[0].conValores);
    expect(argumentos).toBe(`«${LNG}»::float8, «${LAT}»::float8`);
  });

  it('🔴 sin punto todavía, la posición va en NULL y no en cero', async () => {
    // Cero, cero es un lugar real —el golfo de Guinea— y ahí no hay ningún
    // camión. `ST_MakePoint` es STRICT: con un argumento nulo devuelve NULL,
    // que es lo que corresponde guardar. Verificado contra la base.
    const { servicio, escrituras } = armarServicio();

    await servicio.guardar(estadoBase({ ultima_latitud: null, ultima_longitud: null }), T0);

    const argumentos = argumentosDelPunto(alEstado(escrituras)[0].conValores);
    expect(argumentos).toBe('«null»::float8, «null»::float8');
  });

  it('🔴 la posición se LEE de vuelta, para que una escritura no la borre', async () => {
    // `guardar` escribe el estado entero. Si `cargar` no trajera estas dos, una
    // escritura que no viniera del bucle de puntos las pondría en null: la
    // columna volvería a estar vacía, por otra vía.
    const { servicio, escrituras } = armarServicio();

    await servicio.cargar([VEHICULO]);

    const lectura = escrituras.find((e) => e.sql.includes('motor_estado_vehiculo'));
    expect(lectura).toBeDefined();
    expect(lectura!.sql).toContain('ST_Y(e.ultimo_punto');
    expect(lectura!.sql).toContain('ST_X(e.ultimo_punto');
  });
});

describe('EstadoVehiculo · el camino completo, desde el punto', () => {
  /**
   * ⚠️ ÉSTA ES LA QUE HABRÍA CAZADO EL DEFECTO.
   *
   * Las anteriores prueban que el SERVICIO escribe lo que se le pide. Ésta
   * prueba que el WORKER se lo pida: corre `procesarVehiculo` de verdad, con
   * el `EstadoVehiculoService` de verdad, y mira el SQL que sale del otro
   * extremo. Entre el punto que entra y la columna que se escribe no queda
   * ningún tramo sin probar.
   */
  it('🔴 el worker lleva las coordenadas del punto hasta el SQL', async () => {
    const { escrituras, registrar } = anotador();
    const prisma = {
      $executeRaw: jest.fn(registrar),
      $queryRaw: jest.fn(() => Promise.resolve([])),
    };
    const servicio = new EstadoVehiculoService(prisma as any);

    const worker = new MotorWorker(
      { persistir: jest.fn().mockResolvedValue(1) } as any,
      {} as any,
      servicio,
      {} as any, {} as any, {} as any, {} as any,
      { recalcular: jest.fn().mockResolvedValue(undefined) } as any,
      {
        abiertasDe: jest.fn().mockResolvedValue(new Map()),
        contextoDeParada: jest.fn().mockResolvedValue({
          enParadaAutorizada: false, nombreUbicacion: null, abiertas: new Set(),
        }),
        contextoDeDesvio: jest.fn().mockResolvedValue({
          distanciaMetros: null, corredorMetros: 500, abierta: false, inicioAbierta: null,
        }),
        aplicar: jest.fn().mockResolvedValue(0),
        barrerSinReporte: jest.fn().mockResolvedValue(0),
      } as any,
    );

    const punto: PuntoEvaluable = {
      cola_id: '1',
      telemetry_id: 'tttt0001-0000-4000-8000-000000000001',
      tenant_id: TENANT,
      vehicle_id: VEHICULO,
      trip_id: null,
      timestamp: T0,
      latitude: LAT,
      longitude: LNG,
      speed_kmh: 40,
      ignition: true,
      temperature_c: null,
      provider_code: null,
      origen: 'hub',
    };

    await (worker as any).procesarVehiculo(
      VEHICULO,
      TENANT,
      [punto],
      undefined,
      { eval_geocercas: false, eval_protocolos: false, parada_minutos: 5 } as any,
      new Map(),
      new Map(),
      [],
    );

    const [escritura] = alEstado(escrituras);
    expect(escritura).toBeDefined();
    expect(argumentosDelPunto(escritura.conValores)).toBe(`«${LNG}»::float8, «${LAT}»::float8`);
  });

  it('🔴 la fecha y el lugar salen del MISMO punto', async () => {
    // Con dos puntos, el estado guardado tiene que describir el último y no una
    // mezcla. Una fecha de un punto con las coordenadas de otro daría una
    // respuesta sobre un lugar donde el vehículo no estuvo, y no se vería: la
    // consulta de zona devolvería una zona, sólo que la equivocada.
    const { escrituras, registrar } = anotador();
    const prisma = {
      $executeRaw: jest.fn(registrar),
      $queryRaw: jest.fn(() => Promise.resolve([])),
    };
    const servicio = new EstadoVehiculoService(prisma as any);
    const worker = new MotorWorker(
      { persistir: jest.fn().mockResolvedValue(1) } as any,
      {} as any, servicio, {} as any, {} as any, {} as any, {} as any,
      { recalcular: jest.fn().mockResolvedValue(undefined) } as any,
      {
        abiertasDe: jest.fn().mockResolvedValue(new Map()),
        contextoDeParada: jest.fn().mockResolvedValue({
          enParadaAutorizada: false, nombreUbicacion: null, abiertas: new Set(),
        }),
        contextoDeDesvio: jest.fn().mockResolvedValue({
          distanciaMetros: null, corredorMetros: 500, abierta: false, inicioAbierta: null,
        }),
        aplicar: jest.fn().mockResolvedValue(0),
        barrerSinReporte: jest.fn().mockResolvedValue(0),
      } as any,
    );

    const base = {
      cola_id: '1', telemetry_id: 'tttt0001-0000-4000-8000-000000000001',
      tenant_id: TENANT, vehicle_id: VEHICULO, trip_id: null,
      speed_kmh: 40, ignition: true, temperature_c: null,
      provider_code: null, origen: 'hub' as const,
    };
    const T1 = new Date('2026-09-21T12:05:00Z');

    await (worker as any).procesarVehiculo(
      VEHICULO, TENANT,
      [
        { ...base, timestamp: T0, latitude: LAT, longitude: LNG },
        { ...base, cola_id: '2', timestamp: T1, latitude: -31.4201, longitude: -64.1888 },
      ],
      undefined,
      { eval_geocercas: false, eval_protocolos: false, parada_minutos: 5 } as any,
      new Map(), new Map(), [],
    );

    const escritura = alEstado(escrituras)[0];
    // Los dos del SEGUNDO punto: Córdoba, no Buenos Aires, y las 12:05.
    expect(argumentosDelPunto(escritura.conValores)).toBe('«-64.1888»::float8, «-31.4201»::float8');

    // ⚠️ La fecha se mira EN SU LUGAR y no en la lista de valores. `T0` está
    // en esa lista con todo derecho: es el `detenido_desde`, que sí viene del
    // primer punto. Un `not.toContain(T0)` sobre la lista entera fallaba
    // contra código correcto — el mismo error de mirar el archivo en vez del
    // lugar que importa, esta vez en mi propia prueba.
    const antesDelPunto = escritura.conValores.slice(
      escritura.conValores.indexOf('VALUES ('),
      escritura.conValores.indexOf('ST_MakePoint('),
    );
    // `String(fecha)` y no `toISOString()`: el anotador entrelaza con `String`,
    // que de una fecha da el formato largo. Compararlo contra el ISO fallaba
    // contra código correcto.
    expect(antesDelPunto).toContain(`«${String(T1)}»`);
    expect(antesDelPunto).not.toContain(`«${String(T0)}»`);
  });
});
