import { Logger } from '@nestjs/common';
import { EventosService } from './eventos.service';
import { evaluarGeocercas } from './evaluadores/geocercas.evaluator';
import { severidadDe, SEVERIDAD_POR_TIPO } from './severidad';
import type { EstadoVehiculo, PuntoEvaluable } from './tipos';

/**
 * LA PRUEBA QUE IMPORTA: que una decisión del evaluador TERMINE ESCRITA.
 *
 * No prueba que la función pura funcione —eso ya está probado— sino el tramo
 * que faltaba: el evaluador decide, y esa decisión llega a `event_logs` con las
 * columnas que la tabla tiene.
 */
const TENANT = '11111111-1111-1111-1111-111111111111';
const VEHICULO = 'aaaa0001-0000-4000-8000-000000000001';
const VIAJE = 'cccc0001-0000-4000-8000-000000000001';
const GEOCERCA = 'bbbb0001-0000-4000-8000-000000000001';

const punto = (over: Partial<PuntoEvaluable> = {}): PuntoEvaluable => ({
  cola_id: '1', telemetry_id: 'tttt0001-0000-4000-8000-000000000001',
  tenant_id: TENANT, vehicle_id: VEHICULO, trip_id: VIAJE,
  timestamp: new Date('2026-08-29T12:00:00Z'),
  latitude: -34.6037, longitude: -58.3816,
  speed_kmh: 40, ignition: true, temperature_c: 4.5,
  provider_code: 'PROV-9', origen: 'hub', ...over,
});

const estadoVacio: EstadoVehiculo = {
  vehicle_id: VEHICULO, tenant_id: TENANT, ultimo_punto_ts: null,
  ultima_velocidad: null, ultima_ignicion: null, detenido_desde: null,
  geocercas_dentro: [],
};

const zona = { geofence_id: GEOCERCA, nombre: 'Zona Prohibida Norte', zone_type: 'restricted' };

