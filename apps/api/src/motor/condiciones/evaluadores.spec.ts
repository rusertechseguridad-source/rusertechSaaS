import { evaluarParadas, type ContextoParada } from './paradas.evaluator';
import { evaluarDesvio } from './desvio.evaluator';
import {
  cerrarSinReportePorPunto,
  evaluarSinReporte,
  umbralEfectivo,
  type ContextoSinReporte,
} from './sin-reporte.evaluator';
import { claveDeIdentidad } from './tipos-condiciones';
import type { EstadoVehiculo, PuntoEvaluable } from '../tipos';

/**
 * LOS CUATRO EVALUADORES — sin base de datos.
 *
 * Son funciones puras, así que un caso es un objeto de entrada y una aserción
 * sobre la salida. Acá viven los casos de borde: umbrales, contexto, cierres.
 *
 * ⚠️ Lo que esta suite NO prueba es que alguien los LLAME. Ése es el error que
 * costó tres tandas y que la 3A repitió con `recalcular()`. Para eso está
 * `condiciones.cableado.spec.ts`, y además la regla R17.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const VEHICULO = 'aaaa0001-0000-4000-8000-000000000001';
const VIAJE = 'dddd0001-0000-4000-8000-000000000001';
const T0 = new Date('2026-09-08T12:00:00Z');
const enMinutos = (m: number) => new Date(T0.getTime() + m * 60000);

const UMBRALES = {
  parada_minutos: 10,
  parada_velocidad_kmh: 5,
  parada_prolongada_minutos: 60,
};

const punto = (over: Partial<PuntoEvaluable> = {}): PuntoEvaluable => ({
  cola_id: '1', telemetry_id: 'tttt0001-0000-4000-8000-000000000001',
  tenant_id: TENANT, vehicle_id: VEHICULO, trip_id: VIAJE,
  timestamp: T0, latitude: -34.6037, longitude: -58.3816,
  speed_kmh: 0, ignition: true, temperature_c: null,
  provider_code: null, origen: 'hub', ...over,
});

const estado = (over: Partial<EstadoVehiculo> = {}): EstadoVehiculo => ({
  vehicle_id: VEHICULO, tenant_id: TENANT, ultimo_punto_ts: T0,
  ultima_latitud: -34.6037, ultima_longitud: -58.3816,
  ultima_velocidad: 0, ultima_ignicion: true, detenido_desde: T0,
  geocercas_dentro: [], ...over,
});

const contexto = (over: Partial<ContextoParada> = {}): ContextoParada => ({
  enParadaAutorizada: false, nombreUbicacion: null, abiertas: new Set(), ...over,
});

// ══════════════════════════════════════════════════════════════════════════
describe('Paradas · el contexto decide la gravedad, no el hecho', () => {
  it('a los 10 minutos fuera de una ubicación habilitada, abre PARADA_NO_AUTORIZADA', () => {
    const d = evaluarParadas(estado(), punto({ timestamp: enMinutos(10) }), UMBRALES, contexto());

    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ accion: 'abrir', tipo: 'PARADA_NO_AUTORIZADA' });
    // El inicio es cuándo SE DETUVO, no cuándo se detectó: es lo que hace
    // estable la clave de identidad.
    expect(d[0].inicio).toEqual(T0);
  });

  it('🔴 los MISMOS 10 minutos en una ubicación habilitada NO abren nada', () => {
    // Éste es el caso que separa la custodia del cronómetro. Y es el
    // `DETENIDO_AUTORIZADO` verde de la 3A: no es un estado que alguien
    // escriba, es la ausencia de condición abierta.
    const d = evaluarParadas(
      estado(),
      punto({ timestamp: enMinutos(10) }),
      UMBRALES,
      contexto({ enParadaAutorizada: true, nombreUbicacion: 'Planta Demo' }),
    );

    expect(d).toEqual([]);
  });

  it('antes del umbral no abre nada', () => {
    expect(evaluarParadas(estado(), punto({ timestamp: enMinutos(9) }), UMBRALES, contexto()))
      .toEqual([]);
  });

  it('🔴 PARADA_PROLONGADA SÍ se abre en una ubicación habilitada', () => {
    // No es una inconsistencia con la prueba de arriba: sale del catálogo de la
    // Etapa 0, textual — «detenido más del umbral extendido, AUN EN ZONA
    // AUTORIZADA». Una hora en la estación de servicio ya no es cargar
    // combustible.
    const d = evaluarParadas(
      estado(),
      punto({ timestamp: enMinutos(60) }),
      UMBRALES,
      contexto({ enParadaAutorizada: true, nombreUbicacion: 'Planta Demo' }),
    );

    expect(d.map((x) => x.tipo)).toEqual(['PARADA_PROLONGADA']);
    expect(d[0].datos).toMatchObject({ en_parada_autorizada: true, ubicacion: 'Planta Demo' });
  });

  it('fuera de zona y a los 60 min, abre las DOS', () => {
    const d = evaluarParadas(estado(), punto({ timestamp: enMinutos(60) }), UMBRALES, contexto());
    expect(d.map((x) => x.tipo).sort())
      .toEqual(['PARADA_NO_AUTORIZADA', 'PARADA_PROLONGADA']);
  });

  it('no reabre lo que ya está abierto', () => {
    const d = evaluarParadas(
      estado(), punto({ timestamp: enMinutos(60) }), UMBRALES,
      contexto({ abiertas: new Set(['PARADA_NO_AUTORIZADA', 'PARADA_PROLONGADA']) }),
    );
    expect(d).toEqual([]);
  });

  it('🔴 arrancar CIERRA lo que estaba abierto — si no, el estado nunca baja', () => {
    const d = evaluarParadas(
      estado(), punto({ timestamp: enMinutos(70), speed_kmh: 42 }), UMBRALES,
      contexto({ abiertas: new Set(['PARADA_NO_AUTORIZADA', 'PARADA_PROLONGADA']) }),
    );

    expect(d).toHaveLength(2);
    expect(d.every((x) => x.accion === 'cerrar')).toBe(true);
    expect(d[0].fin).toEqual(enMinutos(70));
  });

  it('🔴 velocidad NULL no es velocidad cero: no decide nada', () => {
    // Hay equipos que no mandan velocidad. Tratar el null como «detenido»
    // abriría paradas fantasma en cada vehículo cuyo AVL no la reporte.
    expect(evaluarParadas(estado(), punto({ speed_kmh: null, timestamp: enMinutos(120) }), UMBRALES, contexto()))
      .toEqual([]);
  });

  it('sin `detenido_desde` no hay desde cuándo, y no se decide', () => {
    expect(evaluarParadas(estado({ detenido_desde: null }), punto({ timestamp: enMinutos(60) }), UMBRALES, contexto()))
      .toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe('Desvío · el corredor por viaje', () => {
  const ctx = (over: any = {}) => ({
    distanciaMetros: 100, corredorMetros: 500, abierta: false, inicioAbierta: null, ...over,
  });

  it('dentro del corredor no abre nada', () => {
    expect(evaluarDesvio(punto(), ctx({ distanciaMetros: 499 }))).toEqual([]);
  });

  it('fuera del corredor abre DESVIO_DE_RUTA con la magnitud', () => {
    const d = evaluarDesvio(punto(), ctx({ distanciaMetros: 3200 }));
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ accion: 'abrir', tipo: 'DESVIO_DE_RUTA' });
    expect(d[0].datos).toMatchObject({ distancia_m: 3200, corredor_m: 500, exceso_m: 2700 });
  });

  it('🔴 SIN RUTA no abre nada — null no es cero', () => {
    // Un viaje sin ruta planificada no puede estar desviado: no hay de qué.
    // Confundir `null` con «está sobre la ruta» abriría un desvío a todo viaje
    // sin ruta, que hoy serían casi todos.
    expect(evaluarDesvio(punto(), ctx({ distanciaMetros: null }))).toEqual([]);
    // Y tampoco lo cierra, aunque hubiera uno abierto: sin dato no se afirma.
    expect(evaluarDesvio(punto(), ctx({ distanciaMetros: null, abierta: true }))).toEqual([]);
  });

  it('🔴 volver al corredor lo CIERRA', () => {
    const d = evaluarDesvio(
      punto({ timestamp: enMinutos(15) }),
      ctx({ distanciaMetros: 120, abierta: true, inicioAbierta: T0 }),
    );
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ accion: 'cerrar', inicio: T0, fin: enMinutos(15) });
  });

  it('seguir afuera no reabre', () => {
    expect(evaluarDesvio(punto(), ctx({ distanciaMetros: 3200, abierta: true }))).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe('Sin reporte · la zona sólo puede dar MÁS tolerancia', () => {
  const ident = { tenant_id: TENANT, vehicle_id: VEHICULO, trip_id: VIAJE };
  const ctx = (over: Partial<ContextoSinReporte> = {}): ContextoSinReporte => ({
    ultimoPuntoTs: T0, ahora: enMinutos(30), sinReporteMinutos: 20,
    minutosEsperadosDeLaZona: null, nombreZona: null, abierta: false, ...over,
  });

  it('sin zona conocida, el umbral es el del cliente', () => {
    expect(umbralEfectivo({ sinReporteMinutos: 20, minutosEsperadosDeLaZona: null })).toBe(20);
  });

  it('🔴 en una zona sin señal, el umbral es el MAYOR de los dos', () => {
    // Nunca el menor. Una zona donde se esperan 45 min de silencio no puede
    // alertar a los 20 — es la diferencia entre un producto que se mira y uno
    // que se ignora.
    expect(umbralEfectivo({ sinReporteMinutos: 20, minutosEsperadosDeLaZona: 45 })).toBe(45);
    // Y si la zona espera MENOS, manda el del cliente: la zona amplía, no acorta.
    expect(umbralEfectivo({ sinReporteMinutos: 20, minutosEsperadosDeLaZona: 5 })).toBe(20);
  });

  it('a los 30 min con umbral 20, abre', () => {
    const d = evaluarSinReporte(ident, ctx());
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ accion: 'abrir', tipo: 'SIN_REPORTE' });
    // El silencio empieza en el ÚLTIMO PUNTO, no cuando el barrido se dio
    // cuenta: es lo que hace que barridos sucesivos den la misma clave.
    expect(d[0].inicio).toEqual(T0);
  });

  it('🔴 los mismos 30 min dentro de un túnel de 45 NO abren nada', () => {
    expect(evaluarSinReporte(ident, ctx({ minutosEsperadosDeLaZona: 45, nombreZona: 'Túnel' })))
      .toEqual([]);
  });

  it('un vehículo del que nunca se supo nada no está sin reporte', () => {
    // Está sin estrenar. Alertar por eso sería alertar por un alta reciente.
    expect(evaluarSinReporte(ident, ctx({ ultimoPuntoTs: null }))).toEqual([]);
  });

  it('no reabre si ya está abierta', () => {
    expect(evaluarSinReporte(ident, ctx({ abierta: true }))).toEqual([]);
  });

  it('🔴 la llegada de un punto la CIERRA', () => {
    const d = cerrarSinReportePorPunto(ident, {
      abierta: true, inicioAbierta: T0, momentoDelPunto: enMinutos(50),
    });
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ accion: 'cerrar', tipo: 'SIN_REPORTE', fin: enMinutos(50) });
    expect(d[0].datos).toMatchObject({ minutos_de_silencio: 50 });
  });

  it('sin nada abierto, un punto no cierra nada', () => {
    expect(cerrarSinReportePorPunto(ident, {
      abierta: false, inicioAbierta: null, momentoDelPunto: T0,
    })).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe('La clave de identidad · lo que evita 240 alertas del mismo camión', () => {
  const d = (inicio: Date, tipo = 'PARADA_NO_AUTORIZADA') => ({
    tenant_id: TENANT, vehicle_id: VEHICULO, tipo, inicio,
  });

  it('🔴 el mismo hecho da la MISMA clave aunque se evalúe mil veces', () => {
    // 240 puntos de una parada de 20 minutos ven el mismo `detenido_desde`.
    expect(claveDeIdentidad(d(T0))).toBe(claveDeIdentidad(d(new Date(T0))));
  });

  it('🔴 la clave LLEVA el inicio del hecho, no el momento de evaluarla', () => {
    // ⚠️ Esta prueba nació de su propia reversión. Cambié la implementación
    // para que usara `new Date()` en vez del inicio, y la prueba de arriba
    // SIGUIÓ PASANDO: las mil llamadas ocurrían dentro del mismo minuto, así
    // que el truncado las colapsaba igual. Pasaba por rápida, no por correcta.
    //
    // Afirmar que el inicio ESTÁ EN la clave no se puede fingir: una fecha de
    // 2026 no aparece por accidente en un `new Date()` de hoy.
    const alMinuto = new Date(T0);
    alMinuto.setUTCSeconds(0, 0);
    expect(claveDeIdentidad(d(T0))).toContain(alMinuto.toISOString());
  });

  it('🔴 se trunca al minuto: milisegundos distintos NO parten el hecho', () => {
    // Sin truncar, un reproceso o dos workers darían claves distintas y la
    // protección se caería justo cuando más se la necesita.
    expect(claveDeIdentidad(d(new Date('2026-09-08T12:00:31.847Z'))))
      .toBe(claveDeIdentidad(d(new Date('2026-09-08T12:00:02.001Z'))));
  });

  it('otra parada, otro hecho, otra clave', () => {
    expect(claveDeIdentidad(d(T0))).not.toBe(claveDeIdentidad(d(enMinutos(90))));
  });

  it('el tipo y el vehículo forman parte de la identidad', () => {
    expect(claveDeIdentidad(d(T0))).not.toBe(claveDeIdentidad(d(T0, 'PARADA_PROLONGADA')));
    expect(claveDeIdentidad({ ...d(T0), vehicle_id: 'otro' })).not.toBe(claveDeIdentidad(d(T0)));
  });

  it('y el tenant: dos clientes con el mismo vehículo migrado no colisionan', () => {
    expect(claveDeIdentidad({ ...d(T0), tenant_id: 'otro-tenant' }))
      .not.toBe(claveDeIdentidad(d(T0)));
  });
});
