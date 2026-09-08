import {
  derivarEstadoSeguimiento,
  huboCambio,
  validarDeclaracionManual,
  validarLevantar,
  type IntentoDeclaracion,
} from './estado-seguimiento';
import type {
  CondicionAbierta,
  EntradaSeguimiento,
  EstadoSeguimiento,
} from './tipos-seguimiento';

/**
 * LAS REGLAS DEL ESTADO DE SEGUIMIENTO — sin base de datos.
 *
 * Son funciones puras, así que un caso es un objeto de entrada y una aserción
 * sobre la salida. Corre en milisegundos y acá viven los casos de borde.
 *
 * ⚠️ Lo que esta suite NO prueba, y hay que decirlo: que alguien LLAME a estas
 * funciones. Ese es el error que costó tres tandas —12 pruebas certificaban la
 * regla de roles y la ruta real no la llamaba— y por eso existe aparte
 * `seguimiento.cableado.spec.ts`, que corre el servicio de verdad.
 */

// ── Vocabulario de laboratorio ──────────────────────────────────────────────
// ⚠️ Los códigos de acá son INVENTADOS a propósito: `RIESGO_1`, `COND_A`. Si
// usara los reales (`SOS`, `panorama_normal`) la suite pasaría aunque la
// implementación tuviera un `if (tipo === 'SOS')` escondido — que es justo el
// atajo que este diseño evita. Con nombres de laboratorio, una regla que mire
// nombres reales falla.
const NEUTRO = { codigo: 'RIESGO_NEUTRO', orden: 10 };

const cond = (over: Partial<CondicionAbierta> = {}): CondicionAbierta => ({
  id: 'cccc0001-0000-4000-8000-000000000001',
  tipo: 'COND_A',
  riesgo: 'RIESGO_MEDIO',
  ordenRiesgo: 20,
  resolucionManual: false,
  inicio: new Date('2026-09-07T10:00:00Z'),
  ...over,
});

const entrada = (over: Partial<EntradaSeguimiento> = {}): EntradaSeguimiento => ({
  etapa: { codigo: 'ETAPA_EN_CURSO', esTerminal: false, desde: new Date('2026-09-07T08:00:00Z') },
  condicionesAbiertas: [],
  declaracion: null,
  riesgoNeutro: NEUTRO,
  ...over,
});

const intento = (over: Partial<IntentoDeclaracion> = {}): IntentoDeclaracion => ({
  tipo: 'COND_DECLARABLE',
  ordenRiesgo: 10,
  declarablePorOperador: true,
  activoEnCatalogo: true,
  ...over,
});

describe('Estado de seguimiento · derivación', () => {
  it('sin condiciones abiertas, el estado es el tramo del ciclo de vida', () => {
    const e = derivarEstadoSeguimiento(entrada());

    expect(e.estado).toBe('ETAPA_EN_CURSO');
    expect(e.estadoOrigen).toBe('ciclo_vida');
    expect(e.riesgo).toBe('RIESGO_NEUTRO');
    // ⚠️ Y con la fecha de la etapa, no con un relleno. La primera versión
    // ponía `new Date(0)` —1970— en el historial del operador.
    expect(e.vigenteDesde).toEqual(new Date('2026-09-07T08:00:00Z'));
  });

  it('con una condición abierta, el estado es esa condición', () => {
    const e = derivarEstadoSeguimiento(entrada({ condicionesAbiertas: [cond()] }));

    expect(e.estado).toBe('COND_A');
    expect(e.estadoOrigen).toBe('condicion');
    expect(e.condicionId).toBe('cccc0001-0000-4000-8000-000000000001');
  });

  it('🔴 con TRES condiciones a la vez, el estado es la MÁS GRAVE', () => {
    // El caso que define el diseño: un camión desviado, sin reportar y con la
    // temperatura fuera de rango. Con un estado único se pierden dos.
    const e = derivarEstadoSeguimiento(
      entrada({
        condicionesAbiertas: [
          cond({ id: 'c1', tipo: 'COND_LEVE', ordenRiesgo: 10 }),
          cond({ id: 'c3', tipo: 'COND_GRAVE', ordenRiesgo: 30 }),
          cond({ id: 'c2', tipo: 'COND_MEDIA', ordenRiesgo: 20 }),
        ],
      }),
    );

    expect(e.estado).toBe('COND_GRAVE');
    expect(e.condicionId).toBe('c3');
  });

  it('empate de gravedad: gana la que empezó ANTES, no la que devuelva la consulta', () => {
    // Sin desempate, dos condiciones del mismo riesgo se alternarían según el
    // orden del resultado y cada vuelta escribiría una transición falsa.
    const vieja = cond({ id: 'vieja', tipo: 'COND_VIEJA', inicio: new Date('2026-09-07T09:00:00Z') });
    const nueva = cond({ id: 'nueva', tipo: 'COND_NUEVA', inicio: new Date('2026-09-07T11:00:00Z') });

    expect(derivarEstadoSeguimiento(entrada({ condicionesAbiertas: [nueva, vieja] })).estado)
      .toBe('COND_VIEJA');
    expect(derivarEstadoSeguimiento(entrada({ condicionesAbiertas: [vieja, nueva] })).estado)
      .toBe('COND_VIEJA');
  });
});

