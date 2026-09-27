import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProtocoloService } from './protocolo.service';
import type { FuenteAviso } from '../despacho/tipos-despacho';
import {
  AccionBitacora,
  DestinoDeEscalada,
  EntradaBitacora,
  habilitaEscalada,
  puedeCerrar,
  registroDiceAlgo,
} from './tipos-atencion';

/** Lo mínimo que hace falta para escribir: el Prisma real o una transacción. */
export interface ClienteEscritura {
  $executeRaw(strings: TemplateStringsArray, ...valores: unknown[]): Promise<number>;
}

/** Lo que el operador manda al registrar una entrada. */
export interface EntradaNueva {
  paso_id?: string | null;
  resultado_codigo?: string | null;
  nota?: string | null;
}

/**
 * ══════════════════════════════════════════════════════════════════════════
 * LA BITÁCORA — el hilo de atención de una alerta
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Antes de esto, atender una alerta la silenciaba y dejaba un nombre. Para un
 * producto de custodia no alcanza: cuando al otro día el cliente pregunta por
 * qué nadie hizo nada durante cuarenta minutos, un nombre no es una respuesta.
 *
 * ⚠️ ES UN HILO, NO UN CAMPO. Varias entradas por alerta, hasta el cierre. La
 * llamada que no atendieron vale tanto como la que sí — de hecho vale más,
 * porque es la que explica la demora.
 *
 * ⚠️ TRES ACCIONES Y NO UNA:
 *
 *   `registro` · qué se hizo y qué resultó. Es lo que apaga el sonido.
 *   `escalada` · se lo pasa a alguien de más rango. NO cierra nada: la alerta
 *                sigue abierta y sigue siendo de quien la tenga que atender.
 *   `cierre`   · el hecho se da por terminado. Sólo para roles con la
 *                facultad, y siempre con el motivo escrito.
 *
 * Atender y cerrar ya estaban separados desde la campana y así quedan.
 */
@Injectable()
export class BitacoraService {
  private readonly logger = new Logger(BitacoraService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly protocolo: ProtocoloService,
  ) {}

  /**
   * De qué tipo es esta alerta — y, de paso, si este cliente puede verla.
   *
   * ⚠️ DEVUELVE `null` CUANDO NO ES VISIBLE, y eso es el aislamiento. Toda
   * operación de la bitácora pasa por acá primero: si la alerta es de otro
   * cliente, la consulta no devuelve nada y no hay forma de escribirle una
   * entrada. No es una comprobación aparte que alguien pueda olvidarse de
   * llamar — es el único camino para saber contra qué protocolo trabajar.
   */
  async tipoDeAlerta(
    tenantId: string,
    fuente: FuenteAviso,
    alertaId: string,
  ): Promise<{ tipo: string; cerrada: boolean } | null> {
    const filas =
      fuente === 'condicion'
        ? await this.prisma.$queryRaw<{ tipo: string; cerrada: boolean }[]>`
            SELECT c.tipo, (c.fin IS NOT NULL) AS cerrada
            FROM trip_conditions c
            WHERE c.id = ${alertaId}::uuid AND c.tenant_id = ${tenantId}::uuid
          `
        : await this.prisma.$queryRaw<{ tipo: string; cerrada: boolean }[]>`
            SELECT e.event_type AS tipo, (e.status <> 'open') AS cerrada
            FROM event_logs e
            WHERE e.id = ${alertaId}::uuid AND e.tenant_id = ${tenantId}::uuid
          `;
    return filas[0] ?? null;
  }

