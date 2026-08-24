import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertTenantOwnership, requireTenantId } from '../common/tenant/tenant-scope';
import {
  MonitoringConfigService,
  VENTANA_MAPA_HORAS_MAX,
} from '../common/monitoring/monitoring-config.service';
import { clasificarFrescura, TOLERANCIA_RELOJ_MINUTOS, type Frescura } from '../common/config/live-positions';

/**
 * MONITOR DE INGESTA AVL.
 *
 * Responde una sola pregunta, que hoy no tiene dónde contestarse: **¿está
 * entrando la telemetría de cada proveedor GPS, y qué está entrando?**
 *
 * Cuando el mapa aparece vacío, la duda es siempre la misma —¿el proveedor dejó
 * de enviar, o le estamos leyendo mal los datos?—. Sin esta pantalla la única
 * forma de responder era consultar la base a mano.
 *
 * Todo se calcula en SQL sobre `telemetry` y `avl_event_dictionary`. En
 * particular los **códigos desconocidos**: hasta ahora salían de un set en
 * Redis (`avl:unknown:{id}`) que se pierde con la caché y que está vacío en las
 * instalaciones sin Redis. Calcularlos contra la tabla los hace reproducibles y
 * no depende de una pieza opcional de la arquitectura.
 */

/** Estado de salud de un proveedor, derivado de la antigüedad del último dato. */
export type EstadoIngesta = Frescura | 'sin_datos' | 'inactivo_config';

export interface CodigoIngesta {
  provider_code: string;
  cantidad: number;
  ultimo: Date;
  /** Si existe una entrada activa en el diccionario para ese código. */
  reconocido: boolean;
  /** Si el código llegó desde la app del conductor (prefijo MOB_*). */
  origen_movil: boolean;
}

export interface ResumenAvlUser {
  id: string;
  user_avl_code: string;
  name: string;
  provider_name: string | null;
  is_active: boolean;
  /** Último punto dentro de la ventana consultada. */
  ultimo_punto: Date | null;
  age_seconds: number | null;
  estado: EstadoIngesta;
  puntos: number;
  puntos_movil: number;
  duplicados: number;
  vehiculos_reportando: number;
  /**
   * Vehículos activos asignados al proveedor en la ficha del vehículo.
   *
   * ⚠️ NO es el denominador de `vehiculos_reportando`: son dos conjuntos que se
   * cuentan por caminos distintos —uno por la asignación, otro por el
   * `avl_user_id` de cada punto— y pueden no coincidir. Cuando `reportando`
   * supera a `asignados` hay una asignación mal cargada, y eso se muestra en
   * pantalla en lugar de disimularse con un cociente.
   */
  vehiculos_asignados: number;
  codigos: CodigoIngesta[];
  codigos_desconocidos: number;
}

export interface RespuestaMonitorAvl {
  ventana_horas: number;
  desde: Date;
  hasta: Date;
  umbral_en_vivo_minutos: number;
  umbral_inactivo_minutos: number;
  proveedores: ResumenAvlUser[];
}

export interface VehiculoIngesta {
  vehicle_id: string;
  plate: string | null;
  alias: string | null;
  status: string | null;
  puntos: number;
  ultimo_punto: Date | null;
  age_seconds: number | null;
  estado: EstadoIngesta;
}

interface FilaResumen {
  id: string;
  user_avl_code: string;
  name: string;
  provider_name: string | null;
  is_active: boolean;
  ultimo_punto: Date | null;
  age_seconds: number | null;
  puntos: number;
  puntos_movil: number;
  duplicados: number;
  vehiculos_reportando: number;
  vehiculos_asignados: number;
}

interface FilaCodigo {
  avl_user_id: string;
  provider_code: string;
  cantidad: number;
  ultimo: Date;
  reconocido: boolean;
  origen_movil: boolean;
}

interface FilaVehiculo {
  vehicle_id: string;
  plate: string | null;
  alias: string | null;
  status: string | null;
  puntos: number;
  ultimo_punto: Date | null;
  age_seconds: number | null;
}

