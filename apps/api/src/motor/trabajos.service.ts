import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeocodingService } from '../telemetry/geocoding.service';

const INTENTOS_MAXIMOS = 5;
const ARRENDAMIENTO_MINUTOS = 10;

interface FilaTrabajo {
  id: string;
  tipo: string;
  tenant_id: string;
  trip_id: string | null;
}

/**
 * TRABAJOS DEL MOTOR — hoy, un solo tipo: calcular el resumen al cerrar un viaje.
 *
 * Los llena el trigger `trg_motor_viaje_cerrado`, que ve los cierres de los DOS
 * backends: el SaaS y la Mobile API escriben `trips.status` cada uno por su
 * lado, y si el cálculo se disparara desde el código del SaaS, los viajes
 * cerrados desde la app quedarían sin resumen. Es la misma doctrina que la cola
 * de telemetría, aplicada al cierre.
 */
@Injectable()
export class TrabajosService {
  private readonly logger = new Logger(TrabajosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geocoding: GeocodingService,
  ) {}

  /** Toma y procesa los trabajos pendientes. Lo llama la vuelta del worker. */
  async procesarPendientes(workerId: string): Promise<number> {
    const trabajos: FilaTrabajo[] = await this.prisma.$queryRaw<FilaTrabajo[]>`
      WITH tomados AS (
        SELECT id FROM motor_trabajos
        WHERE estado = 'pendiente'
           OR (estado = 'procesando'
               AND tomado_at < now() - (${ARRENDAMIENTO_MINUTOS} || ' minutes')::interval)
        ORDER BY created_at
        LIMIT 10
        FOR UPDATE SKIP LOCKED
      )
      UPDATE motor_trabajos t
      SET estado = 'procesando', tomado_at = now(), tomado_por = ${workerId},
          intentos = t.intentos + 1
      FROM tomados
      WHERE t.id = tomados.id
      RETURNING t.id::text, t.tipo, t.tenant_id::text, t.trip_id::text
    `;

    let procesados = 0;
    for (const trabajo of trabajos) {
      try {
        await this.ejecutar(trabajo);
        await this.prisma.$executeRaw`
          UPDATE motor_trabajos SET estado = 'listo', error = null
          WHERE id = ${BigInt(trabajo.id)}::bigint
        `;
        procesados++;
      } catch (error) {
        const mensaje = (error as Error).message;
        this.logger.error(`Trabajo ${trabajo.tipo} del viaje ${trabajo.trip_id}: ${mensaje}`);
        await this.prisma.$executeRaw`
          UPDATE motor_trabajos
          SET estado = CASE WHEN intentos >= ${INTENTOS_MAXIMOS} THEN 'fallido' ELSE 'pendiente' END,
              error = ${mensaje.slice(0, 2000)}, tomado_at = null, tomado_por = null
          WHERE id = ${BigInt(trabajo.id)}::bigint
        `;
      }
    }
    return procesados;
  }

  private async ejecutar(trabajo: FilaTrabajo): Promise<void> {
    if (trabajo.tipo !== 'calcular_resumen' || !trabajo.trip_id) return;

    // Las dos funciones de la base hacen el trabajo pesado. Van en este orden:
    // el resumen congela el rango de sensores, y las series lo usan igual desde
    // la misma cascada — el orden no cambia el resultado, pero el resumen es lo
    // que consulta la pantalla y conviene que exista primero.
    await this.prisma.$executeRaw`
      SELECT fn_calcular_trip_summary(${trabajo.trip_id}::uuid)
    `;
    await this.prisma.$executeRaw`
      SELECT fn_calcular_series_sensores(${trabajo.trip_id}::uuid)
    `;

    // La dirección de cada excursión se resuelve ACÁ, al calcular — nunca al
    // imprimir. Un informe reimpreso al año no puede depender de que el
    // servicio de geocodificación siga existiendo.
    await this.geocodificarExcursiones(trabajo.trip_id);

    this.logger.log(`Resumen calculado para el viaje ${trabajo.trip_id}.`);
  }

  /**
   * Completa `direccion` en las excursiones que tienen coordenadas y no
   * dirección. Reusa GeocodingService (Photon con caída a Nominatim, caché en
   * Redis cuando hay).
   *
   * Ritmo acotado: 1 llamada por segundo — el límite de Nominatim. Son pocas
   * por viaje (una por excursión), así que la pausa no molesta; con muchas, el
   * cierre tarda unos segundos más y nadie lo nota.
   *
   * Si el servicio falla, la fila queda con coordenadas y sin dirección: el
   * dato duro está, la comodidad no. El informe muestra las coordenadas.
   */
  private async geocodificarExcursiones(tripId: string): Promise<void> {
    const pendientes: { id: string; latitude: number; longitude: number }[] =
      await this.prisma.$queryRaw<{ id: string; latitude: number; longitude: number }[]>`
        SELECT id::text, latitude, longitude
        FROM trip_sensor_excursions
        WHERE trip_id = ${tripId}::uuid
          AND latitude IS NOT NULL
          AND direccion IS NULL
      `;

    for (let i = 0; i < pendientes.length; i++) {
      const e = pendientes[i];
      try {
        const direccion = await this.geocoding.reverseGeocode(
          Number(e.latitude),
          Number(e.longitude),
        );
        if (direccion) {
          await this.prisma.$executeRaw`
            UPDATE trip_sensor_excursions SET direccion = ${direccion}
            WHERE id = ${e.id}::uuid
          `;
        }
      } catch (error) {
        this.logger.warn(
          `Geocodificación de la excursión ${e.id}: ${(error as Error).message}`,
        );
      }
      if (i < pendientes.length - 1) {
        await new Promise((r) => setTimeout(r, 1100));
      }
    }
  }

  /**
   * Recalcular a demanda, desde la pantalla del viaje.
   * Encola en vez de ejecutar en línea: mismo camino, mismos reintentos.
   */
  async encolarRecalculo(tripId: string, tenantId: string): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO motor_trabajos (tipo, tenant_id, trip_id)
      VALUES ('calcular_resumen', ${tenantId}::uuid, ${tripId}::uuid)
      ON CONFLICT (tipo, trip_id) WHERE estado IN ('pendiente','procesando') DO NOTHING
    `;
  }
}
