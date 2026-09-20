import { MotorWorker } from '../motor.worker';
import { CondicionesService } from './condiciones.service';
import type { PuntoEvaluable } from '../tipos';

/**
 * CABLEADO DE LAS CONDICIONES — que los evaluadores estén ENCHUFADOS.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUÉ ESTA SUITE, ADEMÁS DE `evaluadores.spec.ts`
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Aquélla prueba las REGLAS. Ésta prueba que el worker las llame y que el
 * resultado llegue a la base.
 *
 * En la 3A `recalcular()` quedó escrito, con 31 pruebas propias, y sin un solo
 * llamador: el estado del operador se quedó en null con dos condiciones
 * abiertas. **Cuatro evaluadores nuevos son cuatro oportunidades de repetirlo.**
 * R17 lo vigila de forma general; esto lo prueba ejecutando.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const VEHICULO = 'aaaa0001-0000-4000-8000-000000000001';
const VIAJE = 'dddd0001-0000-4000-8000-000000000001';
const T0 = new Date('2026-09-08T12:00:00Z');

const CFG = {
  eval_geocercas: false, eval_protocolos: false, eval_desvio: true,
  parada_minutos: 10, parada_velocidad_kmh: 5,
  parada_prolongada_minutos: 60, sin_reporte_minutos: 20,
} as any;

const punto = (over: Partial<PuntoEvaluable> = {}): PuntoEvaluable => ({
  cola_id: '1', telemetry_id: 'tttt0001-0000-4000-8000-000000000001',
  tenant_id: TENANT, vehicle_id: VEHICULO, trip_id: VIAJE,
  timestamp: T0, latitude: -34.6037, longitude: -58.3816,
  speed_kmh: 0, ignition: true, temperature_c: null,
  provider_code: null, origen: 'hub', ...over,
});

function armar(over: any = {}) {
  const condiciones = {
    abiertasDe: jest.fn().mockResolvedValue(new Map()),
    contextoDeParada: jest.fn().mockResolvedValue({
      enParadaAutorizada: false, nombreUbicacion: null, abiertas: new Set(),
    }),
    contextoDeDesvio: jest.fn().mockResolvedValue({
      distanciaMetros: 3200, corredorMetros: 500, abierta: false, inicioAbierta: null,
    }),
    aplicar: jest.fn().mockResolvedValue(1),
    barrerSinReporte: jest.fn().mockResolvedValue(0),
    ...over,
  };
  const estado = {
    geocercasDelLote: jest.fn().mockResolvedValue(new Map()),
    guardar: jest.fn().mockResolvedValue(undefined),
    guardarGeocercas: jest.fn().mockResolvedValue(undefined),
  };
  const worker = new MotorWorker(
    { persistir: jest.fn() } as any, {} as any, estado as any, {} as any,
    {} as any, {} as any, {} as any,
    { recalcular: jest.fn().mockResolvedValue(undefined) } as any,
    condiciones as any,
  );
  const procesar = (puntos: PuntoEvaluable[], estadoPrevio?: any) =>
    (worker as any).procesarVehiculo(
      VEHICULO, TENANT, puntos, estadoPrevio, CFG, new Map(), new Map(), [],
    );
  return { worker, condiciones, procesar };
}

/** Las decisiones que llegaron a `aplicar`, aplanadas. */
const decisiones = (c: any) =>
  c.aplicar.mock.calls.flatMap((l: any[]) => l[0]) as any[];

