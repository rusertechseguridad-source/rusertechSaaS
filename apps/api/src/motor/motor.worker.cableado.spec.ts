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

  beforeEach(() => {
    eventos = { persistir: jest.fn().mockResolvedValue(1) };
    estado = {
      geocercasDelLote: jest.fn().mockResolvedValue(
        new Map([[0, [{ geofence_id: GEOCERCA, nombre: 'Zona Prohibida Norte', zone_type: 'restricted' }]]]),
      ),
      guardar: jest.fn().mockResolvedValue(undefined),
      guardarGeocercas: jest.fn().mockResolvedValue(undefined),
    };
    worker = new MotorWorker(
      eventos as any, {} as any, estado, {} as any, {} as any, {} as any, {} as any,
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
});
