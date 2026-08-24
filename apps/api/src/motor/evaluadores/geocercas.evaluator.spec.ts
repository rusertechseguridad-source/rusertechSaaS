import { evaluarGeocercas, evaluarTransicionesDeEstado } from './geocercas.evaluator';
import type { EstadoVehiculo, GeocercaDelPunto, PuntoEvaluable, ZonaDeControlDelViaje } from '../tipos';

/**
 * PRUEBAS DE LOS EVALUADORES.
 *
 * Sin base de datos, sin NestJS, sin esperar a que pase algo en la calle. Es
 * posible porque los evaluadores son funciones puras: reciben el estado
 * anterior y devuelven el nuevo.
 *
 * Los casos de borde de la lógica de decisión viven acá; las trayectorias
 * completas se prueban aparte, insertando telemetría de verdad.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const VEHICULO = '33333333-3333-3333-3333-333333333331';
const VIAJE = '44444444-4444-4444-4444-444444444441';

function punto(overrides: Partial<PuntoEvaluable> = {}): PuntoEvaluable {
  return {
    cola_id: '1',
    telemetry_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    tenant_id: TENANT,
    vehicle_id: VEHICULO,
    trip_id: VIAJE,
    timestamp: new Date('2026-08-24T12:00:00Z'),
    latitude: -34.6,
    longitude: -58.4,
    speed_kmh: 60,
    ignition: true,
    temperature_c: null,
    provider_code: null,
    origen: 'hub',
    ...overrides,
  };
}

function estado(dentro: string[] = []): EstadoVehiculo {
  return {
    vehicle_id: VEHICULO,
    tenant_id: TENANT,
    ultimo_punto_ts: null,
    ultima_velocidad: null,
    ultima_ignicion: null,
    detenido_desde: null,
    geocercas_dentro: dentro,
  };
}

const zonaA: GeocercaDelPunto = { geofence_id: 'geo-a', nombre: 'Depósito Norte', zone_type: 'deposito' };
const zonaB: GeocercaDelPunto = { geofence_id: 'geo-b', nombre: 'Zona Roja', zone_type: 'riesgo' };

describe('evaluarGeocercas', () => {
  it('emite una entrada cuando el vehículo aparece en una geocerca nueva', () => {
    const r = evaluarGeocercas(estado([]), [zonaA], punto());
    expect(r.decisiones).toHaveLength(1);
    expect(r.decisiones[0].tipo).toBe('geocerca_entrada');
    expect(r.decisiones[0].causa_id).toBe('geo-a');
    expect(r.geocercasDentro).toEqual(['geo-a']);
  });

  it('NO repite la entrada mientras el vehículo sigue adentro', () => {
    const r = evaluarGeocercas(estado(['geo-a']), [zonaA], punto());
    expect(r.decisiones).toHaveLength(0);
    expect(r.geocercasDentro).toEqual(['geo-a']);
  });

  it('emite una salida cuando deja de estar en una geocerca', () => {
    const r = evaluarGeocercas(estado(['geo-a']), [], punto());
    expect(r.decisiones).toHaveLength(1);
    expect(r.decisiones[0].tipo).toBe('geocerca_salida');
    expect(r.geocercasDentro).toEqual([]);
  });

  it('maneja geocercas superpuestas de forma independiente', () => {
    // Estaba en A, ahora está en A y B: solo entra a B.
    const r = evaluarGeocercas(estado(['geo-a']), [zonaA, zonaB], punto());
    expect(r.decisiones).toHaveLength(1);
    expect(r.decisiones[0].causa_id).toBe('geo-b');
    expect(r.geocercasDentro.sort()).toEqual(['geo-a', 'geo-b']);
  });

  it('emite entrada y salida a la vez cuando cambia de una zona a otra', () => {
    const r = evaluarGeocercas(estado(['geo-a']), [zonaB], punto());
    const tipos = r.decisiones.map((d) => d.tipo).sort();
    expect(tipos).toEqual(['geocerca_entrada', 'geocerca_salida']);
  });

  it('un vehículo fuera de toda geocerca no genera ruido', () => {
    const r = evaluarGeocercas(estado([]), [], punto());
    expect(r.decisiones).toHaveLength(0);
  });
});

function zona(overrides: Partial<ZonaDeControlDelViaje> = {}): ZonaDeControlDelViaje {
  return {
    control_zone_id: 'cz-1',
    nombre: 'Origen',
    geofence_id: 'geo-a',
    sequence_order: 1,
    was_triggered: false,
    auto_transition: true,
    transition_target_status: 'EN_ORIGEN',
    notify_on_enter: true,
    notify_on_exit: false,
    notify_if_skipped: true,
    ...overrides,
  };
}

const ESTADOS_VALIDOS = ['BORRADOR', 'PROGRAMADO', 'EN_ORIGEN', 'EN_CARGA', 'EN_CURSO', 'FINALIZADO'];

describe('evaluarTransicionesDeEstado', () => {
  const entradaEnA = evaluarGeocercas(estado([]), [zonaA], punto()).decisiones;

  it('cambia el estado del viaje al entrar en una zona de transición', () => {
    const r = evaluarTransicionesDeEstado(entradaEnA, [zona()], 'PROGRAMADO', ESTADOS_VALIDOS);
    const t = r.find((d) => d.tipo === 'transicion_estado');
    expect(t).toBeDefined();
    expect(t!.estado_destino).toBe('EN_ORIGEN');
  });

  it('NO vuelve a disparar una zona ya disparada', () => {
    const r = evaluarTransicionesDeEstado(entradaEnA, [zona({ was_triggered: true })], 'PROGRAMADO', ESTADOS_VALIDOS);
    expect(r).toHaveLength(0);
  });

  it('NO registra una transición al estado en el que ya está', () => {
    const r = evaluarTransicionesDeEstado(entradaEnA, [zona()], 'EN_ORIGEN', ESTADOS_VALIDOS);
    expect(r.filter((d) => d.tipo === 'transicion_estado')).toHaveLength(0);
  });

  it('rechaza un destino que no existe en el catálogo, sin inventarlo', () => {
    const r = evaluarTransicionesDeEstado(
      entradaEnA,
      [zona({ transition_target_status: 'ESTADO_INVENTADO' })],
      'PROGRAMADO',
      ESTADOS_VALIDOS,
    );
    expect(r.filter((d) => d.tipo === 'transicion_estado')).toHaveLength(0);
    expect(r[0].tipo).toBe('zona_salteada');
    expect(r[0].detalle).toContain('no existe en el catálogo');
  });

  it('detecta que se salteó una zona anterior del recorrido', () => {
    const zonas = [
      zona({ control_zone_id: 'cz-1', nombre: 'Control 1', geofence_id: 'geo-x', sequence_order: 1 }),
      zona({ control_zone_id: 'cz-2', nombre: 'Control 2', geofence_id: 'geo-a', sequence_order: 2,
             transition_target_status: 'EN_CURSO' }),
    ];
    const r = evaluarTransicionesDeEstado(entradaEnA, zonas, 'PROGRAMADO', ESTADOS_VALIDOS);
    const salteada = r.find((d) => d.tipo === 'zona_salteada');
    expect(salteada).toBeDefined();
    expect(salteada!.causa_id).toBe('cz-1');
    expect(salteada!.notificar).toBe(true);
  });

  it('no avisa de zonas salteadas si la zona pide no avisar', () => {
    const zonas = [
      zona({ control_zone_id: 'cz-1', geofence_id: 'geo-x', sequence_order: 1, notify_if_skipped: false }),
      zona({ control_zone_id: 'cz-2', geofence_id: 'geo-a', sequence_order: 2 }),
    ];
    const r = evaluarTransicionesDeEstado(entradaEnA, zonas, 'PROGRAMADO', ESTADOS_VALIDOS);
    expect(r.filter((d) => d.tipo === 'zona_salteada')).toHaveLength(0);
  });

  it('una zona sin transición automática se registra pero no cambia el estado', () => {
    const r = evaluarTransicionesDeEstado(
      entradaEnA,
      [zona({ auto_transition: false })],
      'PROGRAMADO',
      ESTADOS_VALIDOS,
    );
    expect(r.filter((d) => d.tipo === 'transicion_estado')).toHaveLength(0);
    expect(r.filter((d) => d.tipo === 'geocerca_entrada')).toHaveLength(1);
  });

  it('un viaje sin zonas de control no produce nada', () => {
    expect(evaluarTransicionesDeEstado(entradaEnA, [], 'PROGRAMADO', ESTADOS_VALIDOS)).toHaveLength(0);
  });
});