describe('EventosService · el motor deja de tirar lo que calcula', () => {
  let servicio: EventosService;
  let createMany: jest.Mock;

  beforeEach(() => {
    createMany = jest.fn().mockResolvedValue({ count: 1 });
    servicio = new EventosService({ eventLog: { createMany } } as any);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  // ── EL CIRCUITO COMPLETO ───────────────────────────────────────────────
  it('🔴 una entrada a geocerca calculada por el evaluador termina en event_logs', async () => {
    // 1. El evaluador decide, con el mismo código que corre en producción.
    const { decisiones } = evaluarGeocercas(estadoVacio, [zona], punto());
    expect(decisiones).toHaveLength(1);

    // 2. El servicio la escribe.
    await servicio.persistir(decisiones);

    // 3. Y llega con las columnas que la tabla tiene, verificadas contra
    //    `model EventLog` en schema.prisma.
    const fila = createMany.mock.calls[0][0].data[0];
    expect(fila).toMatchObject({
      tenant_id: TENANT,
      vehicle_id: VEHICULO,
      trip_id: VIAJE,
      event_type: 'geocerca_entrada',
      severity: 'warning',
      status: 'open',
      latitude: -34.6037,
      longitude: -58.3816,
      provider_code: 'PROV-9',
    });
    expect(fila.triggered_at).toEqual(new Date('2026-08-29T12:00:00Z'));
    expect(fila.metadata_json).toMatchObject({
      causa_id: GEOCERCA,
      nombre: 'Zona Prohibida Norte',
      zone_type: 'restricted',
      origen: 'motor',
    });
    // El detalle es lo que ve el operador en la pantalla de Alertas.
    expect(fila.metadata_json.detalle).toContain('Zona Prohibida Norte');
  });

  it('no inventa columnas: sólo escribe las que `model EventLog` declara', () => {
    // Columnas reales, copiadas del esquema. Si alguien agrega una clave que
    // no existe, Prisma falla en runtime con un error poco claro.
    const COLUMNAS = new Set([
      'id', 'tenant_id', 'vehicle_id', 'trip_id', 'rule_id', 'event_type',
      'severity', 'triggered_at', 'resolved_at', 'acknowledged_by',
      'acknowledged_at', 'status', 'latitude', 'longitude', 'address',
      'provider_code', 'no_signal_zone_id', 'grouped_count', 'metadata_json',
      'resolution_note',
    ]);
    const { decisiones } = evaluarGeocercas(estadoVacio, [zona], punto());
    return servicio.persistir(decisiones).then(() => {
      const desconocidas = Object.keys(createMany.mock.calls[0][0].data[0])
        .filter((k) => !COLUMNAS.has(k));
      expect(desconocidas).toEqual([]);
    });
  });

  // ── LOS DUPLICADOS, QUE ERA LA OTRA PREGUNTA ──────────────────────────
  describe('un vehículo quieto dentro de la zona no genera ruido', () => {
    it('cinco puntos seguidos dentro de la misma geocerca → UNA sola alerta', async () => {
      // "Una alerta repetida cada 30 segundos es ruido que enseña a ignorar la
      // pantalla." La idempotencia vive en el evaluador, no en un índice único.
      let estado = estadoVacio;
      const todas = [];
      for (let i = 0; i < 5; i++) {
        const r = evaluarGeocercas(estado, [zona], punto({ timestamp: new Date(Date.UTC(2026, 7, 29, 12, i)) }));
        todas.push(...r.decisiones);
        estado = { ...estado, geocercas_dentro: r.geocercasDentro };
      }
      expect(todas).toHaveLength(1);
      await servicio.persistir(todas);
      expect(createMany.mock.calls[0][0].data).toHaveLength(1);
    });

    it('salir y volver a entrar SÍ genera dos hechos distintos', async () => {
      let r = evaluarGeocercas(estadoVacio, [zona], punto());
      let estado = { ...estadoVacio, geocercas_dentro: r.geocercasDentro };
      const salida = evaluarGeocercas(estado, [], punto());
      estado = { ...estado, geocercas_dentro: salida.geocercasDentro };
      const reentrada = evaluarGeocercas(estado, [zona], punto());

      const tipos = [...r.decisiones, ...salida.decisiones, ...reentrada.decisiones].map((d) => d.tipo);
      expect(tipos).toEqual(['geocerca_entrada', 'geocerca_salida', 'geocerca_entrada']);
    });
  });

  // ── QUÉ PASA SI LA ESCRITURA FALLA ────────────────────────────────────
  it('🔴 si el INSERT falla, el error SUBE — no se traga', async () => {
    // El llamador devuelve el punto a la cola con `marcarFallido`. Tragarse el
    // error acá repetiría el problema que esta tanda viene a resolver.
    createMany.mockRejectedValue(new Error('conexión perdida con la base'));
    const { decisiones } = evaluarGeocercas(estadoVacio, [zona], punto());
    await expect(servicio.persistir(decisiones)).rejects.toThrow('conexión perdida');
  });

  it('sin decisiones no toca la base', async () => {
    expect(await servicio.persistir([])).toBe(0);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('deja en el log QUÉ escribió, no sólo cuántas filas', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const { decisiones } = evaluarGeocercas(estadoVacio, [zona], punto());
    await servicio.persistir(decisiones);
    expect(log.mock.calls[0][0]).toContain('geocerca_entrada');
  });

  // ── LA SEVERIDAD ───────────────────────────────────────────────────────
  describe('severidad', () => {
    it.each(Object.entries(SEVERIDAD_POR_TIPO))('%s → %s', (tipo, esperada) => {
      expect(severidadDe(tipo as any)).toBe(esperada);
    });

    it('una zona de control NO alcanzada es lo más grave de los tres', () => {
      expect(severidadDe('zona_salteada')).toBe('critical');
    });

    it('un tipo nuevo sin severidad falla hacia warning, no hacia info', () => {
      // Mejor que aparezca de más a que se pierda entre el ruido.
      expect(severidadDe('tipo_que_no_existe_todavia' as any)).toBe('warning');
    });
  });
});
