import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { EstadoVehiculo, GeocercaDelPunto, PuntoEvaluable } from './tipos';

interface FilaEstado {
  vehicle_id: string;
  tenant_id: string;
  ultimo_punto_ts: Date | null;
  ultima_velocidad: number | null;
  ultima_ignicion: boolean | null;
  detenido_desde: Date | null;
  geocercas_dentro: string[] | null;
}

interface FilaGeocercaLote {
  idx: number;
  geofence_id: string;
  nombre: string;
  zone_type: string;
}

/**
 * ESTADO DEL MOTOR POR VEHÍCULO.
 *
 * Los evaluadores necesitan saber qué pasó antes. Sin este estado, cada punto
 * obligaría a releer histórico de telemetría, que es justamente lo que el
 * diseño evita.
 *
 * Se escribe una vez por vehículo por lote, no una vez por punto.
 */
@Injectable()
export class EstadoVehiculoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Carga el estado de los vehículos del lote en una sola consulta.
   *
   * Las geocercas vigentes salen de `vehicle_geofence_state`, que es lo que
   * permite detectar transiciones en vez de pertenencia.
   */
  async cargar(vehicleIds: string[]): Promise<Map<string, EstadoVehiculo>> {
    if (vehicleIds.length === 0) return new Map();

    const filas: FilaEstado[] = await this.prisma.$queryRaw<FilaEstado[]>`
      SELECT
        v.id::text AS vehicle_id,
        v.tenant_id::text AS tenant_id,
        e.ultimo_punto_ts,
        e.ultima_velocidad,
        e.ultima_ignicion,
        e.detenido_desde,
        coalesce(
          (SELECT array_agg(g.geofence_id::text)
             FROM vehicle_geofence_state g
            WHERE g.vehicle_id = v.id AND g.dentro),
          '{}'
        ) AS geocercas_dentro
      FROM vehicles v
      LEFT JOIN motor_estado_vehiculo e ON e.vehicle_id = v.id
      WHERE v.id = ANY(${vehicleIds}::uuid[])
    `;

    return new Map(
      filas.map((f) => [
        f.vehicle_id,
        {
          vehicle_id: f.vehicle_id,
          tenant_id: f.tenant_id,
          ultimo_punto_ts: f.ultimo_punto_ts ?? null,
          ultima_velocidad: f.ultima_velocidad === null ? null : Number(f.ultima_velocidad),
          ultima_ignicion: f.ultima_ignicion ?? null,
          detenido_desde: f.detenido_desde ?? null,
          geocercas_dentro: f.geocercas_dentro ?? [],
        },
      ]),
    );
  }

  /**
   * Geocercas que contienen cada punto del lote, en UNA sola consulta.
   *
   * ⚠️ Esto es una decisión de rendimiento, no de estilo. La función cuesta
   * 0,041 ms medidos, pero el viaje de ida y vuelta a la base cuesta órdenes
   * de magnitud más. Con 200 puntos, una consulta por punto serían 200 viajes;
   * así es uno solo. El `unnest` + `lateral` es lo que lo permite.
   */
  async geocercasDelLote(
    tenantId: string,
    puntos: PuntoEvaluable[],
  ): Promise<Map<number, GeocercaDelPunto[]>> {
    const resultado = new Map<number, GeocercaDelPunto[]>();
    if (puntos.length === 0) return resultado;

    const indices = puntos.map((_, i) => i);
    const lats = puntos.map((p) => p.latitude);
    const lngs = puntos.map((p) => p.longitude);

    const filas: FilaGeocercaLote[] = await this.prisma.$queryRaw<FilaGeocercaLote[]>`
      SELECT p.idx, g.id::text AS geofence_id, g.name AS nombre, g.zone_type
      FROM unnest(${indices}::int[], ${lats}::float8[], ${lngs}::float8[]) AS p(idx, lat, lng)
      CROSS JOIN LATERAL (
        SELECT gf.id, gf.name, gf.zone_type
        FROM geofences gf
        WHERE gf.tenant_id = ${tenantId}::uuid
          AND gf.is_active
          AND ST_Intersects(
                gf.geometry,
                ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography
              )
      ) g
    `;

    for (const f of filas) {
      const idx = Number(f.idx);
      const lista = resultado.get(idx) ?? [];
      lista.push({ geofence_id: f.geofence_id, nombre: f.nombre, zone_type: f.zone_type });
      resultado.set(idx, lista);
    }
    return resultado;
  }

  /** Persiste el estado del vehículo. Una escritura por vehículo por lote. */
  async guardar(estado: EstadoVehiculo, evaluadoHasta: Date): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO motor_estado_vehiculo (
        vehicle_id, tenant_id, ultimo_punto_ts, ultima_velocidad, ultima_ignicion,
        detenido_desde, evaluado_hasta, actualizado_at
      ) VALUES (
        ${estado.vehicle_id}::uuid, ${estado.tenant_id}::uuid, ${estado.ultimo_punto_ts},
        ${estado.ultima_velocidad}, ${estado.ultima_ignicion}, ${estado.detenido_desde},
        ${evaluadoHasta}, now()
      )
      ON CONFLICT (vehicle_id) DO UPDATE SET
        ultimo_punto_ts  = EXCLUDED.ultimo_punto_ts,
        ultima_velocidad = EXCLUDED.ultima_velocidad,
        ultima_ignicion  = EXCLUDED.ultima_ignicion,
        detenido_desde   = EXCLUDED.detenido_desde,
        evaluado_hasta   = EXCLUDED.evaluado_hasta,
        actualizado_at   = now()
    `;
  }

  /**
   * Sincroniza en qué geocercas está el vehículo.
   *
   * Se escribe el estado completo (dentro = true para las actuales, false para
   * el resto) en vez de sólo los cambios: es una tabla chica y así no puede
   * quedar desincronizada si se pierde una actualización intermedia.
   */
  async guardarGeocercas(
    vehicleId: string,
    tenantId: string,
    dentro: string[],
    momento: Date,
  ): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE vehicle_geofence_state
      SET dentro = false, ultimo_check = ${momento}
      WHERE vehicle_id = ${vehicleId}::uuid
        AND dentro
        AND NOT (geofence_id = ANY(${dentro}::uuid[]))
    `;

    if (dentro.length === 0) return;

    await this.prisma.$executeRaw`
      INSERT INTO vehicle_geofence_state (vehicle_id, geofence_id, tenant_id, dentro, desde, ultimo_check)
      SELECT ${vehicleId}::uuid, g, ${tenantId}::uuid, true, ${momento}, ${momento}
      FROM unnest(${dentro}::uuid[]) AS g
      ON CONFLICT (vehicle_id, geofence_id) DO UPDATE SET
        dentro       = true,
        -- La columna desde solo se mueve si estaba afuera: si ya estaba
        -- adentro, la permanencia se cuenta desde la entrada original.
        desde        = CASE WHEN vehicle_geofence_state.dentro
                            THEN vehicle_geofence_state.desde
                            ELSE EXCLUDED.desde END,
        ultimo_check = EXCLUDED.ultimo_check
    `;
  }
}