  /** El hilo completo, en orden. */
  async hilo(tenantId: string, fuente: FuenteAviso, alertaId: string): Promise<EntradaBitacora[]> {
    // El tipo primero: si la alerta no es visible para este cliente, tampoco
    // lo es su hilo. Sin esto, un id adivinado devolvería el historial de
    // atención de otro cliente — nombres de operadores incluidos.
    const alerta = await this.tipoDeAlerta(tenantId, fuente, alertaId);
    if (!alerta) throw new NotFoundException('La alerta no existe o no es visible para vos.');

    return this.prisma.$queryRaw<EntradaBitacora[]>`
      SELECT
        b.id::text            AS id,
        b.fuente              AS fuente,
        b.alerta_id::text     AS alerta_id,
        b.accion              AS accion,
        b.usuario_id::text    AS usuario_id,
        u.full_name           AS usuario_nombre,
        b.paso_id::text       AS paso_id,
        p.accion              AS paso_accion,
        b.resultado_codigo    AS resultado_codigo,
        r.nombre              AS resultado_nombre,
        b.nota                AS nota,
        b.escalado_a::text    AS escalado_a,
        d.full_name           AS escalado_a_nombre,
        b.created_at          AS created_at
      FROM trip_condition_bitacora b
      LEFT JOIN users u ON u.id = b.usuario_id
      LEFT JOIN users d ON d.id = b.escalado_a
      LEFT JOIN motor_pasos_protocolo p ON p.id = b.paso_id
      LEFT JOIN motor_resultados_atencion r
             ON r.codigo = b.resultado_codigo
            AND r.tipo_condicion = ${alerta.tipo}
            AND (r.tenant_id = b.tenant_id OR r.tenant_id IS NULL)
      WHERE b.tenant_id = ${tenantId}::uuid
        AND b.fuente = ${fuente}
        AND b.alerta_id = ${alertaId}::uuid
      ORDER BY b.created_at
    `;
  }

  /**
   * Escribe una entrada. Recibe el CLIENTE de escritura para poder ir dentro
   * de una transacción — atender es «registrar + silenciar», y las dos cosas
   * tienen que pasar juntas o ninguna.
   *
   * ⚠️ Un `atendida_at` escrito sin su entrada de bitácora sería exactamente
   * el estado que esta etapa vino a eliminar: una alerta silenciada sin decir
   * qué se hizo.
   */
  async registrar(
    cliente: ClienteEscritura,
    datos: {
      tenantId: string;
      fuente: FuenteAviso;
      alertaId: string;
      usuarioId: string;
      accion: AccionBitacora;
      paso_id?: string | null;
      resultado_codigo?: string | null;
      nota?: string | null;
      escalado_a?: string | null;
    },
  ): Promise<number> {
    return cliente.$executeRaw`
      INSERT INTO trip_condition_bitacora (
        tenant_id, fuente, alerta_id, usuario_id, accion,
        paso_id, resultado_codigo, nota, escalado_a
      ) VALUES (
        ${datos.tenantId}::uuid, ${datos.fuente}, ${datos.alertaId}::uuid,
        ${datos.usuarioId}::uuid, ${datos.accion},
        ${datos.paso_id ?? null}::uuid, ${datos.resultado_codigo ?? null},
        ${datos.nota ?? null}, ${datos.escalado_a ?? null}::uuid
      )
    `;
  }

  /**
   * Valida una entrada contra el protocolo de ESA alerta.
   *
   * Devuelve el resultado del catálogo cuando se eligió uno, para que quien
   * llame sepa si habilita escalar sin volver a consultar.
   */
  async validar(
    tenantId: string,
    tipoCondicion: string,
    entrada: EntradaNueva,
  ): Promise<{ habilitaEscalada: boolean }> {
    // La regla dura, primero y en castellano.
    if (!registroDiceAlgo(entrada)) {
      throw new BadRequestException(
        'Registrá qué hiciste: elegí un resultado o escribí una nota. No se puede silenciar una alerta sin dejar constancia.',
      );
    }

    if (entrada.paso_id) {
      const pertenece = await this.protocolo.pasoPertenece(tenantId, tipoCondicion, entrada.paso_id);
      if (!pertenece) {
        throw new BadRequestException('Ese paso no pertenece al protocolo de esta alerta.');
      }
    }

    if (!entrada.resultado_codigo) return { habilitaEscalada: false };

    // ⚠️ SE BUSCA POR TIPO Y POR CÓDIGO. Un resultado existe dentro de un
    // tipo: `ACTIVACION_POLICIAL` es de SOS. Validar sólo el código dejaría
    // registrar una activación policial en una parada prolongada, y la
    // bitácora —que es la prueba que se le muestra al cliente— diría eso.
    const resultado = await this.protocolo.resultadoDe(
      tenantId,
      tipoCondicion,
      entrada.resultado_codigo,
    );
    if (!resultado) {
      throw new BadRequestException(
        'Ese resultado no existe para este tipo de alerta. No se inventa vocabulario: se elige del catálogo.',
      );
    }
    return { habilitaEscalada: habilitaEscalada(resultado) };
  }

