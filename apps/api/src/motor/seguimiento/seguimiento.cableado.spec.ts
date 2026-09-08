import { SeguimientoService } from './seguimiento.service';

/**
 * CABLEADO DEL SEGUIMIENTO — que el estado no cambie sin quedar registrado.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUÉ ESTA SUITE EXISTE ADEMÁS DE `estado-seguimiento.spec.ts`
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Aquélla prueba las REGLAS, que son funciones puras. Ésta prueba que alguien
 * las use y que el resultado llegue a la base.
 *
 * Es la lección que costó tres tandas y que se repitió cinco veces en este
 * proyecto: en la Tanda 5 se quitó el `INSERT` del worker y las 27 pruebas
 * siguieron en verde; en la Tanda 3, doce pruebas certificaban la regla de
 * roles mientras la ruta real no la llamaba. **Una prueba de una función pura
 * no prueba que alguien la llame.**
 *
 * Acá corre `SeguimientoService` de verdad, con un Prisma de mentira que
 * ANOTA EL SQL, y se afirma sobre lo que se escribió.
 *
 * ⚠️ LA PRUEBA NEGATIVA QUE PIDE LA ETAPA: quitar el `INSERT INTO
 * trip_state_history` de `persistir()` hace fallar «🔴 el cambio de estado
 * ESCRIBE el historial» y «🔴 historial y estado vigente van en la MISMA
 * transacción». Se verificó quitándolo, no suponiéndolo.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const VIAJE = 'dddd0001-0000-4000-8000-000000000001';
const USUARIO = 'uuuu0001-0000-4000-8000-000000000001';
const AHORA = new Date('2026-09-07T15:00:00Z');

/** Lo que devuelve cada consulta, según qué tabla toca. */
interface Mundo {
  etapa: { codigo: string; es_terminal: boolean; desde: Date };
  condiciones: any[];
  declaracion: any[];
  estadoVigente: any[];
  catalogo: any[];
}

const mundoPorDefecto = (): Mundo => ({
  etapa: { codigo: 'EN_CURSO', es_terminal: false, desde: new Date('2026-09-07T08:00:00Z') },
  condiciones: [],
  declaracion: [],
  estadoVigente: [],
  catalogo: [
    { codigo: 'PERNOCTE', riesgo_default: 'panorama_normal', orden: 10, declarable: true, activo: true },
  ],
});

function armar(mundo: Mundo) {
  /** El SQL que se ejecutó, en orden, y si fue dentro de una transacción. */
  const escrituras: { sql: string; enTransaccion: boolean }[] = [];

  const anotar = (enTransaccion: boolean) =>
    jest.fn((strings: TemplateStringsArray) => {
      escrituras.push({ sql: strings.join(' ? '), enTransaccion });
      return Promise.resolve(1);
    });

  const tx = { $executeRaw: anotar(true) };

  // El despacho es por el TEXTO de la consulta y no por el orden de llamada:
  // así el mock no se rompe si mañana se reordenan las lecturas.
  const responder = (sql: string) => {
    if (sql.includes('FROM trips')) return [mundo.etapa];
    if (sql.includes('FROM trip_conditions')) return mundo.condiciones;
    if (sql.includes("s.origen = 'manual'")) return mundo.declaracion;
    if (sql.includes('FROM trip_tracking_state')) return mundo.estadoVigente;
    if (sql.includes('FROM motor_tipos_condicion')) return mundo.catalogo;
    if (sql.includes('FROM motor_niveles_riesgo')) return [{ codigo: 'panorama_normal', orden: 10 }];
    return [];
  };

  const prisma = {
    $queryRaw: jest.fn((strings: TemplateStringsArray) =>
      Promise.resolve(responder(strings.join(' ? '))),
    ),
    $executeRaw: anotar(false),
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };

  return { servicio: new SeguimientoService(prisma as any), escrituras, prisma };
}

// ⚠️ Genéricos y no `{ sql: string }[]`: con el tipo angosto se perdía
// `enTransaccion` y `tsc --noEmit` fallaba con jest en verde. Es exactamente
// por qué `npm run verificar` corre los dos y no alcanza con las pruebas.
type Escritura = { sql: string; enTransaccion: boolean };
const historial = (e: Escritura[]): Escritura[] =>
  e.filter((x) => x.sql.includes('INSERT INTO trip_state_history'));
