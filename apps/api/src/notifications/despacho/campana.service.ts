import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccesoEntidadesService } from '../../common/access/acceso-entidades.service';
import { DespachoService } from './despacho.service';
import { AvisoDespacho, FuenteAviso, entraALaCampana, interrumpe } from './tipos-despacho';

/** Una fila de la unión de las dos fuentes. */
interface FilaPendiente {
  fuente: FuenteAviso;
  id: string;
  tenant_id: string;
  vehicle_id: string;
  trip_id: string | null;
  tipo: string;
  titulo: string | null;
  nivel_riesgo: string | null;
  color: string | null;
  interrumpe_al_operador: boolean | null;
  requiere_atencion_operador: boolean | null;
  ocurrio_at: Date;
  patente: string | null;
  latitud: number | null;
  longitud: number | null;
  direccion: string | null;
  disparador: string | null;
}

/** El tope de la lista. No es paginación: es un techo para que nadie la cuelgue. */
export const TOPE_PENDIENTES = 200;

/**
 * ══════════════════════════════════════════════════════════════════════════
 * LA CAMPANA — lo que el operador tiene sin atender
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ LA CAMPANA SE RECONSTRUYE DESDE LA BASE, SIEMPRE.
 *
 * Es la regla dura del encargo y define toda la forma de este servicio: el
 * flujo en vivo es un empujón, no la fuente de verdad. Si el navegador estaba
 * cerrado, se cortó la conexión o el operador recargó, al volver pide esta
 * lista y ve TODO lo pendiente. No hay una tabla de «notificaciones» que
 * pudiera quedar desincronizada de las alertas: la lista ES la consulta.
 *
 * ── Las DOS fuentes ───────────────────────────────────────────────────────
 *
 * Medido: son dos tablas con dos ciclos de vida distintos, y la campana
 * muestra las dos.
 *
 *   `trip_conditions` · lo que abre el motor desde la 3B.
 *        pendiente = `fin IS NULL AND atendida_at IS NULL`
 *        gravedad  = `nivel_riesgo`, del catálogo `motor_niveles_riesgo`
 *
 *   `event_logs` · geocercas y pánico, de la Tanda 5.
 *        pendiente = `status = 'open' AND acknowledged_at IS NULL`
 *        gravedad  = `severity`, un varchar SIN restricción: hoy el único
 *                    valor existente es `critical`
 *
 * ⚠️ NO SE COPIAN FILAS DE UNA A OTRA. Sería un tercer lugar donde el estado
 * puede desincronizarse, y las dos ya tienen su propio par de columnas de
 * atención (`atendida_por` / `acknowledged_by`). Se unen en la LECTURA.
 *
 * ⚠️ ATENDER NO ES RESOLVER, y en `event_logs` se nota. `AlertsService.
 * resolveAlert` —que ya existía— pone `status = 'resolved'`: eso es cerrar la
 * alerta desde la pantalla de alertas. Atender desde la campana sólo escribe
 * `acknowledged_by` y `acknowledged_at`: apaga el sonido y deja constancia de
 * quién se hizo cargo, sin declarar resuelto algo que puede seguir pasando.
 * Mezclarlas habría hecho que silenciar una alarma diera el hecho por cerrado.
 */
@Injectable()
export class CampanaService {
  private readonly logger = new Logger(CampanaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoEntidadesService,
    private readonly despacho: DespachoService,
  ) {}

  /**
   * Los vehículos que este usuario puede ver, o `null` si no tiene límite.
   *
   * Se expone porque el flujo en vivo necesita la MISMA decisión que la lista:
   * si se calcularan por separado, un operador restringido podría no ver una
   * alerta en la lista y escucharla igual. Una sola fuente para las dos.
   */
  async vehiculosVisibles(usuario: { id?: string; tenantId?: string; role?: string }) {
    return this.acceso.idsPermitidos(usuario, 'vehicles');
  }

  /** Todo lo pendiente de atención para este usuario. */
  async pendientes(usuario: {
    id?: string;
    tenantId?: string;
    role?: string;
  }): Promise<AvisoDespacho[]> {
    const tenantId = usuario?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Tu sesión no identifica un cliente.');
    }

    const vehiculos = await this.vehiculosVisibles(usuario);
    // ⚠️ Sin `null` en el arreglo enlazado. Un `uuid[]` nulo obliga a razonar
    // sobre tres estados en SQL; con un booleano aparte son dos, y el arreglo
    // vacío conserva su significado real: «no ve ninguno», que NO es «ve
    // todos». Ésa es la confusión que deja fugas de datos entre usuarios.
    const sinLimite = vehiculos === null;
    const permitidos = vehiculos ?? [];