  // ════════════════════════════════════════════════════════════════════════
  // ESCALAR
  // ════════════════════════════════════════════════════════════════════════

  /**
   * A quién le toca: el usuario activo de mayor rango **entre los que reciben
   * escaladas**.
   *
   * ══════════════════════════════════════════════════════════════════════
   * ⚠️ SON DOS FILTROS Y NO UNO — `recibe_escaladas` ADEMÁS del nivel
   * ══════════════════════════════════════════════════════════════════════
   *
   * La primera versión ordenaba sólo por `nivel_jerarquico`, y el caso real lo
   * refutó: en esta organización el jefe de flota tiene menos rango que
   * gerencia y **es el que mira el panel**. El gerente está más arriba en el
   * organigrama y casi no entra. Escalarle a él a las tres de la mañana es
   * perder la alerta.
   *
   * Son dos preguntas distintas —quién manda y quién está mirando— y meterlas
   * en un solo número obligaba a mentir en una de las dos: o el organigrama
   * quedaba mal escrito, o la alerta iba a un teléfono apagado.
   *
   * ⚠️ Con esto, `rusertech_admin` queda afuera por partida doble: nivel 0 y
   * `recibe_escaladas = false`. Sigue siendo el mismo razonamiento —estar alto
   * no es estar mirando— ahora dicho en la columna que corresponde.
   *
   * ⚠️ Y se excluye a quien escala. Si el de mayor rango es el que está
   * atendiendo, escalarse a sí mismo sería una entrada que no mueve nada —
   * peor, una que parece que sí.
   *
   * El desempate por antigüedad es para que la respuesta sea la misma dos
   * veces seguidas: con dos jefes de flota, «cualquiera de los dos» hace que
   * la pantalla muestre un destino y la escritura registre otro.
   */
  async destinoDeEscalada(
    tenantId: string,
    excluyendoUsuarioId: string,
  ): Promise<DestinoDeEscalada | null> {
    const filas = await this.prisma.$queryRaw<DestinoDeEscalada[]>`
      SELECT u.id::text AS usuario_id, u.full_name AS nombre, u.email,
             u.role_code, r.nivel_jerarquico::int AS nivel_jerarquico
      FROM users u
      JOIN roles r ON r.code = u.role_code
      WHERE u.tenant_id = ${tenantId}::uuid
        AND u.id <> ${excluyendoUsuarioId}::uuid
        AND u.status = 'active'
        AND r.recibe_escaladas
      ORDER BY r.nivel_jerarquico DESC, u.created_at
      LIMIT 1
    `;
    return filas[0] ?? null;
  }