const vigente = (e: Escritura[]): Escritura[] =>
  e.filter((x) => x.sql.includes('INSERT INTO trip_tracking_state'));

describe('Seguimiento · el cableado del registro', () => {
  it('🔴 el cambio de estado ESCRIBE el historial', async () => {
    // Sin estado previo y sin condiciones, el estado pasa a ser el tramo del
    // ciclo de vida: es un cambio, y todo cambio se registra.
    const { servicio, escrituras } = armar(mundoPorDefecto());

    await servicio.recalcular(VIAJE, TENANT, AHORA);

    expect(historial(escrituras)).toHaveLength(1);
    expect(historial(escrituras)[0].sql).toContain("'seguimiento'");
  });

  it('🔴 historial y estado vigente van en la MISMA transacción', async () => {
    // Si no, un fallo entre medio deja un estado sin registro de cómo llegó
    // ahí — que es exactamente lo que esta etapa prohíbe.
    const { servicio, escrituras, prisma } = armar(mundoPorDefecto());

    await servicio.recalcular(VIAJE, TENANT, AHORA);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(historial(escrituras)[0].enTransaccion).toBe(true);
    expect(vigente(escrituras)[0].enTransaccion).toBe(true);
  });

  it('🔴 el historial se escribe ANTES que el estado vigente', async () => {
    const { servicio, escrituras } = armar(mundoPorDefecto());

    await servicio.recalcular(VIAJE, TENANT, AHORA);

    const orden = escrituras.map((e) =>
      e.sql.includes('trip_state_history') ? 'historial'
        : e.sql.includes('trip_tracking_state') ? 'vigente' : 'otro',
    );
    expect(orden).toEqual(['historial', 'vigente']);
  });

  it('🔴 registra las DOS fechas, que no son la misma', async () => {
    // Un teléfono que sincroniza datos viejos provoca una transición con fecha
    // de hace dos horas. Sin las dos fechas eso es indistinguible de algo que
    // acaba de pasar.
    const { servicio, escrituras } = armar(mundoPorDefecto());

    await servicio.recalcular(VIAJE, TENANT, AHORA);

    const sql = historial(escrituras)[0].sql;
    expect(sql).toContain('created_at');
    expect(sql).toContain('recibido_at');
  });

  it('el mismo estado recalculado NO escribe una transición nueva', async () => {
    const mundo = mundoPorDefecto();
    mundo.estadoVigente = [{
      estado: 'EN_CURSO', estado_origen: 'ciclo_vida', riesgo: 'panorama_normal',
      origen: 'deducido', condicion_id: null, declarado_por: null, nota: null,
      vigente_desde: new Date('2026-09-07T08:00:00Z'), actualizado_at: AHORA,
    }];
    const { servicio, escrituras } = armar(mundo);

    await servicio.recalcular(VIAJE, TENANT, AHORA);

    expect(escrituras).toHaveLength(0);
  });
});

describe('Seguimiento · el intento rechazado NO se descarta en silencio', () => {
  it('🔴 un código no declarable se RECHAZA y aun así queda registrado', async () => {
    const mundo = mundoPorDefecto();
    mundo.catalogo = [{
      codigo: 'SOS', riesgo_default: 'activacion_policial', orden: 40,
      declarable: false, activo: true,
    }];
    const { servicio, escrituras } = armar(mundo);

    const { veredicto, estado } = await servicio.declarar(
      VIAJE, TENANT, 'SOS', null, USUARIO, AHORA,
    );

    expect(veredicto.valida).toBe(false);
    expect(estado).toBeNull();

    // Lo que importa: la fila existe, con el motivo.
    const filas = historial(escrituras);
    expect(filas).toHaveLength(1);
    expect(filas[0].sql).toContain('aplicada');
    expect(filas[0].sql).toContain('motivo_rechazo');
    // Y NO se tocó el estado vigente: un rechazo no cambia nada.
    expect(vigente(escrituras)).toHaveLength(0);
  });

  it('🔴 un código que no existe en el catálogo también deja rastro', async () => {
    const mundo = mundoPorDefecto();
    mundo.catalogo = [];
    const { servicio, escrituras } = armar(mundo);

    const { veredicto } = await servicio.declarar(
      VIAJE, TENANT, 'INVENTADO', null, USUARIO, AHORA,
    );

    expect(veredicto.valida).toBe(false);
    expect(veredicto.motivo).toContain('no existe o está inactivo');
    expect(historial(escrituras)).toHaveLength(1);
  });

  it('una declaración válida escribe historial Y estado vigente', async () => {
    const { servicio, escrituras } = armar(mundoPorDefecto());

    const { veredicto, estado } = await servicio.declarar(
      VIAJE, TENANT, 'PERNOCTE', 'descanso reglamentario', USUARIO, AHORA,
    );

    expect(veredicto.valida).toBe(true);
    expect(estado?.estado).toBe('PERNOCTE');
    expect(estado?.origen).toBe('manual');
    expect(historial(escrituras)).toHaveLength(1);
    expect(vigente(escrituras)).toHaveLength(1);
  });
});

