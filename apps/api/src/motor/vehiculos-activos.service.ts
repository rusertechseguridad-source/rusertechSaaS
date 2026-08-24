import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ResultadoSincronizacion {
  activados_por_estado: number;
  activados_por_red_seguridad: number;
  desactivados: number;
}

/**
 * QUÉ VEHÍCULOS ESTÁN BAJO MONITOREO.
 *
 * Mantiene `motor_vehiculos_activos`, la tabla que consulta el disparador de
 * encolado en cada INSERT de telemetría. Es diminuta a propósito: con 15 viajes
 * activos tiene 15 filas.
 *
 * ⚠️ DECISIÓN #1 DEL DISEÑO — el monitoreo está SEPARADO del estado del viaje.
 *
 * Mover un viaje a EN_ORIGEN sólo para poder monitorearlo sería afirmar que el
 * vehículo llegó al punto de carga sin saberlo. Es la misma clase de afirmación
 * falsa que se corrigió tres veces en este sistema (el mapa vacío, los códigos
 * desconocidos, el "Último dato: Nunca").
 *
 * Por eso el monitoreo se activa por CUALQUIERA de tres caminos, y ninguno
 * toca el estado:
 *   1. el viaje entró en un estado monitoreable
 *   2. un operador lo activó a mano
 *   3. red de seguridad: faltan menos de N minutos para el inicio planificado
 *
 * La red de seguridad NO es "mirar por las dudas": es que si llega un evento
 * del proveedor externo antes de que nadie marque nada, el sistema lo procese
 * en vez de descartarlo.
 */
@Injectable()
export class VehiculosActivosService {
  private readonly logger = new Logger(VehiculosActivosService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sincroniza la tabla con la realidad de los viajes.
   *
   * Se corre periódicamente y es idempotente: activa lo que corresponde,
   * desactiva lo que dejó de corresponder, y no toca lo que ya está bien.
   */
  async sincronizar(): Promise<ResultadoSincronizacion> {
    // ── 1. Por estado monitoreable ──────────────────────────────────────────
    const porEstado = await this.prisma.$executeRaw`
      INSERT INTO motor_vehiculos_activos (vehicle_id, tenant_id, trip_id, motivo, desde)
      SELECT DISTINCT ON (t.vehicle_id)
             t.vehicle_id, t.tenant_id, t.id, 'estado', now()
      FROM trips t
      JOIN motor_estados_viaje e ON e.codigo = t.status AND e.monitoreable
      WHERE t.vehicle_id IS NOT NULL
      ORDER BY t.vehicle_id, t.planned_start DESC
      ON CONFLICT (vehicle_id) DO UPDATE SET
        trip_id = EXCLUDED.trip_id,
        motivo  = 'estado'
      WHERE motor_vehiculos_activos.motivo <> 'manual'
    `;

    // ── 2. Red de seguridad ─────────────────────────────────────────────────
    // Sólo para viajes que todavía no están monitoreados por otro camino.
    const porRed = await this.prisma.$executeRaw`
      INSERT INTO motor_vehiculos_activos (vehicle_id, tenant_id, trip_id, motivo, desde)
      SELECT DISTINCT ON (t.vehicle_id)
             t.vehicle_id, t.tenant_id, t.id, 'red_seguridad', now()
      FROM trips t
      JOIN motor_estados_viaje e ON e.codigo = t.status AND NOT e.monitoreable AND NOT e.es_terminal
      LEFT JOIN tenant_engine_config c ON c.tenant_id = t.tenant_id
      WHERE t.vehicle_id IS NOT NULL
        AND coalesce(c.red_seguridad_activa, true)
        AND t.planned_start <= now() + (coalesce(c.red_seguridad_minutos, 30) || ' minutes')::interval
        AND t.planned_start >= now() - interval '24 hours'
      ORDER BY t.vehicle_id, t.planned_start ASC
      ON CONFLICT (vehicle_id) DO NOTHING
    `;

    // ── 3. Bajas ────────────────────────────────────────────────────────────
    // Sale de monitoreo el vehículo cuyo viaje terminó, salvo que un operador
    // lo haya activado a mano: una activación manual la desactiva una persona.
    const bajas = await this.prisma.$executeRaw`
      DELETE FROM motor_vehiculos_activos a
      USING trips t
      WHERE a.trip_id = t.id
        AND a.motivo <> 'manual'
        AND EXISTS (
          SELECT 1 FROM motor_estados_viaje e
          WHERE e.codigo = t.status AND e.es_terminal
        )
    `;

    if (porEstado + porRed + bajas > 0) {
      this.logger.log(
        `Monitoreo sincronizado: ${porEstado} por estado, ${porRed} por red de seguridad, ${bajas} bajas.`,
      );
    }

    return {
      activados_por_estado: porEstado,
      activados_por_red_seguridad: porRed,
      desactivados: bajas,
    };
  }

  /** Activación manual por un operador. Sobrevive a la sincronización. */
  async activarManual(vehicleId: string, tenantId: string, tripId: string | null): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO motor_vehiculos_activos (vehicle_id, tenant_id, trip_id, motivo, desde)
      VALUES (${vehicleId}::uuid, ${tenantId}::uuid, ${tripId}::uuid, 'manual', now())
      ON CONFLICT (vehicle_id) DO UPDATE SET
        motivo  = 'manual',
        trip_id = EXCLUDED.trip_id
    `;
  }

  /** Baja manual. */
  async desactivar(vehicleId: string, tenantId: string): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM motor_vehiculos_activos
      WHERE vehicle_id = ${vehicleId}::uuid AND tenant_id = ${tenantId}::uuid
    `;
  }

  /**
   * Qué se está monitoreando y por qué.
   *
   * El "por qué" importa: un operador que no encuentra un viaje en el mapa
   * tiene que poder leer si no se está monitoreando y por qué motivo.
   */
  async listar(tenantId: string) {
    return this.prisma.$queryRaw<
      { vehicle_id: string; plate: string | null; trip_id: string | null; motivo: string; desde: Date }[]
    >`
      SELECT a.vehicle_id::text, v.plate, a.trip_id::text, a.motivo, a.desde
      FROM motor_vehiculos_activos a
      JOIN vehicles v ON v.id = a.vehicle_id
      WHERE a.tenant_id = ${tenantId}::uuid
      ORDER BY a.desde DESC
    `;
  }
}