describe('Condiciones · los evaluadores están enchufados al worker', () => {
  it('🔴 una parada larga fuera de zona llega a la persistencia', async () => {
    const { condiciones, procesar } = armar();

    await procesar(
      [punto({ timestamp: new Date(T0.getTime() + 15 * 60000) })],
      { vehicle_id: VEHICULO, tenant_id: TENANT, ultimo_punto_ts: T0,
        ultima_velocidad: 0, ultima_ignicion: true, detenido_desde: T0, geocercas_dentro: [] },
    );

    expect(condiciones.aplicar).toHaveBeenCalled();
    expect(decisiones(condiciones).map((d) => d.tipo)).toContain('PARADA_NO_AUTORIZADA');
  });

  it('🔴 un punto fuera del corredor llega a la persistencia', async () => {
    const { condiciones, procesar } = armar();

    await procesar([punto({ speed_kmh: 60 })]);

    expect(decisiones(condiciones).map((d) => d.tipo)).toContain('DESVIO_DE_RUTA');
  });

  it('🔴 el cierre de SIN_REPORTE cuelga de la llegada del punto', async () => {
    const { condiciones, procesar } = armar({
      abiertasDe: jest.fn().mockResolvedValue(new Map([['SIN_REPORTE', T0]])),
    });

    await procesar([punto({ speed_kmh: 60, timestamp: new Date(T0.getTime() + 40 * 60000) })]);

    const cierre = decisiones(condiciones).find((d) => d.tipo === 'SIN_REPORTE');
    expect(cierre).toMatchObject({ accion: 'cerrar' });
  });

  it('🔴 el BARRIDO de SIN_REPORTE corre en cada vuelta del worker', async () => {
    // Es la mitad que no puede colgar de un punto: se dispara por AUSENCIA.
    // Sin este llamado, un vehículo que deja de transmitir no abre nada nunca.
    const { worker, condiciones } = armar();
    const w = worker as any;
    w.cola = { recuperarHuerfanas: jest.fn().mockResolvedValue(0), tomarLote: jest.fn().mockResolvedValue([]) };
    w.trabajos = { procesarPendientes: jest.fn().mockResolvedValue(0) };
    w.activos = { sincronizar: jest.fn().mockResolvedValue(0) };

    await worker.vuelta();

    expect(condiciones.barrerSinReporte).toHaveBeenCalledTimes(1);
    expect(condiciones.barrerSinReporte.mock.calls[0][0]).toBeInstanceOf(Date);
  });

  it('🔴 las condiciones se escriben ANTES de recalcular el estado', async () => {
    // El estado de la 3A se DERIVA de las condiciones abiertas. Al revés, el
    // recálculo miraría el mundo de hace un instante y el operador vería el
    // estado viejo hasta el próximo punto.
    const orden: string[] = [];
    const condiciones = {
      abiertasDe: jest.fn().mockResolvedValue(new Map()),
      contextoDeParada: jest.fn().mockResolvedValue({
        enParadaAutorizada: false, nombreUbicacion: null, abiertas: new Set(),
      }),
      contextoDeDesvio: jest.fn().mockResolvedValue({
        distanciaMetros: 3200, corredorMetros: 500, abierta: false, inicioAbierta: null,
      }),
      aplicar: jest.fn(async () => { orden.push('condiciones'); return 1; }),
      barrerSinReporte: jest.fn(),
    };
    const seguimiento = { recalcular: jest.fn(async () => { orden.push('seguimiento'); }) };
    const worker = new MotorWorker(
      { persistir: jest.fn() } as any, {} as any,
      { geocercasDelLote: jest.fn().mockResolvedValue(new Map()),
        guardar: jest.fn(), guardarGeocercas: jest.fn() } as any,
      {} as any, {} as any, {} as any, {} as any,
      seguimiento as any, condiciones as any,
    );

    await (worker as any).procesarVehiculo(
      VEHICULO, TENANT, [punto({ speed_kmh: 60 })], undefined, CFG, new Map(), new Map(), [],
    );

    expect(orden).toEqual(['condiciones', 'seguimiento']);
  });

  it('con el evaluador de desvío apagado, no se consulta la ruta', async () => {
    // «Apagar un evaluador tiene que ahorrar el costo, no sólo ocultar el
    // resultado» — la consulta a la ruta es geoespacial y es la cara.
    const { condiciones, procesar } = armar();
    await (condiciones as any, procesar([punto({ speed_kmh: 60 })], undefined));
    condiciones.contextoDeDesvio.mockClear();

    const apagado = armar();
    await (apagado.worker as any).procesarVehiculo(
      VEHICULO, TENANT, [punto({ speed_kmh: 60 })], undefined,
      { ...CFG, eval_desvio: false }, new Map(), new Map(), [],
    );

    expect(apagado.condiciones.contextoDeDesvio).not.toHaveBeenCalled();
  });
});

