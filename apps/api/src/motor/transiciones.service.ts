import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Decision, ZonaDeControlDelViaje } from './tipos';

interface FilaZona {
  control_zone_id: string;
  nombre: string;
  geofence_id: string | null;
  sequence_order: number;
  was_triggered: boolean;
  auto_transition: boolean;
  transition_target_status: string | null;
  notify_on_enter: boolean;
  notify_on_exit: boolean;
  notify_if_skipped: boolean;
}

/**
 * TRANSICIONES DE ESTADO DEL VIAJE.
 *
 * Lee `control_zones` y `trip_control_zones`, que ya estaban modeladas en el
 * esquema y nunca tuvieron quien las leyera. Persiste los cambios de estado y
 * su historial.
 *
 * ⚠️ Toda transición automática queda registrada con qué la disparó, y es
 * reversible. Una geocerca mal dibujada no puede dejar un viaje trabado sin
 * que se pueda ver por qué ni deshacerlo.
 */
@Injectable()
export class TransicionesService {
  private readonly logger = new Logger(TransicionesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Zonas de control de los viajes del lote.
   *
   * ⚠️ `control_zones` no tiene FK a `geofences`: son dos tablas paralelas.
   * El vínculo se resuelve por geometría — la zona de control corresponde a la
   * geocerca que ocupa el mismo lugar. Se hace UNA vez por lote, no por punto.
   */
  async zonasDeViajes(tripIds: string[]): Promise<Map<string, ZonaDeControlDelViaje[]>> {
    const salida = new Map<string, ZonaDeControlDelViaje[]>();
    if (tripIds.length === 0) return salida;

    const filas: (FilaZona & { trip_id: string })[] = await this.prisma.$queryRaw<
      (FilaZona & { trip_id: string })[]
    >`
      SELECT
        tcz.trip_id::text          AS trip_id,
        cz.id::text                AS control_zone_id,
        cz.name                    AS nombre,
        (SELECT g.id::text FROM geofences g
          WHERE g.tenant_id = cz.tenant_id
            AND g.is_active
            AND ST_Intersects(g.geometry, cz.geometry)
          ORDER BY ST_Area(g.geometry::geometry) ASC
          LIMIT 1)                 AS geofence_id,
        tcz.sequence_order,
        tcz.was_triggered,
        cz.auto_transition,
        cz.transition_target_status,
        cz.notify_on_enter,
        cz.notify_on_exit,
        cz.notify_if_skipped
      FROM trip_control_zones tcz
      JOIN control_zones cz ON cz.id = tcz.control_zone_id
      WHERE tcz.trip_id = ANY(${tripIds}::uuid[])
        AND cz.is_active
      ORDER BY tcz.trip_id, tcz.sequence_order
    `;

    for (const f of filas) {
      const lista = salida.get(f.trip_id) ?? [];
      lista.push({
        control_zone_id: f.control_zone_id,
        nombre: f.nombre,
        geofence_id: f.geofence_id ?? null,
        sequence_order: Number(f.sequence_order ?? 0),
        was_triggered: Boolean(f.was_triggered),
        auto_transition: Boolean(f.auto_transition),
        transition_target_status: f.transition_target_status ?? null,
        notify_on_enter: Boolean(f.notify_on_enter),
        notify_on_exit: Boolean(f.notify_on_exit),
        notify_if_skipped: Boolean(f.notify_if_skipped),
      });
      salida.set(f.trip_id, lista);
    }
    return salida;
  }

  /** Estados válidos del catálogo. Se lee una vez por vuelta del worker. */
  async estadosValidos(): Promise<string[]> {
    const filas: { codigo: string }[] = await this.prisma.$queryRaw<{ codigo: string }[]>`
      SELECT codigo FROM motor_estados_viaje WHERE is_active
    `;
    return filas.map((f) => f.codigo);
  }

  /** Estado actual de los viajes del lote. */
  async estadosDeViajes(tripIds: string[]): Promise<Map<string, string>> {
    if (tripIds.length === 0) return new Map();
    const filas: { id: string; status: string }[] = await this.prisma.$queryRaw<
      { id: string; status: string }[]
    >`
      SELECT id::text, status FROM trips WHERE id = ANY(${tripIds}::uuid[])
    `;
    return new Map(filas.map((f) => [f.id, f.status]));
  }

  /**
   * Aplica una transición: cambia el estado del viaje, deja el historial y
   * marca la zona de control como disparada.
   *
   * Las tres cosas van en UNA transacción. Si el historial no se puede
   * escribir, el estado tampoco cambia: un cambio de estado sin registro es
   * exactamente lo que el diseño prohíbe.
   */
  async aplicarTransicion(decision: Decision, estadoAnterior: string): Promise<void> {
    if (!decision.trip_id || !decision.estado_destino) return;

    const tripId = decision.trip_id;
    const destino = decision.estado_destino;

    await this.prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`
        UPDATE trips SET status = ${destino}, updated_at = now()
        WHERE id = ${tripId}::uuid AND status = ${estadoAnterior}
      `;

      await tx.$executeRaw`
        INSERT INTO trip_state_history (
          tenant_id, trip_id, estado_anterior, estado_nuevo,
          disparado_por, causa_id, causa_detalle, automatico, created_at
        ) VALUES (
          ${decision.tenant_id}::uuid, ${tripId}::uuid, ${estadoAnterior}, ${destino},
          'geocerca', ${decision.causa_id ?? null}::uuid, ${decision.detalle}, true, ${decision.momento}
        )
      `;

      if (decision.causa_id) {
        await tx.$executeRaw`
          UPDATE trip_control_zones
          SET was_triggered = true, triggered_at = ${decision.momento}
          WHERE trip_id = ${tripId}::uuid AND control_zone_id = ${decision.causa_id}::uuid
        `;
      }
    });

    this.logger.log(
      `Viaje ${tripId}: ${estadoAnterior} → ${destino} (${decision.detalle})`,
    );
  }

  /** Marca una zona alcanzada aunque no haya cambiado el estado. */
  async marcarZonaAlcanzada(tripId: string, controlZoneId: string, momento: Date): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE trip_control_zones
      SET was_triggered = true, triggered_at = ${momento}
      WHERE trip_id = ${tripId}::uuid AND control_zone_id = ${controlZoneId}::uuid
    `;
  }
}
