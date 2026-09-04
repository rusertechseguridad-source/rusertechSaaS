import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertTenantOwnership } from '../common/tenant/tenant-scope';

export interface ResultadoSincronizacion {
  activados_por_estado: number;
  activados_por_red_seguridad: number;
  desactivados: number;
  /**
   * Cuántos vehículos quedan monitoreados y por qué motivo, DESPUÉS de correr.
   *
   * No es lo mismo que los tres números de arriba: esos son el delta de esta
   * corrida, esto es el estado. Ver el comentario de `sincronizar`.
   */
  total_monitoreados: number;
  por_motivo: Record<string, number>;
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
   *
   * ⚠️ QUÉ CUENTAN LOS TRES NÚMEROS (y por qué la línea del log mentía).
   *
   * `porEstado`, `porRed` y `bajas` son filas afectadas por ESTA corrida: un
   * delta, no un total. Las activaciones manuales no pasan por acá —las hace
   * `activarManual` desde el controlador— así que nunca aparecían en la línea.
   * Y hay algo peor: el `DO UPDATE` del paso 1 lleva
   * `WHERE motor_vehiculos_activos.motivo <> 'manual'` para no pisar la
   * decisión de un operador, así que un vehículo activado a mano que ADEMÁS
   * tiene un viaje monitoreable no actualiza ninguna fila y tampoco suma en
   * `porEstado`. O sea que activar un vehículo a mano BAJABA el número que
   * mostraba el log.
   *
   * "4 por estado, 0 por red de seguridad, 0 bajas" se lee como "hay 4
   * vehículos monitoreados", y no es eso lo que dice. Por eso ahora la línea
   * lleva también el estado resultante, desglosado por motivo: una consulta
   * más sobre una tabla que por diseño tiene una fila por viaje activo.
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

    // ── 4. Estado resultante ────────────────────────────────────────────────
    // El recuento va DESPUÉS de los tres pasos, sobre la tabla ya sincronizada.
    // Incluye los `manual`, que es justamente lo que faltaba.
    const conteo = await this.prisma.$queryRaw<{ motivo: string; total: bigint }[]>`
      SELECT motivo, count(*) AS total
      FROM motor_vehiculos_activos
      GROUP BY motivo
      ORDER BY motivo
    `;

    // `count(*)` viene como BigInt y `BigInt + number` explota en runtime.
    const porMotivo: Record<string, number> = {};
    for (const fila of conteo) porMotivo[fila.motivo] = Number(fila.total);
    const totalMonitoreados = Object.values(porMotivo).reduce((a, b) => a + b, 0);

    if (porEstado + porRed + bajas > 0) {
      const desglose = Object.entries(porMotivo)
        .map(([motivo, total]) => `${total} ${motivo}`)
        .join(', ');
      this.logger.log(
        `Monitoreo sincronizado: +${porEstado} por estado, +${porRed} por red de seguridad, ` +
          `-${bajas} bajas · quedan ${totalMonitoreados} monitoreados` +
          (desglose ? ` (${desglose})` : ''),
      );
    }

    return {
      activados_por_estado: porEstado,
      activados_por_red_seguridad: porRed,
      desactivados: bajas,
      total_monitoreados: totalMonitoreados,
      por_motivo: porMotivo,
    };
  }

  /** Activación manual por un operador. Sobrevive a la sincronización. */
  async activarManual(vehicleId: string, tenantId: string, tripId: string | null): Promise<void> {
    // Dos agujeros en la misma sentencia, y los dos por lo mismo: nadie
    // comprobaba de quién era el vehículo.
    //
    //   1. Sin esta verificación, se activaba el monitoreo de un vehículo de
    //      OTRO cliente insertando una fila con el tenant del solicitante.
    //   2. El `ON CONFLICT (vehicle_id)` tiene la PK en el vehículo, no en el
    //      par (vehículo, tenant): si el vehículo del otro cliente YA estaba
    //      monitoreado, el `DO UPDATE` le pisaba `motivo` y `trip_id`.
    //
    // `desactivar`, cuatro líneas más abajo, sí filtraba por tenant. La pareja
    // estaba asimétrica.
    await assertTenantOwnership(this.prisma.vehicle, vehicleId, tenantId, 'Vehículo');

    const filas = await this.prisma.$executeRaw`
      INSERT INTO motor_vehiculos_activos (vehicle_id, tenant_id, trip_id, motivo, desde)
      VALUES (${vehicleId}::uuid, ${tenantId}::uuid, ${tripId}::uuid, 'manual', now())
      ON CONFLICT (vehicle_id) DO UPDATE SET
        motivo  = 'manual',
        trip_id = EXCLUDED.trip_id
      WHERE motor_vehiculos_activos.tenant_id = ${tenantId}::uuid
    `;

    // Una activación manual no pasa por `sincronizar`, así que hasta ahora no
    // dejaba NINGÚN rastro en el log: el operador activaba un vehículo y el
    // sistema no decía nada. Deja el suyo.
    this.logger.log(
      `Monitoreo activado a mano: vehículo ${vehicleId} (viaje ${tripId ?? 'sin viaje'}), ` +
        `${filas} fila(s) afectada(s).`,
    );
  }

  /** Baja manual. */
  async desactivar(vehicleId: string, tenantId: string): Promise<void> {
    const filas = await this.prisma.$executeRaw`
      DELETE FROM motor_vehiculos_activos
      WHERE vehicle_id = ${vehicleId}::uuid AND tenant_id = ${tenantId}::uuid
    `;

    // `0` acá no es un error: puede que el vehículo ya no estuviera
    // monitoreado. Pero tiene que poder distinguirse de una baja efectiva.
    this.logger.log(`Monitoreo dado de baja: vehículo ${vehicleId}, ${filas} fila(s) borrada(s).`);
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
