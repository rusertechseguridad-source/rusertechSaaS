import { CampanaService } from './campana.service';
import { DespachoService } from './despacho.service';
import { CanalDeAviso, MensajeDeCanal, AvisoDespacho } from './tipos-despacho';
import {
  COLUMNAS_UBICACION, LUGAR_DEL_PUNTO, PUNTO_DE_CONDICION, PUNTO_DE_EVENTO,
} from './ubicacion-aviso';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * EL «DÓNDE» DEL AVISO — que llegue por los DOS caminos
 * ══════════════════════════════════════════════════════════════════════════
 *
 * El aviso se arma en dos consultas: la lista de la campana y el empujón en
 * vivo del despacho. Las dos ponían `NULL AS latitud` para las condiciones.
 *
 * ⚠️ SE COMPARA POR IDENTIDAD, NO POR TEXTO. Buscar `ultimo_punto` en el SQL
 * pasaría igual con una copia pegada del fragmento — y dos copias son
 * exactamente cómo el aviso en vivo y el recargado terminan diciendo cosas
 * distintas del mismo camión. Lo que se afirma es que la consulta recibe EL
 * MISMO objeto que exporta `ubicacion-aviso.ts`.
 *
 * ⚠️ LO QUE ESTO NO PRUEBA: que el SQL corra. Con un doble de Prisma no se
 * puede. Se corrió contra la base de producción al escribirlo —las dos
 * consultas, tal cual las arma el código— y el predicado del lugar se probó
 * con un lugar guardado real: adentro da el nombre, lejos no, sin punto no,
 * y el mismo punto con otro cliente no.
 */
const TENANT = '11111111-1111-1111-1111-111111111111';
const T_PUNTO = new Date('2026-09-28T03:10:00.000Z');

function anotador(devuelve: unknown[]) {
  const llamadas: { strings: string; valores: unknown[] }[] = [];
  const fn = jest.fn((s: TemplateStringsArray, ...v: unknown[]) => {
    llamadas.push({ strings: s.join(' ? '), valores: v });
    return Promise.resolve(devuelve);
  });
  return { fn, llamadas };
}

const fila = (over: Record<string, unknown> = {}) => ({
  fuente: 'condicion',
  id: 'cond-1',
  tenant_id: TENANT,
  vehicle_id: 'aaaa0001-0000-4000-8000-000000000001',
  trip_id: null,
  tipo: 'SIN_REPORTE',
  titulo: 'Sin reporte',
  nivel_riesgo: 'riesgo_critico',
  color: '#EF4444',
  interrumpe_al_operador: true,
  requiere_atencion_operador: true,
  ocurrio_at: new Date('2026-09-28T09:00:00.000Z'),
  patente: 'DEMO-001',
  latitud: -34.6,
  longitud: -58.4,
  ubicacion_at: T_PUNTO,
  lugar: 'Depósito Norte',
  direccion: null,
  disparador: '50 minutos sin reportar',
  ...over,
});

describe('Ubicación del aviso · la lista de la campana', () => {
  const armar = () => {
    const { fn, llamadas } = anotador([fila()]);
    const servicio = new CampanaService(
      { $queryRaw: fn } as any,
      { idsPermitidos: jest.fn().mockResolvedValue(null) } as any,
      {} as any,
      {} as any,
    );
    return { servicio, llamadas };
  };

  it('🔴 las DOS ramas de la unión usan los fragmentos compartidos', async () => {
    const { servicio, llamadas } = armar();
    await servicio.pendientes({ id: 'u1', tenantId: TENANT, role: 'operator' });

    const v = llamadas[0].valores;
    // Una rama por fuente: las columnas y el lugar, dos veces cada uno.
    expect(v.filter((x) => x === COLUMNAS_UBICACION)).toHaveLength(2);
    expect(v.filter((x) => x === LUGAR_DEL_PUNTO)).toHaveLength(2);
    // El punto, uno por fuente: el de la condición y el del evento.
    expect(v).toContain(PUNTO_DE_CONDICION);
    expect(v).toContain(PUNTO_DE_EVENTO);
  });

  it('🔴 y ya NO pone la latitud de las condiciones en NULL', async () => {
    // Es el defecto: `NULL::float8 AS latitud` en la rama de condiciones.
    const { servicio, llamadas } = armar();
    await servicio.pendientes({ id: 'u1', tenantId: TENANT, role: 'operator' });
    expect(llamadas[0].strings).not.toMatch(/NULL::float8\s+AS latitud/);
  });

  it('🔴 el lugar y la hora de la posición llegan al aviso', async () => {
    const { servicio } = armar();
    const [aviso] = await servicio.pendientes({ id: 'u1', tenantId: TENANT, role: 'operator' });
    expect(aviso.lugar).toBe('Depósito Norte');
    expect(aviso.ubicacion_at).toEqual(T_PUNTO);
    expect(aviso.latitud).toBe(-34.6);
  });
});