describe('Seguimiento · el vocabulario REAL del catálogo', () => {
  /**
   * ⚠️ POR QUÉ ESTA PRUEBA MIRA EL SQL Y NO EL COMPORTAMIENTO.
   *
   * La traducción de `resolucion` a «pegajosa» la hace la CONSULTA, no el
   * código: para cuando la fila llega al evaluador ya es un booleano. Así que
   * las 29 pruebas anteriores pasaban con la comparación equivocada —
   * `resolucion = 'manual'`, una palabra que el catálogo no usa— y la regla de
   * «el pánico gana siempre» estaba muerta en silencio.
   *
   * Lo encontró Gustavo al aplicar el script: los valores reales son
   * `automatico` y `operador`. Esta prueba fija esa lectura.
   */
  it('🔴 NO se compara contra una palabra que el catálogo no usa', async () => {
    const { servicio, prisma } = armar(mundoPorDefecto());
    await servicio.recalcular(VIAJE, TENANT, AHORA);

    const consultas = (prisma.$queryRaw.mock.calls as any[][]).map((c) =>
      (c[0] as TemplateStringsArray).join(' ? '),
    );
    const deCondiciones = consultas.find((q) => q.includes('FROM trip_conditions'));

    expect(deCondiciones).toBeDefined();
    expect(deCondiciones).not.toMatch(/resolucion\s*=\s*'manual'/);
  });

  it('🔴 una resolución DESCONOCIDA cuenta como pegajosa, no como automática', async () => {
    // El fallo seguro va para este lado: equivocarse por pegajosa deja un
    // estado visible de más; equivocarse por lo otro hace desaparecer un
    // pánico. `IS DISTINCT FROM` cubre el NULL y cualquier valor futuro.
    const { servicio, prisma } = armar(mundoPorDefecto());
    await servicio.recalcular(VIAJE, TENANT, AHORA);

    const deCondiciones = (prisma.$queryRaw.mock.calls as any[][])
      .map((c) => (c[0] as TemplateStringsArray).join(' ? '))
      .find((q) => q.includes('FROM trip_conditions'));

    expect(deCondiciones).toMatch(/IS DISTINCT FROM\s+'automatico'/);
  });
});

describe('Seguimiento · el aislamiento por cliente', () => {
  it('🔴 TODA consulta acota por tenant_id', async () => {
    // Es el principio que rige el producto. Una consulta sin acotar sobre una
    // tabla con `tenant_id` es una fuga que no se ve: devuelve datos de otro
    // cliente sin fallar.
    const { servicio, prisma } = armar(mundoPorDefecto());

    await servicio.recalcular(VIAJE, TENANT, AHORA);

    // ⚠️ SE MIRAN LOS VALORES ENLAZADOS, NO EL TEXTO.
    //
    // La primera versión afirmaba sobre el TEXTO de la consulta —buscaba la
    // palabra suelta en el SQL— y su reversión NO falló: saqué el filtro del
    // WHERE y la consulta siguió conteniendo esa palabra, porque el LATERAL del
    // catálogo de riesgo también la usa. Es el mismo error que la Tanda 8
    // encontró seis veces: preguntar si el TEXTO contiene una cadena en vez de
    // si el lugar que importa la usa.
    //
    // Comprobar que el id del cliente viaja como PARÁMETRO no se puede fingir:
    // si el filtro no está, el valor no se enlaza.
    const llamadas = prisma.$queryRaw.mock.calls as any[][];
    expect(llamadas.length).toBeGreaterThan(3);

    for (const llamada of llamadas) {
      const sql = (llamada[0] as TemplateStringsArray).join(' ? ');
      const valores = llamada.slice(1);
      expect({ sql, valores }).toMatchObject({ valores: expect.arrayContaining([TENANT]) });
    }
  });
});
