import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  derivarEstadoSeguimiento,
  huboCambio,
  validarDeclaracionManual,
  validarLevantar,
  type IntentoDeclaracion,
} from './estado-seguimiento';
import type {
  CondicionAbierta,
  EntradaSeguimiento,
  EstadoSeguimiento,
  Veredicto,
} from './tipos-seguimiento';

/**
 * EL ESTADO DE SEGUIMIENTO — la capa que toca la base.
 *
 * La decisión de QUÉ estado corresponde vive en `estado-seguimiento.ts`, que es
 * puro. Acá se lee, se persiste, y nada más. Es la separación que el proyecto
 * pide y la que permite probar las reglas sin Postgres.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * LA REGLA QUE GOBIERNA ESTE ARCHIVO
 * ══════════════════════════════════════════════════════════════════════════
 *
 * **El estado se REGISTRA, no se calcula al vuelo.** Un viaje que pasó por
 * `SIN_REPORTE` y volvió a estar en recorrido no es lo mismo que uno que nunca
 * lo perdió, y el operador tiene que poder verlo.
 *
 * Por eso cada cambio escribe DOS cosas en UNA transacción:
 *
 *   · `trip_state_history`  — la transición, con qué la causó
 *   · `trip_tracking_state` — el estado vigente, para no recorrer el historial
 *
 * ⚠️ Si el historial no se puede escribir, el estado vigente TAMPOCO cambia.
 * Es la misma garantía que `transiciones.service.ts` ya da para el ciclo de
 * vida, y por el mismo motivo: un cambio de estado sin registro es un cambio
 * que nadie puede auditar.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * LAS DOS FECHAS
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   `created_at`   CUÁNDO OCURRIÓ  — el momento del hecho
 *   `recibido_at`  CUÁNDO SE SUPO  — cuándo llegó el dato que lo provocó
 *
 * No son la misma. Un teléfono que sincroniza datos viejos provoca una
 * transición con `created_at` de hace dos horas y `recibido_at` de ahora, y esa
 * diferencia cambia lo que el operador tiene que hacer.
 */

/** Una fila del historial, tal como la ve el operador. */
export interface FilaHistorial {
  estado_anterior: string | null;
  estado_nuevo: string;
  disparado_por: string;
  causa_detalle: string | null;
  automatico: boolean;
  aplicada: boolean;
  motivo_rechazo: string | null;
  created_at: Date;
  recibido_at: Date;
}

