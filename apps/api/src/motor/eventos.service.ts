import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { severidadDe } from './severidad';
import type { Decision } from './tipos';

/**
 * PERSISTENCIA DE LO QUE EL MOTOR DECIDE.
 *
 * ⚠️ Por qué existe: hasta esta tanda el motor evaluaba las geocercas
 * correctamente, armaba la decisión, y `const decisiones: Decision[] = []` era
 * una variable LOCAL de `procesarVehiculo()` que sólo se usaba para escribir
 * una línea de log. Después la función terminaba y el arreglo moría.
 *
 * Medido en la auditoría: los únicos escritores de `event_logs` en todo el repo
 * eran `trips.service.ts:472` (nota de operador) y `vehicles.service.ts:174`
 * (bloqueo manual). **El motor no escribía ni una fila.** Un camión entraba en
 * una zona prohibida, el motor lo calculaba bien, y la pantalla de Alertas
 * mostraba vacío — que el operador lee como "no pasó nada".
 *
 * ── SOBRE LOS DUPLICADOS ──────────────────────────────────────────────────
 * No hay `ON CONFLICT` ni índice único nuevo, y es a propósito: la
 * idempotencia ya está donde corresponde, en el evaluador.
 * `geocercas.evaluator.ts:32` saltea las geocercas en las que el vehículo YA
 * estaba (`if (antes.has(g.geofence_id)) continue`), así que un vehículo
 * quieto dentro de una zona produce UNA entrada, no una por punto.
 *
 * Y ante un reintento del lote tampoco se duplica: `guardarGeocercas()` corre
 * ANTES de esta escritura, de modo que el segundo intento compara contra el
 * estado ya actualizado y no emite ninguna decisión. Es idempotencia por
 * estado, no por restricción de la base — verificado con prueba.
 */
@Injectable()
export class EventosService {
  private readonly logger = new Logger(EventosService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Escribe las decisiones del lote en `event_logs`.
   *
   * @returns cuántas filas se escribieron.
   * @throws  si la escritura falla. **A propósito**: el llamador tiene que
   *          poder devolver el punto a la cola. Una alerta que no se escribe
   *          es una alerta que nadie ve; tragarse el error acá sería repetir
   *          el problema que esta tanda viene a resolver, sólo que más adentro.
   */
  async persistir(decisiones: Decision[]): Promise<number> {
    if (decisiones.length === 0) return 0;

    // Nombres tomados uno por uno de `model EventLog` en schema.prisma.
    // NO se escriben: `rule_id` (el evaluador de `event_rules` es de la Etapa 4
    // y no existe), `no_signal_zone_id`, `acknowledged_by/at`, `resolved_at` y
    // `resolution_note` (los completa el operador al resolver la alerta).
    const filas = decisiones.map((d) => ({
      tenant_id: d.tenant_id,
      vehicle_id: d.vehicle_id,
      trip_id: d.trip_id,
      event_type: d.tipo,
      severity: severidadDe(d.tipo),
      triggered_at: d.momento,
      // `status: 'open'` es el valor por defecto de la columna, y es lo que la
      // convierte en trabajo pendiente: el despachador de notificaciones —que
      // todavía no existe— va a leer de acá.
      status: 'open',
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      provider_code: d.provider_code ?? null,
      metadata_json: {
        detalle: d.detalle,
        causa_id: d.causa_id ?? null,
        notificar: d.notificar ?? false,
        estado_destino: d.estado_destino ?? null,
        origen: 'motor',
        ...(d.datos ?? {}),
      },
    }));

    const resultado = await this.prisma.eventLog.createMany({ data: filas });

    this.logger.log(
      `Motor: ${resultado.count} evento(s) escritos en event_logs ` +
        `(${this.resumirTipos(decisiones)}).`,
    );
    return resultado.count;
  }

  /** "2 geocerca_entrada, 1 zona_salteada" — para que el log diga QUÉ se escribió. */
  private resumirTipos(decisiones: Decision[]): string {
    const cuenta = new Map<string, number>();
    for (const d of decisiones) cuenta.set(d.tipo, (cuenta.get(d.tipo) ?? 0) + 1);
    return [...cuenta.entries()].map(([tipo, n]) => `${n} ${tipo}`).join(', ');
  }
}
