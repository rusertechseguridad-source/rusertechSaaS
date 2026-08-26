/**
 * CLAVE DE DEDUPLICACIÓN DE TELEMETRÍA.
 *
 * Vive acá, separada del servicio, porque es una regla de negocio con una
 * invariante que se puede probar sin base ni Redis — y porque equivocarla ya
 * costó datos: la versión anterior usaba `(vehículo, instante)` y descartaba
 * en silencio todo evento del HUB que compartiera segundo con un punto de
 * posición. El AVL emite el paquete de evento con el MISMO fix de GPS que el
 * reporte periódico, y los timestamps del HUB tienen precisión de segundo, así
 * que ese choque no es raro: es el caso normal.
 *
 * La identidad de una fila de telemetría es
 *   (vehículo, instante, QUÉ REPORTA)
 * — el mismo criterio que ya usaba el índice de la app móvil
 * (`telemetry_mobile_dedupe`, que incluye `Code`). El índice
 * `telemetry_hub_dedupe` de la Fase A lo lleva a la base para el camino del
 * HUB, en espejo.
 *
 * Redis sigue siendo la primera línea (barata, en memoria, TTL de 300 s); el
 * índice es el respaldo que cubre lo que ese TTL no alcanza: la reentrega
 * tardía, el reinicio de Redis y la carrera entre instancias.
 */

/** Un punto sin código de evento (posición pura) usa esta marca en la clave. */
const SIN_CODIGO = '';

/**
 * Clave de deduplicación para un punto de telemetría.
 *
 * @param vehicleId  Vehículo ya resuelto (no el `Asset` del proveedor).
 * @param timestamp  Instante del punto, tal como lo reporta el equipo.
 * @param code       Código de evento del proveedor, o null/undefined si el
 *                   punto es de posición pura.
 */
export function claveDedupe(
  vehicleId: string,
  timestamp: Date,
  code: string | null | undefined,
): string {
  return `dedup:${vehicleId}:${timestamp.getTime()}:${code ?? SIN_CODIGO}`;
}