  /**
   * Escalar. Es UNA ACCIÓN MÁS DEL HILO, no el cierre.
   *
   * ⚠️ La alerta sigue abierta después de escalar, y es a propósito: escalar
   * es pedir ayuda, no sacarse el problema de encima. Si cerrara, el operador
   * tendría un botón para hacer desaparecer lo que no puede resolver.
   *
   * ⚠️ NO hay temporizador ni escalada automática: eso es la 3C-B. Acá la
   * decisión es de una persona, y por eso queda su nombre en la fila.
   */
  async escalar(
    usuario: { id?: string; tenantId?: string; role?: string },
    fuente: FuenteAviso,
    alertaId: string,
    nota: string | null,
  ): Promise<{ destino: DestinoDeEscalada }> {
    const { tenantId, usuarioId } = this.identidad(usuario);
    const alerta = await this.tipoDeAlerta(tenantId, fuente, alertaId);
    if (!alerta) throw new NotFoundException('La alerta no existe o no es visible para vos.');

    const destino = await this.destinoDeEscalada(tenantId, usuarioId);
    if (!destino) {
      // Se dice el motivo real, y nombra la causa exacta. «No se pudo
      // escalar» a secas dejaría al operador probando el botón otra vez; con
      // esto, quien lea el mensaje sabe que lo que falta es marcar a alguien
      // como receptor en Administración global → Roles.
      throw new BadRequestException(
        'No hay a quién escalar: ningún otro usuario activo de este cliente tiene un rol que reciba escaladas.',
      );
    }

    await this.registrar(this.prisma, {
      tenantId,
      fuente,
      alertaId,
      usuarioId,
      accion: 'escalada',
      nota,
      escalado_a: destino.usuario_id,
    });

    this.logger.log(
      `Alerta ${fuente}/${alertaId} escalada por ${usuarioId} a ${destino.email} (${destino.role_code}).`,
    );
    return { destino };
  }

  // ════════════════════════════════════════════════════════════════════════
  // CERRAR
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Cerrar: dar el hecho por terminado.
   *
   * ⚠️ DOS EXIGENCIAS, Y LAS DOS SON DEL ENCARGO:
   *
   *   · la facultad sale de `roles.puede_cerrar_alertas` — un operador
   *     registra entradas, no cierra;
   *   · el motivo escrito es obligatorio, porque cerrar sin recorrer el
   *     protocolo es justamente lo que hay que poder auditar después.
   *
   * ⚠️ Se escribe `fin` en `trip_conditions`, la MISMA columna que usa el
   * motor al cerrar solo. No se agrega vocabulario: con eso, la campana deja
   * de mostrarla y el estado de seguimiento de la 3A se recalcula sin que
   * nadie tenga que enterarse de que existe una forma nueva de cerrar.
   */
  async cerrar(
    usuario: { id?: string; tenantId?: string; role?: string },
    fuente: FuenteAviso,
    alertaId: string,
    motivo: string,
  ): Promise<{ cerrada: boolean }> {
    const { tenantId, usuarioId } = this.identidad(usuario);

    const rol = await this.rolDe(usuario.role);
    if (!puedeCerrar(rol)) {
      throw new ForbiddenException(
        'Tu rol no puede cerrar alertas. Registrá lo que hiciste y, si no podés resolverla, escalala.',
      );
    }
    if (!motivo || motivo.trim().length === 0) {
      throw new BadRequestException('Para cerrar hay que escribir el motivo.');
    }

    const alerta = await this.tipoDeAlerta(tenantId, fuente, alertaId);
    if (!alerta) throw new NotFoundException('La alerta no existe o no es visible para vos.');

    // La entrada del hilo y el cierre de la alerta, juntos. Un cierre sin su
    // entrada sería una alerta que desaparece sin explicación.
    await this.prisma.$transaction(async (tx) => {
      await this.registrar(tx as unknown as ClienteEscritura, {
        tenantId, fuente, alertaId, usuarioId, accion: 'cierre', nota: motivo,
      });

      if (fuente === 'condicion') {
        await tx.$executeRaw`
          UPDATE trip_conditions
             SET fin = coalesce(fin, now()),
                 atendida_por = coalesce(atendida_por, ${usuarioId}::uuid),
                 atendida_at  = coalesce(atendida_at, now())
           WHERE id = ${alertaId}::uuid AND tenant_id = ${tenantId}::uuid
        `;
      } else {
        await tx.$executeRaw`
          UPDATE event_logs
             SET status = 'resolved',
                 resolved_at = coalesce(resolved_at, now()),
                 acknowledged_by = coalesce(acknowledged_by, ${usuarioId}::uuid),
                 acknowledged_at = coalesce(acknowledged_at, now()),
                 resolution_note = coalesce(resolution_note, ${motivo})
           WHERE id = ${alertaId}::uuid AND tenant_id = ${tenantId}::uuid
        `;
      }
    });

    this.logger.log(`Alerta ${fuente}/${alertaId} CERRADA por ${usuarioId}: ${motivo}`);
    return { cerrada: true };
  }