@Injectable()
export class SeguimientoService {
  private readonly logger = new Logger(SeguimientoService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ════════════════════════════════════════════════════════════════════════
  // LECTURA
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Todo lo que hace falta para derivar el estado de un viaje.
   *
   * ⚠️ Cuatro consultas y no una con joins: cada una responde una pregunta
   * distinta y las cuatro son por clave o por índice. Una sola con cuatro
   * `LEFT JOIN` multiplicaría filas y obligaría a desduplicar en memoria, que
   * es donde se cuelan los errores de conteo.
   */
  async entradaDeViaje(tripId: string, tenantId: string): Promise<EntradaSeguimiento> {
    const etapas = await this.prisma.$queryRaw<
      { codigo: string; es_terminal: boolean; desde: Date }[]
    >`
      SELECT t.status                       AS codigo,
             coalesce(e.es_terminal, false) AS es_terminal,
             -- Desde cuándo está en esta etapa: la última transición de CICLO
             -- DE VIDA, y si nunca hubo ninguna, cuándo se tocó el viaje.
             coalesce(
               (SELECT max(h.created_at) FROM trip_state_history h
                 WHERE h.trip_id = t.id AND h.dimension = 'ciclo_vida' AND h.aplicada),
               t.updated_at, t.created_at
             )                              AS desde
      FROM trips t
      LEFT JOIN motor_estados_viaje e ON e.codigo = t.status
      WHERE t.id = ${tripId}::uuid AND t.tenant_id = ${tenantId}::uuid
    `;
    if (etapas.length === 0) {
      throw new NotFoundException('El viaje no existe o no pertenece a este cliente.');
    }

    const condiciones = await this.condicionesAbiertas(tripId, tenantId);
    const declaracion = await this.declaracionVigente(tripId, tenantId);
    const riesgoNeutro = await this.riesgoNeutro(tenantId);

    return {
      etapa: {
        codigo: etapas[0].codigo,
        esTerminal: etapas[0].es_terminal,
        desde: etapas[0].desde,
      },
      condicionesAbiertas: condiciones,
      declaracion,
      riesgoNeutro,
    };
  }

  /**
   * Las condiciones abiertas del viaje — `fin` en null.
   *
   * ⚠️ El `LEFT JOIN LATERAL` sobre `motor_niveles_riesgo` no es adorno: ese
   * catálogo es HÍBRIDO. Las cuatro filas de la doctrina son globales
   * (`tenant_id is null`) y un cliente puede agregar niveles propios encima. El
   * `ORDER BY ... NULLS LAST` hace que gane el del tenant si lo tiene, y el
   * `LIMIT 1` impide que el join duplique la condición cuando existen los dos.
   */
  private async condicionesAbiertas(
    tripId: string,
    tenantId: string,
  ): Promise<CondicionAbierta[]> {
    const filas = await this.prisma.$queryRaw<
      {
        id: string;
        tipo: string;
        riesgo: string;
        orden_riesgo: number;
        resolucion_manual: boolean;
        inicio: Date;
      }[]
    >`
      SELECT c.id::text                       AS id,
             c.tipo                           AS tipo,
             c.nivel_riesgo                   AS riesgo,
             coalesce(r.orden, 0)::int        AS orden_riesgo,
             -- ⚠️ EL DEFECTO QUE MÁS CERCA ESTUVO DE PASAR. Acá se comparaba
             -- la resolución contra la palabra "manual", y el catálogo real NO
             -- USA ESA PALABRA: sus valores son "automatico" y "operador". La
             -- comparación daba SIEMPRE false, así que ninguna condición era
             -- pegajosa y la regla de «el pánico gana siempre» estaba muerta
             -- —en silencio, con las 29 pruebas en verde, porque las pruebas
             -- puras reciben el booleano ya resuelto por esta consulta.
             --
             -- Se invierte la pregunta a propósito: PEGAJOSA salvo que se
             -- demuestre que el motor la cierra solo. El IS DISTINCT FROM
             -- incluye el NULL y cualquier valor futuro del vocabulario.
             --
             -- El fallo seguro va hacia el lado correcto: equivocarse por
             -- pegajosa deja un estado visible de más; equivocarse por lo otro
             -- HACE DESAPARECER UN PÁNICO. Un valor nuevo en el catálogo no
             -- puede apagar la regla sin que nadie se entere.
             --
             -- (Sin comillas invertidas en este comentario: está DENTRO de un
             -- template literal, y ahí ese carácter cierra la plantilla. Pasó
             -- dos veces en esta etapa y tira veinte errores de tipos.)
             (mt.resolucion IS DISTINCT FROM 'automatico') AS resolucion_manual,
             c.inicio                         AS inicio
      FROM trip_conditions c
      LEFT JOIN motor_tipos_condicion mt ON mt.codigo = c.tipo
      LEFT JOIN LATERAL (
        SELECT nr.orden FROM motor_niveles_riesgo nr
        WHERE nr.codigo = c.nivel_riesgo
          AND (nr.tenant_id = c.tenant_id OR nr.tenant_id IS NULL)
        ORDER BY nr.tenant_id NULLS LAST
        LIMIT 1
      ) r ON true
      WHERE c.trip_id = ${tripId}::uuid
        AND c.tenant_id = ${tenantId}::uuid
        AND c.fin IS NULL
      ORDER BY c.inicio
    `;

    return filas.map((f) => ({
      id: f.id,
      tipo: f.tipo,
      riesgo: f.riesgo,
      ordenRiesgo: Number(f.orden_riesgo),
      resolucionManual: f.resolucion_manual === true,
      inicio: f.inicio,
    }));
  }

  /** La declaración manual vigente, si el estado actual es manual. */
  private async declaracionVigente(tripId: string, tenantId: string) {
    const filas = await this.prisma.$queryRaw<
      {
        estado: string;
        riesgo: string;
        orden_riesgo: number;
        declarado_por: string;
        vigente_desde: Date;
        nota: string | null;
      }[]
    >`
      SELECT s.estado, s.riesgo, coalesce(r.orden, 0)::int AS orden_riesgo,
             s.declarado_por::text AS declarado_por, s.vigente_desde, s.nota
      FROM trip_tracking_state s
      LEFT JOIN LATERAL (
        SELECT nr.orden FROM motor_niveles_riesgo nr
        WHERE nr.codigo = s.riesgo
          AND (nr.tenant_id = s.tenant_id OR nr.tenant_id IS NULL)
        ORDER BY nr.tenant_id NULLS LAST
        LIMIT 1
      ) r ON true
      WHERE s.trip_id = ${tripId}::uuid
        AND s.tenant_id = ${tenantId}::uuid
        AND s.origen = 'manual'
    `;
    if (filas.length === 0) return null;
    const f = filas[0];
    return {
      tipo: f.estado,
      riesgo: f.riesgo,
      ordenRiesgo: Number(f.orden_riesgo),
      declaradoPor: f.declarado_por,
      desde: f.vigente_desde,
      nota: f.nota,
    };
  }

  /**
   * El nivel de riesgo que corresponde cuando no pasa nada: el de menor orden.
   *
   * ⚠️ Se consulta en vez de escribirse. La alternativa era una constante
   * `'panorama_normal'`, y sería una suposición sobre el catálogo escrita en el
   * código — exactamente lo que esta etapa vino a no hacer.
   */
  private async riesgoNeutro(tenantId: string) {
    const filas = await this.prisma.$queryRaw<{ codigo: string; orden: number }[]>`
      SELECT codigo, orden::int AS orden
      FROM motor_niveles_riesgo
      WHERE is_active AND (tenant_id = ${tenantId}::uuid OR tenant_id IS NULL)
      ORDER BY orden ASC, tenant_id NULLS LAST
      LIMIT 1
    `;
    if (filas.length === 0) {
      // Sin catálogo de riesgo no se puede clasificar nada. Es preferible
      // fallar acá y ruidosamente a inventar un nivel que no existe y escribir
      // una FK rota.
      throw new NotFoundException(
        'El catálogo motor_niveles_riesgo está vacío: no se puede derivar el estado de seguimiento.',
      );
    }
    return { codigo: filas[0].codigo, orden: Number(filas[0].orden) };
  }

  /** El estado vigente, sin recorrer el historial. */
  async estadoActual(tripId: string, tenantId: string) {
    const filas = await this.prisma.$queryRaw<any[]>`
      SELECT s.estado, s.estado_origen, s.riesgo, s.origen,
             s.condicion_id::text AS condicion_id,
             s.declarado_por::text AS declarado_por, s.nota,
             s.vigente_desde, s.actualizado_at,
             -- El COLOR sale del catálogo que corresponda, no de la fila: si
             -- mañana cambia el color de un nivel de riesgo, cambia en todos
             -- lados sin migrar una sola fila.
             coalesce(nr.color, ev.color) AS color,
             coalesce(mt.nombre, ev.nombre) AS nombre
      FROM trip_tracking_state s
      LEFT JOIN motor_niveles_riesgo nr
             ON nr.codigo = s.riesgo AND nr.tenant_id IS NULL
      LEFT JOIN motor_tipos_condicion mt
             ON mt.codigo = s.estado AND s.estado_origen = 'condicion'
      LEFT JOIN motor_estados_viaje ev
             ON ev.codigo = s.estado AND s.estado_origen = 'ciclo_vida'
      WHERE s.trip_id = ${tripId}::uuid AND s.tenant_id = ${tenantId}::uuid
    `;
    return filas[0] ?? null;
  }

  /**
   * La línea de tiempo del seguimiento, con los intentos rechazados incluidos.
   *
   * ⚠️ Los rechazos NO se filtran. «El motor quiso pasar a X y no pudo porque
   * Y» es parte de la historia del viaje: esconderlo deja al operador sin saber
   * por qué el estado no cambió.
   */
  async historial(tripId: string, tenantId: string, limite = 200): Promise<FilaHistorial[]> {
    return this.prisma.$queryRaw<FilaHistorial[]>`
      SELECT estado_anterior, estado_nuevo, disparado_por, causa_detalle,
             automatico, aplicada, motivo_rechazo, created_at, recibido_at
      FROM trip_state_history
      WHERE trip_id = ${tripId}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND dimension = 'seguimiento'
      ORDER BY created_at DESC
      LIMIT ${limite}
    `;
  }

  // ════════════════════════════════════════════════════════════════════════
  // ESCRITURA
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Recalcula el estado deducido y lo persiste SI cambió.
   *
   * `ahora` entra por parámetro: es la fecha de RECEPCIÓN. Quien llama sabe si
   * el punto acaba de llegar o si es un dato viejo que se sincronizó tarde.
   */
  async recalcular(tripId: string, tenantId: string, ahora: Date): Promise<EstadoSeguimiento> {
    const entrada = await this.entradaDeViaje(tripId, tenantId);
    const nuevo = derivarEstadoSeguimiento(entrada);
    const anterior = await this.estadoVigenteComoObjeto(tripId, tenantId);

    if (!huboCambio(anterior, nuevo)) return nuevo;

    await this.persistir(tripId, tenantId, anterior, nuevo, {
      disparadoPor: 'motor',
      automatico: true,
      recibidoAt: ahora,
      declaradoPor: null,
      nota: null,
    });
    return nuevo;
  }

  /**
   * Un operador declara un estado a mano.
   *
   * ⚠️ Si la máquina lo rechaza, el intento SE REGISTRA IGUAL con su motivo, y
   * recién después se le avisa a quien llamó. Es la exigencia de la etapa: una
   * transición inválida no se descarta en silencio.
   */
  async declarar(
    tripId: string,
    tenantId: string,
    tipo: string,
    nota: string | null,
    usuarioId: string,
    ahora: Date,
  ): Promise<{ veredicto: Veredicto; estado: EstadoSeguimiento | null }> {
    const entrada = await this.entradaDeViaje(tripId, tenantId);
    const intento = await this.intentoDesdeCatalogo(tipo, tenantId);
    const veredicto = validarDeclaracionManual(intento, entrada);
    const anterior = await this.estadoVigenteComoObjeto(tripId, tenantId);

    if (!veredicto.valida) {
      await this.registrarRechazo(tripId, tenantId, anterior, tipo, veredicto, usuarioId, ahora);
      return { veredicto, estado: null };
    }

    const conDeclaracion: EntradaSeguimiento = {
      ...entrada,
      declaracion: {
        tipo,
        riesgo: intento.riesgo,
        ordenRiesgo: intento.ordenRiesgo,
        declaradoPor: usuarioId,
        desde: ahora,
        nota,
      },
    };
    const nuevo = derivarEstadoSeguimiento(conDeclaracion);

    await this.persistir(tripId, tenantId, anterior, nuevo, {
      disparadoPor: 'operador',
      automatico: false,
      recibidoAt: ahora,
      declaradoPor: usuarioId,
      nota,
    });
    return { veredicto, estado: nuevo };
  }

  /** El operador levanta su declaración: el estado vuelve a ser el deducido. */
  async levantar(
    tripId: string,
    tenantId: string,
    usuarioId: string,
    ahora: Date,
  ): Promise<{ veredicto: Veredicto; estado: EstadoSeguimiento | null }> {
    const entrada = await this.entradaDeViaje(tripId, tenantId);
    const veredicto = validarLevantar(entrada);
    const anterior = await this.estadoVigenteComoObjeto(tripId, tenantId);

    if (!veredicto.valida) {
      await this.registrarRechazo(
        tripId, tenantId, anterior, anterior?.estado ?? '(ninguno)', veredicto, usuarioId, ahora,
      );
      return { veredicto, estado: null };
    }

    const nuevo = derivarEstadoSeguimiento({ ...entrada, declaracion: null });
    await this.persistir(tripId, tenantId, anterior, nuevo, {
      disparadoPor: 'operador',
      automatico: false,
      recibidoAt: ahora,
      declaradoPor: null,
      nota: null,
    });
    return { veredicto, estado: nuevo };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Lo privado
  // ════════════════════════════════════════════════════════════════════════

  /** El estado vigente en la forma que entiende la parte pura. */
  private async estadoVigenteComoObjeto(
    tripId: string,
    tenantId: string,
  ): Promise<EstadoSeguimiento | null> {
    const fila = await this.estadoActual(tripId, tenantId);
    if (!fila) return null;
    return {
      estado: fila.estado,
      estadoOrigen: fila.estado_origen,
      riesgo: fila.riesgo,
      ordenRiesgo: 0, // No hace falta para comparar: `huboCambio` mira códigos.
      origen: fila.origen,
      condicionId: fila.condicion_id ?? null,
      vigenteDesde: fila.vigente_desde,
      motivo: '',
    };
  }

  /** Lo que el catálogo dice del código que se quiere declarar. */
  private async intentoDesdeCatalogo(
    tipo: string,
    tenantId: string,
  ): Promise<IntentoDeclaracion & { riesgo: string }> {
    const filas = await this.prisma.$queryRaw<
      {
        codigo: string;
        riesgo_default: string;
        orden: number;
        declarable: boolean;
        activo: boolean;
      }[]
    >`
      SELECT mt.codigo, mt.riesgo_default,
             coalesce(r.orden, 0)::int      AS orden,
             mt.declarable_por_operador     AS declarable,
             mt.is_active                   AS activo
      FROM motor_tipos_condicion mt
      LEFT JOIN LATERAL (
        SELECT nr.orden FROM motor_niveles_riesgo nr
        WHERE nr.codigo = mt.riesgo_default
          AND (nr.tenant_id = ${tenantId}::uuid OR nr.tenant_id IS NULL)
        ORDER BY nr.tenant_id NULLS LAST
        LIMIT 1
      ) r ON true
      WHERE mt.codigo = ${tipo}
    `;

    if (filas.length === 0) {
      return {
        tipo, ordenRiesgo: 0, declarablePorOperador: false, activoEnCatalogo: false, riesgo: '',
      };
    }
    const f = filas[0];
    return {
      tipo,
      ordenRiesgo: Number(f.orden),
      declarablePorOperador: f.declarable === true,
      activoEnCatalogo: f.activo === true,
      riesgo: f.riesgo_default,
    };
  }

  /**
   * Escribe la transición Y el estado vigente, en UNA transacción.
   *
   * ⚠️ EL ORDEN IMPORTA Y NO ES CASUAL: primero el historial, después el estado
   * vigente. Si fuera al revés y la transacción fallara en el medio, quedaría
   * un estado sin registro de cómo llegó ahí — que es exactamente lo que la
   * etapa prohíbe. Al estar las dos en la misma transacción, o están las dos o
   * no está ninguna.
   */
  private async persistir(
    tripId: string,
    tenantId: string,
    anterior: EstadoSeguimiento | null,
    nuevo: EstadoSeguimiento,
    meta: {
      disparadoPor: string;
      automatico: boolean;
      recibidoAt: Date;
      declaradoPor: string | null;
      nota: string | null;
    },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`
        INSERT INTO trip_state_history (
          tenant_id, trip_id, dimension, estado_anterior, estado_nuevo,
          disparado_por, causa_id, causa_detalle, automatico,
          aplicada, created_at, recibido_at
        ) VALUES (
          ${tenantId}::uuid, ${tripId}::uuid, 'seguimiento',
          ${anterior?.estado ?? null}, ${nuevo.estado},
          ${meta.disparadoPor}, ${nuevo.condicionId}::uuid, ${nuevo.motivo}, ${meta.automatico},
          true, ${nuevo.vigenteDesde}, ${meta.recibidoAt}
        )
      `;

      await tx.$executeRaw`
        INSERT INTO trip_tracking_state (
          trip_id, tenant_id, estado, estado_origen, riesgo, origen,
          condicion_id, declarado_por, nota, vigente_desde, actualizado_at
        ) VALUES (
          ${tripId}::uuid, ${tenantId}::uuid, ${nuevo.estado}, ${nuevo.estadoOrigen},
          ${nuevo.riesgo}, ${nuevo.origen}, ${nuevo.condicionId}::uuid,
          ${meta.declaradoPor}::uuid, ${meta.nota}, ${nuevo.vigenteDesde}, ${meta.recibidoAt}
        )
        ON CONFLICT (trip_id) DO UPDATE SET
          estado = excluded.estado, estado_origen = excluded.estado_origen,
          riesgo = excluded.riesgo, origen = excluded.origen,
          condicion_id = excluded.condicion_id, declarado_por = excluded.declarado_por,
          nota = excluded.nota, vigente_desde = excluded.vigente_desde,
          actualizado_at = excluded.actualizado_at
      `;
    });

    this.logger.log(
      `Viaje ${tripId}: seguimiento ${anterior?.estado ?? '(ninguno)'} → ${nuevo.estado} ` +
        `(${meta.disparadoPor}) · ${nuevo.motivo}`,
    );
  }

  /**
   * Un intento que la máquina rechazó.
   *
   * ⚠️ La fila lleva `aplicada = false` y el motivo. El CHECK
   * `trip_state_history_rechazo_check` no deja escribir un rechazo sin motivo,
   * así que el silencio está prohibido por la base y no sólo por este código.
   */
  private async registrarRechazo(
    tripId: string,
    tenantId: string,
    anterior: EstadoSeguimiento | null,
    intentado: string,
    veredicto: Veredicto,
    usuarioId: string,
    ahora: Date,
  ): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO trip_state_history (
        tenant_id, trip_id, dimension, estado_anterior, estado_nuevo,
        disparado_por, causa_detalle, automatico,
        aplicada, motivo_rechazo, created_at, recibido_at
      ) VALUES (
        ${tenantId}::uuid, ${tripId}::uuid, 'seguimiento',
        ${anterior?.estado ?? null}, ${intentado},
        'operador', ${`Intento de ${usuarioId}`}, false,
        false, ${veredicto.motivo ?? 'sin motivo'}, ${ahora}, ${ahora}
      )
    `;
    this.logger.warn(
      `Viaje ${tripId}: se RECHAZÓ el estado "${intentado}" — ${veredicto.motivo}`,
    );
  }
}
