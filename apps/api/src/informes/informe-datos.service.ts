import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { requireTenantId } from '../common/tenant/tenant-scope';

/**
 * DATOS DEL INFORME DE VIAJE.
 *
 * Junta en una sola estructura todo lo que la plantilla necesita. Regla de
 * lectura: el resumen, las series y las excursiones salen de las tablas
 * MATERIALIZADAS (trip_summary, trip_sensor_*) — nunca de telemetry. Es lo que
 * hace que el informe se pueda reimprimir después de la purga, y que abrirlo
 * cueste milisegundos y no un escaneo de millones de puntos.
 */
@Injectable()
export class InformeDatosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Para el botón del informe: qué hay y qué está pasando con el cálculo. */
  async estadoResumen(tripId: string, tenantId: string) {
    const tenant = requireTenantId(tenantId, 'InformeDatosService.estadoResumen');
    return this.prisma.$queryRaw<any[]>`
      SELECT (s.trip_id IS NOT NULL) AS tiene_resumen,
             tr.estado               AS trabajo,
             tr.error                AS trabajo_error
      FROM trips t
      LEFT JOIN trip_summary s ON s.trip_id = t.id
      LEFT JOIN LATERAL (
        SELECT estado, error FROM motor_trabajos m
        WHERE m.trip_id = t.id AND m.tipo = 'calcular_resumen'
        ORDER BY m.created_at DESC LIMIT 1
      ) tr ON true
      WHERE t.id = ${tripId}::uuid AND t.tenant_id = ${tenant}::uuid
    `;
  }

  async obtener(tripId: string, tenantId: string) {
    const tenant = requireTenantId(tenantId, 'InformeDatosService.obtener');

    const [viaje] = await this.prisma.$queryRaw<any[]>`
      SELECT t.id::text, t.trip_code, t.name, t.status, t.criticality,
             t.planned_start, t.planned_end, t.actual_start, t.actual_end,
             t.origin_name, t.destination_name,
             v.plate, v.alias,
             d.full_name AS conductor,
             c.name AS transportista,
             tn.name AS tenant_nombre, tn.settings_json AS tenant_settings
      FROM trips t
      LEFT JOIN vehicles v ON v.id = t.vehicle_id
      LEFT JOIN drivers  d ON d.id = t.driver_id
      LEFT JOIN carriers c ON c.id = t.carrier_id
      JOIN tenants tn ON tn.id = t.tenant_id
      WHERE t.id = ${tripId}::uuid AND t.tenant_id = ${tenant}::uuid
    `;
    // 404 y no 403: no confirmamos la existencia de viajes de otros tenants.
    if (!viaje) throw new NotFoundException('Viaje no encontrado');

    const [resumen] = await this.prisma.$queryRaw<any[]>`
      SELECT puntos_totales, km_recorridos, vel_maxima_kmh, vel_promedio_kmh,
             inicio, fin, duracion_total::text, tiempo_en_marcha::text,
             tiempo_detenido::text, paradas_declaradas, paradas_no_declaradas,
             eventos_sos, eventos_incidente, eventos_checkpoint, eventos_comm,
             fotos_totales, tiempos_por_estado, condiciones,
             cumplimiento_ventana, minutos_fuera_ventana, rango_sensores,
             ST_AsGeoJSON(recorrido::geometry) AS recorrido_geojson,
             calculado_at
      FROM trip_summary WHERE trip_id = ${tripId}::uuid
    `;

    const historial = await this.prisma.$queryRaw<any[]>`
      SELECT h.estado_anterior, h.estado_nuevo, h.disparado_por, h.causa_detalle,
             h.automatico, h.created_at, e.nombre AS nombre_nuevo, e.color
      FROM trip_state_history h
      LEFT JOIN motor_estados_viaje e ON e.codigo = h.estado_nuevo
      WHERE h.trip_id = ${tripId}::uuid AND h.tenant_id = ${tenant}::uuid
      ORDER BY h.created_at
    `;

    const series = await this.prisma.$queryRaw<any[]>`
      SELECT sensor_type, serie, puntos, valor_min, valor_max, valor_prom,
             rango_min, rango_max, segundos_fuera_de_rango, excursiones
      FROM trip_sensor_series WHERE trip_id = ${tripId}::uuid
    `;

    const excursiones = await this.prisma.$queryRaw<any[]>`
      SELECT sensor_type, inicio, fin, duracion_segundos, valor_extremo, lado,
             rango_min, rango_max, latitude, longitude, direccion
      FROM trip_sensor_excursions
      WHERE trip_id = ${tripId}::uuid ORDER BY inicio
    `;

    const condiciones = await this.prisma.$queryRaw<any[]>`
      SELECT c.tipo, c.nivel_riesgo, c.inicio, c.fin, c.origen, c.disparador,
             c.atendida_at IS NOT NULL AS atendida, c.nota,
             mt.nombre AS tipo_nombre, nr.nombre AS riesgo_nombre, nr.color
      FROM trip_conditions c
      LEFT JOIN motor_tipos_condicion mt ON mt.codigo = c.tipo
      LEFT JOIN motor_niveles_riesgo nr ON nr.codigo = c.nivel_riesgo AND nr.tenant_id IS NULL
      WHERE c.trip_id = ${tripId}::uuid
      ORDER BY c.inicio
    `;

    const fotos = await this.prisma.$queryRaw<any[]>`
      SELECT id::text, type, notes, latitude, longitude, storage_path, created_at
      FROM trip_attachments
      WHERE trip_id = ${tripId}::uuid AND tenant_id = ${tenant}::uuid
      ORDER BY created_at
    `;

    const alertas = await this.prisma.$queryRaw<any[]>`
      SELECT event_type, severity, status, triggered_at, resolved_at, resolution_note
      FROM event_logs
      WHERE trip_id = ${tripId}::uuid AND tenant_id = ${tenant}::uuid
      ORDER BY triggered_at
    `;

    return { viaje, resumen: resumen ?? null, historial, series, excursiones, condiciones, fotos, alertas };
  }
}