@Injectable()
export class AvlMonitorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly monitoringConfig: MonitoringConfigService,
  ) {}

  /**
   * Estado de ingesta de todos los proveedores GPS del tenant.
   *
   * @param horas Ventana opcional. Se acota al mismo techo que la del mapa
   *              (168 h) porque la razón es la misma: el rango tiene que caer
   *              dentro de una o dos particiones mensuales de `telemetry`.
   */
  async obtenerResumen(tenantId: string, horas?: number): Promise<RespuestaMonitorAvl> {
    const tenant = requireTenantId(tenantId, 'AvlMonitorService.obtenerResumen');
    const umbrales = await this.monitoringConfig.obtenerUmbrales(tenant);
    const ventanaHoras = this.acotarVentana(horas, umbrales.ventana_mapa_horas);
    const { desde, hasta } = this.calcularRango(ventanaHoras);

    const [filas, codigos] = await Promise.all([
      this.consultarResumen(tenant, desde, hasta),
      this.consultarCodigos(tenant, desde, hasta),
    ]);

    const codigosPorProveedor = new Map<string, CodigoIngesta[]>();
    codigos.forEach((c) => {
      const lista = codigosPorProveedor.get(c.avl_user_id) ?? [];
      lista.push({
        provider_code: c.provider_code,
        cantidad: Number(c.cantidad),
        ultimo: c.ultimo,
        reconocido: Boolean(c.reconocido),
        origen_movil: Boolean(c.origen_movil),
      });
      codigosPorProveedor.set(c.avl_user_id, lista);
    });

    const proveedores: ResumenAvlUser[] = filas.map((f) => {
      const lista = codigosPorProveedor.get(f.id) ?? [];
      return {
        id: f.id,
        user_avl_code: f.user_avl_code,
        name: f.name,
        provider_name: f.provider_name ?? null,
        is_active: Boolean(f.is_active),
        ultimo_punto: f.ultimo_punto ?? null,
        age_seconds: f.age_seconds === null ? null : Number(f.age_seconds),
        estado: this.clasificarEstado(f.age_seconds, Boolean(f.is_active), umbrales),
        puntos: Number(f.puntos ?? 0),
        puntos_movil: Number(f.puntos_movil ?? 0),
        duplicados: Number(f.duplicados ?? 0),
        vehiculos_reportando: Number(f.vehiculos_reportando ?? 0),
        vehiculos_asignados: Number(f.vehiculos_asignados ?? 0),
        codigos: lista,
        // Un código de la app no cuenta como desconocido: no se espera que el
        // diccionario del proveedor GPS describa los eventos de la app propia.
        codigos_desconocidos: lista.filter((c) => !c.reconocido && !c.origen_movil).length,
      };
    });

    return {
      ventana_horas: ventanaHoras,
      desde,
      hasta,
      umbral_en_vivo_minutos: umbrales.umbral_en_vivo_minutos,
      umbral_inactivo_minutos: umbrales.umbral_inactivo_minutos,
      proveedores,
    };
  }

  /**
   * Detalle por vehículo de un proveedor.
   *
   * Incluye los vehículos **sin puntos**: son justamente los que hay que mirar
   * cuando un proveedor "está enviando" pero falta una unidad.
   */
  async obtenerVehiculos(
    avlUserId: string,
    tenantId: string,
    horas?: number,
  ): Promise<{ ventana_horas: number; vehiculos: VehiculoIngesta[] }> {
    const tenant = requireTenantId(tenantId, 'AvlMonitorService.obtenerVehiculos');
    await assertTenantOwnership(this.prisma.extended.avlUser, avlUserId, tenant, 'AVL User');

    const umbrales = await this.monitoringConfig.obtenerUmbrales(tenant);
    const ventanaHoras = this.acotarVentana(horas, umbrales.ventana_mapa_horas);
    const { desde, hasta } = this.calcularRango(ventanaHoras);

    const filas: FilaVehiculo[] = await this.prisma.$queryRaw<FilaVehiculo[]>`
      SELECT
        v.id AS vehicle_id,
        v.plate,
        v.alias,
        v.status,
        COUNT(t.vehicle_id)::int AS puntos,
        MAX(t."timestamp") AS ultimo_punto,
        EXTRACT(EPOCH FROM (NOW() - MAX(t."timestamp")))::int AS age_seconds
      FROM vehicles v
      LEFT JOIN telemetry t
        ON t.vehicle_id = v.id
       AND t.tenant_id = v.tenant_id
       AND t."timestamp" >= ${desde}
       AND t."timestamp" <= ${hasta}
       AND t.is_duplicate = false
      WHERE v.tenant_id = ${tenant}::uuid
        AND v.avl_user_id = ${avlUserId}::uuid
      GROUP BY v.id, v.plate, v.alias, v.status
      ORDER BY MAX(t."timestamp") DESC NULLS LAST, v.plate ASC
    `;

    return {
      ventana_horas: ventanaHoras,
      vehiculos: filas.map((f) => ({
        vehicle_id: f.vehicle_id,
        plate: f.plate ?? null,
        alias: f.alias ?? null,
        status: f.status ?? null,
        puntos: Number(f.puntos ?? 0),
        ultimo_punto: f.ultimo_punto ?? null,
        age_seconds: f.age_seconds === null ? null : Number(f.age_seconds),
        estado: this.clasificarEstado(f.age_seconds, true, umbrales),
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Consultas
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Un solo recorrido de `telemetry` para todas las métricas del proveedor:
   * los `FILTER` evitan repetir el escaneo una vez por métrica.
   *
   * ⚠️ Rango CERRADO, igual que en las posiciones en vivo. Con un `>=` abierto
   * Postgres no puede descartar las particiones futuras ni la `default`, y la
   * planificación pasa a costar más que la ejecución.
   */
  private async consultarResumen(
    tenantId: string,
    desde: Date,
    hasta: Date,
  ): Promise<FilaResumen[]> {
    return this.prisma.$queryRaw<FilaResumen[]>`
      WITH agregado AS (
        SELECT
          t.avl_user_id,
          COUNT(*) FILTER (WHERE NOT t.is_duplicate)::int AS puntos,
          COUNT(*) FILTER (WHERE t.is_duplicate)::int AS duplicados,
          COUNT(*) FILTER (
            WHERE NOT t.is_duplicate AND jsonb_exists(t.raw_payload, 'MobileCode')
          )::int AS puntos_movil,
          COUNT(DISTINCT t.vehicle_id) FILTER (WHERE NOT t.is_duplicate)::int AS vehiculos_reportando,
          MAX(t."timestamp") FILTER (WHERE NOT t.is_duplicate) AS ultimo_punto
        FROM telemetry t
        WHERE t.tenant_id = ${tenantId}::uuid
          AND t."timestamp" >= ${desde}
          AND t."timestamp" <= ${hasta}
        GROUP BY t.avl_user_id
      ),
      asignados AS (
        SELECT avl_user_id, COUNT(*)::int AS vehiculos_asignados
        FROM vehicles
        WHERE tenant_id = ${tenantId}::uuid
          AND avl_user_id IS NOT NULL
          AND status <> 'inactive'
        GROUP BY avl_user_id
      )
      SELECT
        a.id,
        a.user_avl_code,
        a.name,
        a.provider_name,
        a.is_active,
        ag.ultimo_punto,
        EXTRACT(EPOCH FROM (NOW() - ag.ultimo_punto))::int AS age_seconds,
        COALESCE(ag.puntos, 0) AS puntos,
        COALESCE(ag.puntos_movil, 0) AS puntos_movil,
        COALESCE(ag.duplicados, 0) AS duplicados,
        COALESCE(ag.vehiculos_reportando, 0) AS vehiculos_reportando,
        COALESCE(asg.vehiculos_asignados, 0) AS vehiculos_asignados
      FROM avl_users a
      LEFT JOIN agregado ag ON ag.avl_user_id = a.id
      LEFT JOIN asignados asg ON asg.avl_user_id = a.id
      WHERE a.tenant_id = ${tenantId}::uuid
      ORDER BY a.name ASC
    `;
  }

  /**
   * Códigos de evento recibidos, con su cantidad y si el diccionario los
   * reconoce.
   *
   * `EXISTS` y no un `JOIN` con el diccionario: la clave única del diccionario
   * es `(avl_user_id, category, raw_code)`, así que un mismo código puede tener
   * varias filas —una por categoría— y el join multiplicaría los conteos.
   */
  private async consultarCodigos(
    tenantId: string,
    desde: Date,
    hasta: Date,
  ): Promise<FilaCodigo[]> {
    return this.prisma.$queryRaw<FilaCodigo[]>`
      SELECT
        t.avl_user_id,
        t.provider_code,
        COUNT(*)::int AS cantidad,
        MAX(t."timestamp") AS ultimo,
        bool_or(jsonb_exists(t.raw_payload, 'MobileCode')) AS origen_movil,
        EXISTS (
          SELECT 1
          FROM avl_event_dictionary d
          WHERE d.avl_user_id = t.avl_user_id
            AND d.raw_code = t.provider_code
            AND d.is_active = true
        ) AS reconocido
      FROM telemetry t
      WHERE t.tenant_id = ${tenantId}::uuid
        AND t."timestamp" >= ${desde}
        AND t."timestamp" <= ${hasta}
        AND t.is_duplicate = false
        AND t.provider_code IS NOT NULL
      GROUP BY t.avl_user_id, t.provider_code
      ORDER BY t.avl_user_id, COUNT(*) DESC
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Auxiliares
  // ─────────────────────────────────────────────────────────────────────────

  /** Ventana pedida, acotada al techo que impone el particionado. */
  private acotarVentana(horas: number | undefined, porDefecto: number): number {
    const n = Number(horas);
    if (!Number.isFinite(n) || n <= 0) return porDefecto;
    return Math.min(VENTANA_MAPA_HORAS_MAX, Math.floor(n));
  }

  private calcularRango(horas: number): { desde: Date; hasta: Date } {
    const ahora = Date.now();
    return {
      desde: new Date(ahora - horas * 60 * 60 * 1000),
      hasta: new Date(ahora + TOLERANCIA_RELOJ_MINUTOS * 60 * 1000),
    };
  }

  /**
   * Traduce la antigüedad del último dato al estado del proveedor, con los
   * mismos umbrales que colorean el mapa: si el operador ve "en vivo" en un
   * lado, tiene que significar lo mismo en el otro.
   */
  private clasificarEstado(
    ageSeconds: number | null,
    activo: boolean,
    umbrales: { umbral_en_vivo_minutos: number; umbral_inactivo_minutos: number },
  ): EstadoIngesta {
    // Un proveedor dado de baja que no envía no es una falla que atender.
    if (!activo) return 'inactivo_config';
    if (ageSeconds === null || ageSeconds === undefined) return 'sin_datos';
    return clasificarFrescura(
      Number(ageSeconds),
      umbrales.umbral_en_vivo_minutos,
      umbrales.umbral_inactivo_minutos,
    );
  }
}
