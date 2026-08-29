import type {
  Decision,
  EstadoVehiculo,
  GeocercaDelPunto,
  PuntoEvaluable,
  ZonaDeControlDelViaje,
} from '../tipos';

/**
 * EVALUADOR DE GEOCERCAS — función pura.
 *
 * No lee la base, no escribe, y no sabe de dónde vino el punto. Recibe el
 * estado anterior y devuelve el nuevo más una lista de decisiones.
 *
 * Es la separación que exigen las reglas del proyecto (la lógica es "ciega") y
 * la razón por la que se puede probar sin base de datos ni esperar a que pase
 * algo en la calle.
 *
 * ⚠️ Emite TRANSICIONES, no pertenencia. "Está en la zona A" no es un evento;
 * "entró en la zona A" sí. Por eso hace falta el estado anterior.
 */
export function evaluarGeocercas(
  estadoPrevio: EstadoVehiculo,
  geocercasActuales: GeocercaDelPunto[],
  punto: PuntoEvaluable,
): { decisiones: Decision[]; geocercasDentro: string[] } {
  const antes = new Set(estadoPrevio.geocercas_dentro);
  const ahora = new Set(geocercasActuales.map((g) => g.geofence_id));
  const decisiones: Decision[] = [];

  for (const g of geocercasActuales) {
    if (antes.has(g.geofence_id)) continue;
    decisiones.push({
      tipo: 'geocerca_entrada',
      tenant_id: punto.tenant_id,
      vehicle_id: punto.vehicle_id,
      trip_id: punto.trip_id,
      momento: punto.timestamp,
      causa_id: g.geofence_id,
      detalle: `Entró en la geocerca "${g.nombre}"`,
      datos: { zone_type: g.zone_type, nombre: g.nombre },
      latitude: punto.latitude,
      longitude: punto.longitude,
      provider_code: punto.provider_code,
    });
  }

  for (const idAntes of antes) {
    if (ahora.has(idAntes)) continue;
    decisiones.push({
      tipo: 'geocerca_salida',
      tenant_id: punto.tenant_id,
      vehicle_id: punto.vehicle_id,
      trip_id: punto.trip_id,
      momento: punto.timestamp,
      causa_id: idAntes,
      detalle: 'Salió de una geocerca',
      datos: {},
      latitude: punto.latitude,
      longitude: punto.longitude,
      provider_code: punto.provider_code,
    });
  }

  return { decisiones, geocercasDentro: [...ahora] };
}

/**
 * EVALUADOR DE TRANSICIONES DE ESTADO — función pura.
 *
 * Traduce entradas y salidas de geocerca a cambios de estado del viaje, usando
 * `control_zones` / `trip_control_zones`, que **ya estaban modeladas en el
 * esquema y nunca tuvieron quien las leyera**: `auto_transition`,
 * `transition_target_status`, `sequence_order`, `notify_if_skipped`.
 *
 * Dos cosas que hace y conviene tener presentes:
 *
 *  1. **No repite.** Una zona con `was_triggered = true` ya cumplió su función.
 *     Sin esto, un vehículo que entra y sale del radio de la geocerca —cosa
 *     habitual con el ruido del GPS— dispararía la transición muchas veces.
 *
 *  2. **Detecta zonas salteadas.** Si se dispara la zona de orden 3 y la 2
 *     nunca se disparó, emite `zona_salteada`. No lo pedía el encargo: sale de
 *     que el esquema ya tenía `notify_if_skipped` y `sequence_order`, que solo
 *     tienen sentido juntos para esto.
 */
export function evaluarTransicionesDeEstado(
  decisionesGeocerca: Decision[],
  zonasDelViaje: ZonaDeControlDelViaje[],
  estadoActualDelViaje: string,
  estadosValidos: string[],
): Decision[] {
  if (zonasDelViaje.length === 0) return [];

  const salida: Decision[] = [];
  const porGeocerca = new Map<string, ZonaDeControlDelViaje>();
  zonasDelViaje.forEach((z) => {
    if (z.geofence_id) porGeocerca.set(z.geofence_id, z);
  });

  // Copia local del estado disparado: dentro de un mismo lote, una zona no
  // puede dispararse dos veces.
  const yaDisparadas = new Set(
    zonasDelViaje.filter((z) => z.was_triggered).map((z) => z.control_zone_id),
  );

  for (const d of decisionesGeocerca) {
    if (d.tipo !== 'geocerca_entrada' || !d.causa_id) continue;

    const zona = porGeocerca.get(d.causa_id);
    if (!zona || yaDisparadas.has(zona.control_zone_id)) continue;

    // Zonas anteriores en el orden que nunca se dispararon.
    const salteadas = zonasDelViaje.filter(
      (z) =>
        z.sequence_order < zona.sequence_order &&
        !z.was_triggered &&
        !yaDisparadas.has(z.control_zone_id),
    );

    for (const s of salteadas) {
      if (!s.notify_if_skipped) continue;
      salida.push({
        tipo: 'zona_salteada',
        tenant_id: d.tenant_id,
        vehicle_id: d.vehicle_id,
        trip_id: d.trip_id,
        momento: d.momento,
        causa_id: s.control_zone_id,
        detalle: `Se salteó la zona de control "${s.nombre}" (orden ${s.sequence_order}): el vehículo llegó a "${zona.nombre}" sin pasar por ella`,
        notificar: true,
        datos: { orden_salteado: s.sequence_order, orden_alcanzado: zona.sequence_order },
      });
    }

    yaDisparadas.add(zona.control_zone_id);

    if (!zona.auto_transition || !zona.transition_target_status) {
      // La zona se marca como alcanzada aunque no cambie el estado: sirve para
      // la detección de salteos y para el informe.
      if (zona.notify_on_enter) {
        salida.push({
          tipo: 'geocerca_entrada',
          tenant_id: d.tenant_id,
          vehicle_id: d.vehicle_id,
          trip_id: d.trip_id,
          momento: d.momento,
          causa_id: zona.control_zone_id,
          detalle: `Llegó a la zona de control "${zona.nombre}"`,
          notificar: true,
          datos: { control_zone_id: zona.control_zone_id },
        });
      }
      continue;
    }

    const destino = zona.transition_target_status;

    // Un destino que no está en el catálogo es una zona mal configurada. No se
    // aplica ni se inventa un estado: se reporta como decisión visible.
    if (!estadosValidos.includes(destino)) {
      salida.push({
        tipo: 'zona_salteada',
        tenant_id: d.tenant_id,
        vehicle_id: d.vehicle_id,
        trip_id: d.trip_id,
        momento: d.momento,
        causa_id: zona.control_zone_id,
        detalle: `La zona "${zona.nombre}" apunta al estado "${destino}", que no existe en el catálogo. No se aplicó la transición.`,
        notificar: true,
        datos: { estado_invalido: destino },
      });
      continue;
    }

    // Ya está en ese estado: no se registra una transición que no ocurrió.
    if (destino === estadoActualDelViaje) continue;

    salida.push({
      tipo: 'transicion_estado',
      tenant_id: d.tenant_id,
      vehicle_id: d.vehicle_id,
      trip_id: d.trip_id,
      momento: d.momento,
      causa_id: zona.control_zone_id,
      estado_destino: destino,
      detalle: `Entró en la zona de control "${zona.nombre}"`,
      notificar: zona.notify_on_enter,
      datos: { control_zone_id: zona.control_zone_id, desde: estadoActualDelViaje },
    });
  }

  return salida;
}