describe('Estado de seguimiento · «PANICO gana siempre»', () => {
  // ⚠️ La regla está escrita SIN nombrar al pánico: lo que la hace ganar es
  // que sólo la cierra una persona (`resolucionManual`), no que se llame SOS.
  const panico = cond({
    id: 'panico', tipo: 'COND_PEGAJOSA', riesgo: 'RIESGO_ALTO',
    ordenRiesgo: 40, resolucionManual: true,
  });

  it('🔴 ninguna otra condición lo pisa, aunque tenga MÁS orden de riesgo', () => {
    // Éste es el caso que rompe la regla ingenua «gana el de mayor orden».
    // `motor_niveles_riesgo.tenant_id` es nullable: un cliente puede agregar
    // un nivel con orden 50 y dejar al pánico segundo.
    const inventadoPorElTenant = cond({
      id: 'otra', tipo: 'COND_DEL_TENANT', ordenRiesgo: 50, resolucionManual: false,
    });

    const e = derivarEstadoSeguimiento(
      entrada({ condicionesAbiertas: [inventadoPorElTenant, panico] }),
    );

    expect(e.estado).toBe('COND_PEGAJOSA');
  });

  it('🔴 tampoco lo pisa una declaración del operador', () => {
    const e = derivarEstadoSeguimiento(
      entrada({
        condicionesAbiertas: [panico],
        declaracion: {
          tipo: 'COND_DECLARADA', riesgo: 'RIESGO_NEUTRO', ordenRiesgo: 10,
          declaradoPor: 'uuuu0001', desde: new Date('2026-09-07T12:00:00Z'), nota: null,
        },
      }),
    );

    expect(e.estado).toBe('COND_PEGAJOSA');
    expect(e.origen).toBe('deducido');
  });

  it('🔴 y el operador NO puede declarar nada mientras esté abierto', () => {
    const v = validarDeclaracionManual(intento(), entrada({ condicionesAbiertas: [panico] }));

    expect(v.valida).toBe(false);
    expect(v.motivo).toContain('COND_PEGAJOSA');
    // Un rechazo sin motivo no se puede ni escribir: lo prohíbe el CHECK.
    expect(v.motivo).toBeTruthy();
  });
});

describe('Estado de seguimiento · lo manual pisa a lo deducido', () => {
  const declaracion = {
    tipo: 'COND_DECLARADA', riesgo: 'RIESGO_MEDIO', ordenRiesgo: 20,
    declaradoPor: 'uuuu0001', desde: new Date('2026-09-07T12:00:00Z'), nota: 'esperando turno',
  };

  it('con una condición MENOS grave abierta, manda la declaración', () => {
    const e = derivarEstadoSeguimiento(
      entrada({ declaracion, condicionesAbiertas: [cond({ ordenRiesgo: 10 })] }),
    );

    expect(e.estado).toBe('COND_DECLARADA');
    expect(e.origen).toBe('manual');
    expect(e.motivo).toContain('esperando turno');
  });

  it('🔴 con una condición MÁS grave, el motor la pisa — «hasta que detecte algo más grave»', () => {
    const e = derivarEstadoSeguimiento(
      entrada({
        declaracion,
        condicionesAbiertas: [cond({ id: 'peor', tipo: 'COND_PEOR', ordenRiesgo: 30 })],
      }),
    );

    expect(e.estado).toBe('COND_PEOR');
    expect(e.origen).toBe('deducido');
    expect(e.motivo).toContain('más grave');
  });

  it('en EMPATE de gravedad gana la persona: tuvo el contexto a la vista', () => {
    const e = derivarEstadoSeguimiento(
      entrada({ declaracion, condicionesAbiertas: [cond({ ordenRiesgo: 20 })] }),
    );

    expect(e.origen).toBe('manual');
  });
});