  /** La fila del rol, con las tres respuestas: manda, cierra, y mira. */
  async rolDe(
    roleCode?: string,
  ): Promise<{
    puede_cerrar_alertas: boolean;
    nivel_jerarquico: number;
    recibe_escaladas: boolean;
  } | null> {
    if (!roleCode) return null;
    const filas = await this.prisma.$queryRaw<
      { puede_cerrar_alertas: boolean; nivel_jerarquico: number; recibe_escaladas: boolean }[]
    >`
      SELECT r.puede_cerrar_alertas,
             r.nivel_jerarquico::int AS nivel_jerarquico,
             r.recibe_escaladas
      FROM roles r WHERE r.code = ${roleCode}
    `;
    return filas[0] ?? null;
  }

  /**
   * Los permisos VIGENTES de un usuario, leídos de la base.
   *
   * ══════════════════════════════════════════════════════════════════════
   * ⚠️ POR QUÉ NO SE USAN LOS DEL TOKEN — medido, y es una ventana real
   * ══════════════════════════════════════════════════════════════════════
   *
   * `PermissionsGuard` compara contra `req.user.permissions`, que sale del
   * JWT. Y el JWT se arma UNA VEZ, al iniciar sesión: `auth.service` calcula
   * `(permisos del rol ∪ granted) − revoked` y lo firma adentro del token.
   *
   * O sea: el permiso por usuario SÍ se respeta —esa parte funciona— pero
   * **desde la próxima vez que la persona entre**. Y el frontend, mientras
   * tanto, relee `/auth/me`, que los recalcula FRESCOS contra la base.
   *
   * El resultado es la peor combinación posible, y conviene nombrarla: entre
   * que el supervisor otorga el permiso y que el operador vuelve a entrar,
   * **la pantalla habilita el botón y la API lo rechaza**. El operador ve una
   * acción disponible que no funciona, que es exactamente lo que la regla de
   * «deshabilitado con el motivo» existe para evitar.
   *
   * Para la atención de alertas críticas esa ventana queda cerrada acá: la
   * comprobación lee la base, igual que `/auth/me`. Las dos puntas miran el
   * mismo lugar, así que el botón y la API no pueden discrepar.
   *
   * ⚠️ Esto NO arregla el problema general —cualquier otro permiso del
   * producto sigue viajando en el token— y no es esta tanda. Está en el
   * reporte.
   */
  async permisosVigentesDe(usuarioId: string): Promise<string[]> {
    const filas = await this.prisma.$queryRaw<{ permisos: string[] }[]>`
      SELECT (
        SELECT array_agg(DISTINCT p)
        FROM unnest(
          coalesce(r.permissions, '{}') || coalesce(u.granted_permissions, '{}')
        ) AS p
        WHERE NOT (coalesce(u.revoked_permissions, '{}') @> ARRAY[p])
      ) AS permisos
      FROM users u
      LEFT JOIN roles r ON r.code = u.role_code
      WHERE u.id = ${usuarioId}::uuid
    `;
    return filas[0]?.permisos ?? [];
  }

  private identidad(usuario: { id?: string; tenantId?: string }): {
    tenantId: string;
    usuarioId: string;
  } {
    if (!usuario?.tenantId || !usuario?.id) {
      throw new ForbiddenException('Tu sesión no identifica un usuario y un cliente.');
    }
    return { tenantId: usuario.tenantId, usuarioId: usuario.id };
  }
}