describe('Condiciones · la idempotencia, que es lo que evita el ruido', () => {
  /**
   * ⚠️ Un camión parado 20 minutos genera 240 puntos. Si cada uno abriera una
   * condición, el operador recibiría 240 alertas del mismo hecho — y dejaría de
   * mirarlas, que es la peor forma de fallar de un producto de seguridad.
   */
  it('🔴 N puntos del MISMO hecho producen UNA sola clave de identidad', async () => {
    const ejecutadas: { sql: string; valores: any[] }[] = [];
    const prisma = {
      $executeRaw: jest.fn((s: TemplateStringsArray, ...v: any[]) => {
        ejecutadas.push({ sql: s.join(' ? '), valores: v });
        return Promise.resolve(1);
      }),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const servicio = new CondicionesService(prisma as any);

    // Doscientas cuarenta evaluaciones de la misma parada: todas ven el mismo
    // `detenido_desde`, que es lo que hace estable la clave.
    const decisionesRepetidas = Array.from({ length: 240 }, (_, i) => ({
      accion: 'abrir' as const,
      tipo: 'PARADA_NO_AUTORIZADA' as const,
      tenant_id: TENANT, vehicle_id: VEHICULO, trip_id: VIAJE,
      inicio: new Date(T0),
      disparador: `evaluación ${i}`,
      datos: {},
    }));
    await servicio.aplicar(decisionesRepetidas);

    const claves = new Set(
      ejecutadas.map((e) => e.valores.find((v) => typeof v === 'string' && v.includes(':PARADA_NO_AUTORIZADA:'))),
    );
    expect(claves.size).toBe(1);
  });

  it('🔴 el INSERT trae su propia guarda: no depende de un índice que no verifiqué', async () => {
    // `ON CONFLICT` necesita apuntar a un índice único concreto, y el conector
    // de esta sesión no expone índices. Un ON CONFLICT contra un índice que no
    // existe falla en EJECUCIÓN, no en compilación.
    const ejecutadas: string[] = [];
    const prisma = {
      $executeRaw: jest.fn((s: TemplateStringsArray) => {
        ejecutadas.push(s.join(' ? '));
        return Promise.resolve(1);
      }),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    await new CondicionesService(prisma as any).aplicar([{
      accion: 'abrir', tipo: 'SIN_REPORTE',
      tenant_id: TENANT, vehicle_id: VEHICULO, trip_id: null,
      inicio: T0, disparador: 'x', datos: {},
    }]);

    expect(ejecutadas[0]).toContain('NOT EXISTS');
    expect(ejecutadas[0]).not.toContain('ON CONFLICT');
  });

  it('🔴 el riesgo NO se escribe: sale del catálogo', async () => {
    // Si mañana se decide que una parada no autorizada es crítica, se cambia
    // en una fila del catálogo y todas las condiciones nuevas la respetan sin
    // tocar código.
    const ejecutadas: string[] = [];
    const prisma = {
      $executeRaw: jest.fn((s: TemplateStringsArray) => { ejecutadas.push(s.join(' ? ')); return Promise.resolve(1); }),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    await new CondicionesService(prisma as any).aplicar([{
      accion: 'abrir', tipo: 'DESVIO_DE_RUTA',
      tenant_id: TENANT, vehicle_id: VEHICULO, trip_id: VIAJE,
      inicio: T0, disparador: 'x', datos: {},
    }]);

    expect(ejecutadas[0]).toContain('mt.riesgo_default');
    expect(ejecutadas[0]).toContain('FROM motor_tipos_condicion mt');
  });

  it('🔴 toda consulta y toda escritura acotan por tenant', async () => {
    // Por VALOR ENLAZADO, no por el texto: la primera versión de esta prueba en
    // la 3A buscaba la palabra `tenant_id` y no falló al quitar el filtro.
    const llamadas: any[][] = [];
    const anotar = jest.fn((s: TemplateStringsArray, ...v: any[]) => {
      llamadas.push([s, ...v]); return Promise.resolve(1);
    });
    const prisma = { $executeRaw: anotar, $queryRaw: jest.fn((s: any, ...v: any[]) => {
      llamadas.push([s, ...v]); return Promise.resolve([]);
    }) };
    const servicio = new CondicionesService(prisma as any);

    await servicio.abiertasDe(TENANT, VEHICULO);
    await servicio.paradaAutorizadaEn(TENANT, -34.6, -58.4);
    await servicio.zonaSinSenalEn(TENANT, -34.6, -58.4);
    await servicio.distanciaALaRuta(VIAJE, TENANT, -34.6, -58.4);

    expect(llamadas.length).toBe(4);
    for (const l of llamadas) expect(l.slice(1)).toEqual(expect.arrayContaining([TENANT]));
  });
});