describe('Estado de seguimiento · la máquina, y sus rechazos con motivo', () => {
  it('un código que no está en el catálogo se rechaza', () => {
    const v = validarDeclaracionManual(intento({ activoEnCatalogo: false }), entrada());

    expect(v.valida).toBe(false);
    expect(v.motivo).toContain('no existe o está inactivo');
  });

  it('🔴 un código del catálogo que NO es declarable por el operador se rechaza', () => {
    // Es lo que impide declarar un pánico desde el panel: existe en el
    // catálogo, y aun así no se declara desde acá.
    const v = validarDeclaracionManual(intento({ declarablePorOperador: false }), entrada());

    expect(v.valida).toBe(false);
    expect(v.motivo).toContain('no es declarable por un operador');
  });

  it('un viaje terminado no cambia de estado de seguimiento', () => {
    const v = validarDeclaracionManual(
      intento(),
      entrada({ etapa: { codigo: 'ETAPA_FINAL', esTerminal: true, desde: new Date() } }),
    );

    expect(v.valida).toBe(false);
    expect(v.motivo).toContain('terminal');
  });

  it('una condición más grave abierta impide declarar algo más leve', () => {
    const v = validarDeclaracionManual(
      intento({ ordenRiesgo: 10 }),
      entrada({ condicionesAbiertas: [cond({ tipo: 'COND_PEOR', ordenRiesgo: 40 })] }),
    );

    expect(v.valida).toBe(false);
    expect(v.motivo).toContain('COND_PEOR');
  });

  it('con el camino despejado, la declaración se acepta', () => {
    expect(validarDeclaracionManual(intento(), entrada()).valida).toBe(true);
  });

  it('TODO rechazo trae motivo — es lo que el CHECK de la base exige', () => {
    const rechazos = [
      validarDeclaracionManual(intento({ activoEnCatalogo: false }), entrada()),
      validarDeclaracionManual(intento({ declarablePorOperador: false }), entrada()),
      validarDeclaracionManual(
        intento(), entrada({ etapa: { codigo: 'X', esTerminal: true, desde: new Date() } }),
      ),
      validarDeclaracionManual(
        intento({ ordenRiesgo: 10 }),
        entrada({ condicionesAbiertas: [cond({ ordenRiesgo: 40 })] }),
      ),
      validarLevantar(entrada()),
    ];

    for (const r of rechazos) {
      expect(r.valida).toBe(false);
      expect(typeof r.motivo).toBe('string');
      expect((r.motivo ?? '').length).toBeGreaterThan(20);
    }
  });

  it('levantar sin nada declarado se rechaza con su motivo', () => {
    expect(validarLevantar(entrada()).motivo).toContain('No hay un estado declarado');
  });
});

describe('Estado de seguimiento · cuándo se escribe una transición', () => {
  const base: EstadoSeguimiento = {
    estado: 'COND_A', estadoOrigen: 'condicion', riesgo: 'R', ordenRiesgo: 20,
    origen: 'deducido', condicionId: 'c1', vigenteDesde: new Date('2026-09-07T10:00:00Z'),
    motivo: 'x',
  };

  it('sin estado anterior, siempre hay cambio', () => {
    expect(huboCambio(null, base)).toBe(true);
  });

  it('🔴 el mismo estado recalculado NO escribe una transición', () => {
    // Sin esto, cada punto escribiría una fila idéntica a la anterior y la
    // línea de tiempo del operador quedaría inservible.
    expect(huboCambio(base, { ...base, motivo: 'otro texto' })).toBe(false);
    expect(huboCambio(base, { ...base, vigenteDesde: new Date('2026-09-07T11:00:00Z') })).toBe(false);
  });

  it('cambia el código, el origen o el catálogo → sí hay cambio', () => {
    expect(huboCambio(base, { ...base, estado: 'COND_B' })).toBe(true);
    expect(huboCambio(base, { ...base, origen: 'manual' })).toBe(true);
    expect(huboCambio(base, { ...base, estadoOrigen: 'ciclo_vida' })).toBe(true);
  });
});
