import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { PasoProtocolo, ProtocoloDeAtencion, ResultadoAtencion } from './tipos-atencion';

@Injectable()
export class ProtocoloService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Los pasos y resultados para atender una alerta de este tipo.
   *
   * ══════════════════════════════════════════════════════════════════════
   * ⚠️ POR QUÉ NO SALE DE `operational_protocols` — medido antes de escribir
   * ══════════════════════════════════════════════════════════════════════
   *
   * Esa tabla existe y tiene `protocol_steps`, pero contesta otra pregunta:
   * su clave es la matriz de cuatro dimensiones del estado operativo
   * (`trip_status` × `sub_status` × `gps_reporting` × `driver_communication`)
   * y lo que devuelve es un nivel de riesgo y un SLA. Sirve para DEDUCIR LA
   * GRAVEDAD desde el estado — el motor de protocolos de la Etapa 6.
   *
   * Acá hace falta lo otro: qué pasos recorre un operador cuando atiende una
   * alerta de tipo X. Su clave natural es el TIPO DE CONDICIÓN, que ahí no
   * existe y no se puede agregar sin romper esa unicidad.
   *
   * ⚠️ Y una trampa que conviene nombrar: `sub_status` tiene valores que se
   * PARECEN —`desvio_ruta`, `perdida_senal`, `boton_panico`— pero el catálogo
   * del motor usa `DESVIO_DE_RUTA`, `SIN_REPORTE`, `SOS`. Atarlos por
   * parecido habría sido inventar una correspondencia y llamarla medición.
   *
   * ── La doctrina del cliente gana sobre la global ──────────────────────
   *
   * Es el mismo patrón de catálogo híbrido que ya usa `motor_niveles_riesgo`:
   * `tenant_id IS NULL` es la doctrina de fábrica y las filas del cliente la
   * reemplazan. ⚠️ La reemplazan ENTERA y no se mezclan: media doctrina
   * propia y media heredada daría un protocolo que nadie escribió, con pasos
   * de dos criterios distintos intercalados.
   */
  async paraTipo(tenantId: string, tipoCondicion: string): Promise<ProtocoloDeAtencion> {
    const pasosPropios = await this.pasos(tenantId, tipoCondicion, true);
    const pasos = pasosPropios.length > 0 ? pasosPropios : await this.pasos(tenantId, tipoCondicion, false);

    const resultadosPropios = await this.resultados(tenantId, tipoCondicion, true);
    const resultados =
      resultadosPropios.length > 0
        ? resultadosPropios
        : await this.resultados(tenantId, tipoCondicion, false);

    return {
      tipo_condicion: tipoCondicion,
      pasos,
      resultados,
      propio_del_cliente: pasosPropios.length > 0 || resultadosPropios.length > 0,
    };
  }

  /**
   * Un resultado concreto del catálogo, o `null` si no existe para ese tipo.
   *
   * ⚠️ Se busca POR TIPO además de por código, y es lo que impide que alguien
   * mande `ACTIVACION_POLICIAL` al atender una parada prolongada. El código
   * existe en el catálogo —pertenece a `SOS`— así que una comprobación que
   * sólo mirara el código lo aceptaría, y la bitácora quedaría diciendo que
   * se activó a la policía por un camión detenido.
   */
  async resultadoDe(
    tenantId: string,
    tipoCondicion: string,
    codigo: string,
  ): Promise<ResultadoAtencion | null> {
    const filas = await this.prisma.$queryRaw<ResultadoAtencion[]>`
      SELECT r.codigo, r.nombre, r.orden::int AS orden, r.habilita_escalada
      FROM motor_resultados_atencion r
      WHERE r.tipo_condicion = ${tipoCondicion}
        AND r.codigo = ${codigo}
        AND r.is_active
        AND (r.tenant_id = ${tenantId}::uuid OR r.tenant_id IS NULL)
      ORDER BY r.tenant_id NULLS LAST
      LIMIT 1
    `;
    return filas[0] ?? null;
  }

  /** ¿Este paso pertenece al protocolo de este tipo? */
  async pasoPertenece(tenantId: string, tipoCondicion: string, pasoId: string): Promise<boolean> {
    const filas = await this.prisma.$queryRaw<{ existe: boolean }[]>`
      SELECT true AS existe
      FROM motor_pasos_protocolo p
      WHERE p.id = ${pasoId}::uuid
        AND p.tipo_condicion = ${tipoCondicion}
        AND p.is_active
        AND (p.tenant_id = ${tenantId}::uuid OR p.tenant_id IS NULL)
      LIMIT 1
    `;
    return filas.length > 0;
  }

  private async pasos(
    tenantId: string,
    tipoCondicion: string,
    delCliente: boolean,
  ): Promise<PasoProtocolo[]> {
    return this.prisma.$queryRaw<PasoProtocolo[]>`
      SELECT p.id::text AS id, p.orden::int AS orden, p.accion
      FROM motor_pasos_protocolo p
      WHERE p.tipo_condicion = ${tipoCondicion}
        AND p.is_active
        AND (${delCliente}::boolean = (p.tenant_id IS NOT NULL))
        AND (p.tenant_id = ${tenantId}::uuid OR p.tenant_id IS NULL)
      ORDER BY p.orden
    `;
  }

  private async resultados(
    tenantId: string,
    tipoCondicion: string,
    delCliente: boolean,
  ): Promise<ResultadoAtencion[]> {
    return this.prisma.$queryRaw<ResultadoAtencion[]>`
      SELECT r.codigo, r.nombre, r.orden::int AS orden, r.habilita_escalada
      FROM motor_resultados_atencion r
      WHERE r.tipo_condicion = ${tipoCondicion}
        AND r.is_active
        AND (${delCliente}::boolean = (r.tenant_id IS NOT NULL))
        AND (r.tenant_id = ${tenantId}::uuid OR r.tenant_id IS NULL)
      ORDER BY r.orden
    `;
  }
}
