import { MotorWorker } from './motor.worker';
import type { PuntoEvaluable } from './tipos';

/**
 * CABLEADO DEL WORKER — que el motor LLAME a la persistencia.
 *
 * ⚠️ Por qué existe esta suite además de `eventos.service.spec.ts`: probé a
 * quitar la línea `await this.eventos.persistir(decisiones)` del worker y las
 * 27 pruebas siguieron en verde. La suite del servicio prueba el SERVICIO, no
 * que alguien lo use — que es exactamente el error que dejó la escalada de
 * privilegios abierta en la Tanda 3.
 *
 * Acá corre `procesarVehiculo` de verdad, con el evaluador de geocercas real, y
 * se verifica que la decisión llegue a `EventosService`.
 */
const TENANT = '11111111-1111-1111-1111-111111111111';
const VEHICULO = 'aaaa0001-0000-4000-8000-000000000001';
const GEOCERCA = 'bbbb0001-0000-4000-8000-000000000001';
const VIAJE = 'dddd0001-0000-4000-8000-000000000001';

const punto = (over: Partial<PuntoEvaluable> = {}): PuntoEvaluable => ({
  cola_id: '1', telemetry_id: 'tttt0001-0000-4000-8000-000000000001',
  tenant_id: TENANT, vehicle_id: VEHICULO, trip_id: null,
  timestamp: new Date('2026-08-29T12:00:00Z'),
  latitude: -34.6037, longitude: -58.3816,
  speed_kmh: 40, ignition: true, temperature_c: 4.5,
  provider_code: 'PROV-9', origen: 'hub', ...over,
});

const CFG = { eval_geocercas: true, eval_protocolos: false, parada_minutos: 5 } as any;

describe('MotorWorker · el cableado de la persistencia', () => {
  let worker: MotorWorker;
  let eventos: { persistir: jest.Mock };
  let estado: any;
  let seguimiento: { recalcular: jest.Mock };

  beforeEach(() => {
    eventos = { persistir: jest.fn().mockResolvedValue(1) };
    seguimiento = { recalcular: jest.fn().mockResolvedValue(undefined) };
    estado = {
      geocercasDelLote: jest.fn().mockResolvedValue(
        new Map([[0, [{ geofence_id: GEOCERCA, nombre: 'Zona Prohibida Norte', zone_type: 'restricted' }]]]),
      ),
      guardar: jest.fn().mockResolvedValue(undefined),
      guardarGeocercas: jest.fn().mockResolvedValue(undefined),
    };
    worker = new MotorWorker(
      eventos as any, {} as any, estado, {} as any, {} as any, {} as any, {} as any,
      seguimiento as any,
    );
  });

  /** `procesarVehiculo` es privado: se invoca por `as any` porque lo que hay
   *  que probar es justamente su cableado interno. */
  const procesar = (puntos: PuntoEvaluable[]) =>
    (worker as any).procesarVehiculo(
      VEHICULO, TENANT, puntos, undefined, CFG, new Map(), new Map(), [],
    );

  it('🔴 una entrada a geocerca llega a EventosService', async () => {
    await procesar([punto()]);

    expect(eventos.persistir).toHaveBeenCalledTimes(1);
    const decisiones = eventos.persistir.mock.calls[0][0];
    expect(decisiones).toHaveLength(1);
    expect(decisiones[0]).toMatchObject({
      tipo: 'geocerca_entrada',
      tenant_id: TENANT,
      vehicle_id: VEHICULO,
      causa_id: GEOCERCA,
      latitude: -34.6037,
      longitude: -58.3816,
    });
  });

  it('🔴 se persiste DESPUÉS de guardar el estado, para que un reintento no duplique', async () => {
    const orden: string[] = [];
    estado.guardarGeocercas.mockImplementation(async () => { orden.push('estado'); });
    eventos.persistir.mockImplementation(async () => { orden.push('eventos'); return 1; });

    await procesar([punto()]);

    // Si se escribiera ANTES, un fallo entre medio dejaría la alerta escrita y
    // el estado sin actualizar: el reintento la volvería a emitir.
    expect(orden).toEqual(['estado', 'eventos']);
  });

  it('sin decisiones no llama a la persistencia', async () => {
    estado.geocercasDelLote.mockResolvedValue(new Map());
    await procesar([punto()]);
    expect(eventos.persistir).not.toHaveBeenCalled();
  });

  it('🔴 si la persistencia falla, la excepción SUBE al llamador', async () => {
    // El llamador la atrapa y llama a `marcarFallido`, que devuelve el punto a
    // la cola. Ese camino ya existía; lo que hay que garantizar es que el error
    // llegue hasta él.
    eventos.persistir.mockRejectedValue(new Error('base caída'));
    await expect(procesar([punto()])).rejects.toThrow('base caída');
  });

  it('el estado del vehículo se guarda igual, aunque no haya decisiones', async () => {
    estado.geocercasDelLote.mockResolvedValue(new Map());
    await procesar([punto()]);
    expect(estado.guardar).toHaveBeenCalled();
  });

  // ══════════════════════════════════════════════════════════════════════
  // ETAPA 3A · que el ESTADO DE SEGUIMIENTO se recalcule
  // ══════════════════════════════════════════════════════════════════════
  //
  // ⚠️ Estas tres existen porque el defecto YA OCURRIÓ: `recalcular()` quedó
  // escrito, con 31 pruebas propias, y sin un solo llamador. Gustavo lo midió
  // contra la base — dos condiciones abiertas y `GET /seguimiento` devolviendo
  // `{"estado": null}`. Es el mismo hallazgo de la Tanda 5, y ninguna de las
  // 16 reglas de cableado lo cazó: R10 vigila `eventos.persistir` y nada más.
  //
  // La suite de `seguimiento` prueba el SERVICIO. Ésta prueba que alguien lo
  // llame.

  it('🔴 un punto CON viaje recalcula el estado de seguimiento', async () => {
    await procesar([punto({ trip_id: VIAJE })]);

    expect(seguimiento.recalcular).toHaveBeenCalledTimes(1);
    expect(seguimiento.recalcular).toHaveBeenCalledWith(VIAJE, TENANT, expect.any(Date));
  });

  it('🔴 se recalcula UNA vez por viaje por lote, no una por punto', async () => {
    // El seguimiento es un evaluador «de estado actual»: sólo importa el
    // último punto del vehículo en el lote. Recalcular por punto multiplicaría
    // por seis el costo con un vehículo reportando cada 5 segundos.
    await procesar([
      punto({ cola_id: '1', trip_id: VIAJE }),
      punto({ cola_id: '2', trip_id: VIAJE, timestamp: new Date('2026-08-29T12:00:30Z') }),
      punto({ cola_id: '3', trip_id: VIAJE, timestamp: new Date('2026-08-29T12:01:00Z') }),
    ]);

    expect(seguimiento.recalcular).toHaveBeenCalledTimes(1);
    // Y con el momento del ÚLTIMO punto, no el del primero.
    expect(seguimiento.recalcular.mock.calls[0][2]).toEqual(new Date('2026-08-29T12:01:00Z'));
  });

  it('un punto SIN viaje no recalcula nada', async () => {
    // Tracking libre: hay telemetría y no hay viaje declarado. No hay estado
    // de seguimiento que calcular, y pedirlo sería una consulta por punto.
    await procesar([punto({ trip_id: null })]);

    expect(seguimiento.recalcular).not.toHaveBeenCalled();
  });
});
