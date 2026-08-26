import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { requireTenantId } from '../common/tenant/tenant-scope';

/**
 * REPORTES AGREGADOS — tendencias por período.
 *
 * ⚠️ REGLA DE ORO: todos leen de trip_summary y de las tablas materializadas,
 * NUNCA de telemetry. Es la diferencia entre 200 ms y 40 segundos, y es la
 * razón de existir de trip_summary. Si un reporte nuevo necesita telemetry,
 * lo que falta es una columna en trip_summary, no una excepción a la regla.
 */
@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  private rango(desde?: string, hasta?: string): { d: Date; h: Date } {
    const h = hasta ? new Date(hasta) : new Date();
    const d = desde ? new Date(desde) : new Date(h.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { d, h };
  }

  async porVehiculo(tenantId: string, desde?: string, hasta?: string) {
    const tenant = requireTenantId(tenantId, 'ReportesService.porVehiculo');
    const { d, h } = this.rango(desde, hasta);
    return this.prisma.$queryRaw`
      SELECT v.plate, v.alias,
             count(*)::int                                   AS viajes,
             round(sum(s.km_recorridos), 1)                  AS km,
             round(sum(extract(epoch from s.duracion_total))/3600, 1) AS horas,
             sum(s.paradas_no_declaradas)::int               AS paradas_no_declaradas,
             max(s.vel_maxima_kmh)                           AS vel_maxima
      FROM trip_summary s
      JOIN trips t ON t.id = s.trip_id
      JOIN vehicles v ON v.id = t.vehicle_id
      WHERE s.tenant_id = ${tenant}::uuid
        AND s.inicio >= ${d} AND s.inicio <= ${h}
      GROUP BY v.id, v.plate, v.alias
      ORDER BY km DESC NULLS LAST
    `;
  }

  async porConductor(tenantId: string, desde?: string, hasta?: string) {
    const tenant = requireTenantId(tenantId, 'ReportesService.porConductor');
    const { d, h } = this.rango(desde, hasta);
    return this.prisma.$queryRaw`
      SELECT dr.full_name AS conductor,
             count(*)::int                                    AS viajes,
             round(sum(extract(epoch from s.tiempo_en_marcha))/3600, 1) AS horas_conduccion,
             count(*) filter (where s.cumplimiento_ventana)::int        AS en_ventana,
             count(*) filter (where s.cumplimiento_ventana is false)::int AS fuera_de_ventana,
             sum(s.eventos_incidente)::int                    AS incidentes,
             sum(s.paradas_no_declaradas)::int                AS paradas_no_declaradas
      FROM trip_summary s
      JOIN trips t ON t.id = s.trip_id
      JOIN drivers dr ON dr.id = t.driver_id
      WHERE s.tenant_id = ${tenant}::uuid
        AND s.inicio >= ${d} AND s.inicio <= ${h}
      GROUP BY dr.id, dr.full_name
      ORDER BY horas_conduccion DESC NULLS LAST
    `;
  }

  async porRuta(tenantId: string, desde?: string, hasta?: string) {
    const tenant = requireTenantId(tenantId, 'ReportesService.porRuta');
    const { d, h } = this.rango(desde, hasta);
    return this.prisma.$queryRaw`
      SELECT coalesce(t.origin_name, '—') || ' → ' || coalesce(t.destination_name, '—') AS ruta,
             count(*)::int AS viajes,
             round(avg(extract(epoch from s.duracion_total))/3600, 1) AS horas_promedio,
             round(avg(extract(epoch from (t.planned_end - t.planned_start)))/3600, 1) AS horas_planificadas,
             count(*) filter (where s.cumplimiento_ventana is false)::int AS llegadas_tarde,
             round(avg(s.km_recorridos), 1) AS km_promedio
      FROM trip_summary s
      JOIN trips t ON t.id = s.trip_id
      WHERE s.tenant_id = ${tenant}::uuid
        AND s.inicio >= ${d} AND s.inicio <= ${h}
      GROUP BY 1
      HAVING count(*) >= 1
      ORDER BY viajes DESC
    `;
  }

  /** El reporte que vende el producto. */
  async paradasNoDeclaradas(tenantId: string, desde?: string, hasta?: string) {
    const tenant = requireTenantId(tenantId, 'ReportesService.paradasNoDeclaradas');
    const { d, h } = this.rango(desde, hasta);
    return this.prisma.$queryRaw`
      SELECT t.trip_code, t.name AS viaje, v.plate,
             dr.full_name AS conductor,
             s.inicio, s.paradas_no_declaradas,
             s.paradas_declaradas
      FROM trip_summary s
      JOIN trips t ON t.id = s.trip_id
      LEFT JOIN vehicles v ON v.id = t.vehicle_id
      LEFT JOIN drivers dr ON dr.id = t.driver_id
      WHERE s.tenant_id = ${tenant}::uuid
        AND s.inicio >= ${d} AND s.inicio <= ${h}
        AND s.paradas_no_declaradas > 0
      ORDER BY s.paradas_no_declaradas DESC, s.inicio DESC
    `;
  }

  async cadenaDeFrio(tenantId: string, desde?: string, hasta?: string) {
    const tenant = requireTenantId(tenantId, 'ReportesService.cadenaDeFrio');
    const { d, h } = this.rango(desde, hasta);
    return this.prisma.$queryRaw`
      SELECT t.trip_code, t.name AS viaje, v.plate,
             ss.sensor_type, ss.rango_min, ss.rango_max,
             ss.valor_min, ss.valor_max,
             ss.segundos_fuera_de_rango, ss.excursiones,
             ss.calculado_at
      FROM trip_sensor_series ss
      JOIN trips t ON t.id = ss.trip_id
      LEFT JOIN vehicles v ON v.id = t.vehicle_id
      WHERE ss.tenant_id = ${tenant}::uuid
        AND ss.calculado_at >= ${d} AND ss.calculado_at <= ${h}
      ORDER BY ss.segundos_fuera_de_rango DESC, ss.calculado_at DESC
    `;
  }
}