describe('Ubicación del aviso · el empujón en vivo', () => {
  class Canal implements CanalDeAviso {
    readonly nombre = 'prueba';
    recibidos: MensajeDeCanal[] = [];
    entregar(m: MensajeDeCanal) { this.recibidos.push(m); }
  }

  const armar = () => {
    const { fn, llamadas } = anotador([fila()]);
    const canal = new Canal();
    const despacho = new DespachoService({ $queryRaw: fn } as any, [canal]);
    return { despacho, canal, llamadas };
  };

  it('🔴 usa EL MISMO fragmento que la lista, no una copia', async () => {
    const { despacho, llamadas } = armar();
    await despacho.despacharCondiciones(['cond-1']);

    const v = llamadas[0].valores;
    expect(v).toContain(COLUMNAS_UBICACION);
    expect(v).toContain(PUNTO_DE_CONDICION);
    expect(v).toContain(LUGAR_DEL_PUNTO);
    expect(llamadas[0].strings).not.toMatch(/NULL::float8\s+AS latitud/);
  });

  it('🔴 el aviso que llega en vivo trae el lugar y la hora de la posición', async () => {
    // Sin esto, el operador que tiene la pantalla abierta ve «sin posición» y
    // el que recarga ve el lugar: el mismo camión, dos respuestas.
    const { despacho, canal } = armar();
    await despacho.despacharCondiciones(['cond-1']);

    const aviso = (canal.recibidos[0] as { aviso: AvisoDespacho }).aviso;
    expect(aviso.lugar).toBe('Depósito Norte');
    expect(aviso.ubicacion_at).toEqual(T_PUNTO);
  });

  it('sin posición, los tres campos llegan en null — y no inventan una hora', async () => {
    const { fn } = anotador([fila({ latitud: null, longitud: null, ubicacion_at: null, lugar: null })]);
    const canal = new Canal();
    await new DespachoService({ $queryRaw: fn } as any, [canal]).despacharCondiciones(['cond-1']);

    const aviso = (canal.recibidos[0] as { aviso: AvisoDespacho }).aviso;
    expect(aviso.latitud).toBeNull();
    expect(aviso.ubicacion_at).toBeNull();
    expect(aviso.lugar).toBeNull();
  });
});

describe('Ubicación del aviso · la hora es la del PUNTO', () => {
  it('🔴 la hora sale de ultimo_punto_ts, no de now() ni de la alerta', () => {
    // Un camión callado hace seis horas tiene una posición de hace seis
    // horas. Si esto dijera `now()`, la pantalla la mostraría como actual.
    expect(PUNTO_DE_CONDICION.sql).toMatch(/ev\.ultimo_punto_ts END AS punto_at/);
    expect(PUNTO_DE_CONDICION.sql).not.toMatch(/now\(\)/i);
    // Y sin punto, sin hora: una hora sola no dice dónde.
    expect(PUNTO_DE_CONDICION.sql).toMatch(/WHEN ev\.ultimo_punto IS NULL THEN NULL/);
  });

  it('🔴 el lugar se busca en el MISMO cliente', () => {
    // El lugar guardado de otra empresa no puede ponerle nombre a este camión.
    expect(LUGAR_DEL_PUNTO.sql).toMatch(/sl\.tenant_id = ub\.tenant_id/);
    expect(LUGAR_DEL_PUNTO.sql).toMatch(/gf\.tenant_id = ub\.tenant_id/);
  });
});