    const filas = await this.prisma.$queryRaw<FilaPendiente[]>`
      SELECT
        'condicion'::text                AS fuente,
        c.id::text                       AS id,
        c.tenant_id::text                AS tenant_id,
        c.vehicle_id::text               AS vehicle_id,
        c.trip_id::text                  AS trip_id,
        c.tipo                           AS tipo,
        mt.nombre                        AS titulo,
        c.nivel_riesgo                   AS nivel_riesgo,
        nr.color                         AS color,
        nr.interrumpe_al_operador        AS interrumpe_al_operador,
        nr.requiere_atencion_operador    AS requiere_atencion_operador,
        c.inicio                         AS ocurrio_at,
        v.plate                          AS patente,
        NULL::float8                     AS latitud,
        NULL::float8                     AS longitud,
        NULL::text                       AS direccion,
        c.disparador                     AS disparador
      FROM trip_conditions c
      LEFT JOIN motor_tipos_condicion mt ON mt.codigo = c.tipo
      LEFT JOIN motor_niveles_riesgo  nr ON nr.codigo = c.nivel_riesgo
                                        AND (nr.tenant_id = c.tenant_id OR nr.tenant_id IS NULL)
      LEFT JOIN vehicles v ON v.id = c.vehicle_id
      WHERE c.tenant_id = ${tenantId}::uuid
        AND c.fin IS NULL
        AND c.atendida_at IS NULL
        AND (${sinLimite} OR c.vehicle_id = ANY(${permitidos}::uuid[]))
        -- Del catálogo: lo que no requiere atención del operador no entra a la
        -- campana. Es lo que deja afuera a PERNOCTE y CARGA_COMBUSTIBLE, que
        -- son estados declarados y no alertas. El coalesce a true es el fallo
        -- seguro: un nivel que no se pudo clasificar se muestra igual.
        AND coalesce(nr.requiere_atencion_operador, true)

      UNION ALL

      SELECT
        'evento'::text                   AS fuente,
        e.id::text                       AS id,
        e.tenant_id::text                AS tenant_id,
        e.vehicle_id::text               AS vehicle_id,
        e.trip_id::text                  AS trip_id,
        e.event_type                     AS tipo,
        NULL::varchar                    AS titulo,
        nr.codigo                        AS nivel_riesgo,
        nr.color                         AS color,
        nr.interrumpe_al_operador        AS interrumpe_al_operador,
        nr.requiere_atencion_operador    AS requiere_atencion_operador,
        e.triggered_at                   AS ocurrio_at,
        v.plate                          AS patente,
        e.latitude::float8               AS latitud,
        e.longitude::float8              AS longitud,
        e.address                        AS direccion,
        NULL::text                       AS disparador
      FROM event_logs e
      -- La traducción de severidad a nivel de riesgo vive en el CATÁLOGO y no
      -- acá: la columna motor_niveles_riesgo.severidad_evento. Si el join no
      -- encuentra nada, el aviso entra igual y sin clasificar.
      -- (Sin acentos graves en estos comentarios: cierran la plantilla.)
      LEFT JOIN motor_niveles_riesgo nr ON nr.severidad_evento = e.severity
                                       AND (nr.tenant_id = e.tenant_id OR nr.tenant_id IS NULL)
      LEFT JOIN vehicles v ON v.id = e.vehicle_id
      WHERE e.tenant_id = ${tenantId}::uuid
        AND e.status = 'open'
        AND e.acknowledged_at IS NULL
        AND (${sinLimite} OR e.vehicle_id = ANY(${permitidos}::uuid[]))

      ORDER BY ocurrio_at DESC
      LIMIT ${TOPE_PENDIENTES}
    `;

    return filas.map((f) => this.armar(f));
  }

  /**
   * Marcar una alerta como atendida por esta persona.
   *
   * ⚠️ LA CONDICIÓN DEL UPDATE ES LA QUE RESUELVE LA CARRERA. Si dos
   * operadores tocan «atender» al mismo tiempo, el `atendida_at IS NULL` del
   * WHERE hace que sólo uno escriba: el segundo afecta cero filas y recibe el
   * nombre del que llegó primero, en vez de pisarlo. Sin eso, el registro
   * diría que se hizo cargo el más lento.
   */
  async atender(
    usuario: { id?: string; tenantId?: string; role?: string },
    fuente: FuenteAviso,
    id: string,
    nota: string | null,
  ): Promise<{ atendida_por_nombre: string | null; atendida_at: Date; ya_estaba: boolean }> {
    const tenantId = usuario?.tenantId;
    const usuarioId = usuario?.id;
    if (!tenantId || !usuarioId) {
      throw new ForbiddenException('Tu sesión no identifica un usuario y un cliente.');
    }

    // El mismo límite que la lista: un operador no puede atender —ni enterarse
    // de— una alerta de un vehículo que no ve.
    const vehiculos = await this.vehiculosVisibles(usuario);
    const sinLimite = vehiculos === null;
    const permitidos = vehiculos ?? [];
    const ahora = new Date();

    const filas =
      fuente === 'condicion'
        ? await this.prisma.$executeRaw`
            UPDATE trip_conditions
               SET atendida_por = ${usuarioId}::uuid,
                   atendida_at  = ${ahora},
                   nota         = ${nota}
             WHERE id = ${id}::uuid
               AND tenant_id = ${tenantId}::uuid
               AND atendida_at IS NULL
               AND (${sinLimite} OR vehicle_id = ANY(${permitidos}::uuid[]))
          `
        : await this.prisma.$executeRaw`
            UPDATE event_logs
               SET acknowledged_by = ${usuarioId}::uuid,
                   acknowledged_at = ${ahora},
                   resolution_note = coalesce(${nota}, resolution_note)
             WHERE id = ${id}::uuid
               AND tenant_id = ${tenantId}::uuid
               AND acknowledged_at IS NULL
               AND (${sinLimite} OR vehicle_id = ANY(${permitidos}::uuid[]))
          `;

    const estado = await this.quienAtendio(fuente, tenantId, id);
    if (!estado) {
      throw new NotFoundException('La alerta no existe o no es visible para vos.');
    }

    // Se despacha SIEMPRE que haya alguien anotado, aunque esta llamada no
    // haya sido la que escribió: el que llegó segundo también tiene que ver su
    // pantalla apagarse, y las demás pantallas también.
    await this.despacho.despacharAtencion({
      fuente,
      id,
      tenant_id: tenantId,
      atendida_por: estado.atendida_por,
      atendida_por_nombre: estado.nombre,
      atendida_at: estado.atendida_at,
      nota,
    });

    if (filas === 0) {
      this.logger.log(
        `Atención duplicada sobre ${fuente} ${id}: ya la había atendido ${estado.nombre ?? estado.atendida_por}.`,
      );
    }

    return {
      atendida_por_nombre: estado.nombre,
      atendida_at: estado.atendida_at,
      ya_estaba: filas === 0,
    };
  }

  private async quienAtendio(
    fuente: FuenteAviso,
    tenantId: string,
    id: string,
  ): Promise<{ atendida_por: string; nombre: string | null; atendida_at: Date } | null> {
    const filas =
      fuente === 'condicion'
        ? await this.prisma.$queryRaw<
            { atendida_por: string | null; nombre: string | null; atendida_at: Date | null }[]
          >`
            SELECT c.atendida_por::text AS atendida_por, u.full_name AS nombre, c.atendida_at
            FROM trip_conditions c
            LEFT JOIN users u ON u.id = c.atendida_por
            WHERE c.id = ${id}::uuid AND c.tenant_id = ${tenantId}::uuid
          `
        : await this.prisma.$queryRaw<
            { atendida_por: string | null; nombre: string | null; atendida_at: Date | null }[]
          >`
            SELECT e.acknowledged_by::text AS atendida_por, u.full_name AS nombre,
                   e.acknowledged_at AS atendida_at
            FROM event_logs e
            LEFT JOIN users u ON u.id = e.acknowledged_by
            WHERE e.id = ${id}::uuid AND e.tenant_id = ${tenantId}::uuid
          `;

    const f = filas[0];
    if (!f || !f.atendida_por || !f.atendida_at) return null;
    return { atendida_por: f.atendida_por, nombre: f.nombre, atendida_at: f.atendida_at };
  }

  private armar(f: FilaPendiente): AvisoDespacho {
    const nivel =
      f.interrumpe_al_operador === null || f.requiere_atencion_operador === null
        ? null
        : {
            interrumpe_al_operador: f.interrumpe_al_operador,
            requiere_atencion_operador: f.requiere_atencion_operador,
          };

    return {
      fuente: f.fuente,
      id: f.id,
      tenant_id: f.tenant_id,
      vehicle_id: f.vehicle_id,
      trip_id: f.trip_id,
      tipo: f.tipo,
      titulo: f.titulo ?? f.tipo,
      nivel_riesgo: f.nivel_riesgo,
      color: f.color ?? '#6B7280',
      interrumpe: interrumpe(nivel),
      requiere_atencion: entraALaCampana(nivel),
      clasificado: nivel !== null,
      ocurrio_at: f.ocurrio_at,
      patente: f.patente,
      latitud: f.latitud === null ? null : Number(f.latitud),
      longitud: f.longitud === null ? null : Number(f.longitud),
      direccion: f.direccion,
      disparador: f.disparador,
    };
  }
}
