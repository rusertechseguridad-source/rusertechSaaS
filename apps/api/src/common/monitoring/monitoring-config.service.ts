import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireTenantId } from '../tenant/tenant-scope';
import { getLivePositionsWindowHours } from '../config/live-positions';

/**
 * Umbrales de monitoreo efectivos para un tenant.
 * Todos en las unidades que declara la tabla `tenant_monitoring_config`.
 */
export interface UmbralesMonitoreo {
  umbral_en_vivo_minutos: number;
  umbral_inactivo_minutos: number;
  ventana_mapa_horas: number;
}

/**
 * Valores por defecto. Viven en el código a propósito: **sin fila del tenant la
 * web tiene que funcionar igual**. La tabla es una personalización opcional,
 * no un requisito de arranque.
 */
export const UMBRALES_POR_DEFECTO: UmbralesMonitoreo = {
  umbral_en_vivo_minutos: 5,
  umbral_inactivo_minutos: 30,
  ventana_mapa_horas: 24,
};

/**
 * Techo de la ventana del mapa, replicado del CHECK de la base.
 *
 * ⚠️ No es un número arbitrario: `telemetry` está particionada por mes y la
 * consulta de posiciones usa un rango cerrado para que Postgres pode
 * particiones al planificar. Una ventana de 7 días cruza como máximo dos
 * particiones; una de 30 obligaría a leer particiones completas y encarecería
 * la planificación (medido: 30 particiones → Planning 15,6 ms / 5.481 buffers;
 * 1 partición → 6,1 ms / 603 buffers).
 *
 * Se valida también acá, y no sólo en la base, porque un valor cargado antes
 * de aplicar el CHECK no debe degradar la consulta.
 */
export const VENTANA_MAPA_HORAS_MAX = 168;

/**
 * Valores por defecto efectivos de la instalación.
 *
 * La ventana sale de `LIVE_POSITIONS_WINDOW_HOURS` cuando está definida: esa
 * variable existía antes que la tabla y sigue siendo la forma de fijar el
 * default de un despliegue completo. La fila del tenant, cuando existe, manda
 * sobre esto.
 */
export function umbralesPorDefecto(): UmbralesMonitoreo {
  return { ...UMBRALES_POR_DEFECTO, ventana_mapa_horas: getLivePositionsWindowHours() };
}

/**
 * Lee la configuración de monitoreo del tenant, con caída a los valores por
 * defecto.
 *
 * Se consulta en cada request de posiciones. Es una búsqueda por clave
 * primaria de una fila diminuta: más barato que mantener una caché coherente,
 * y hace que un cambio de umbral se vea en el siguiente refresco del mapa sin
 * invalidaciones ni esperas.
 */
@Injectable()
export class MonitoringConfigService {
  private readonly logger = new Logger(MonitoringConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  async obtenerUmbrales(tenantId: string): Promise<UmbralesMonitoreo> {
    const tenant = requireTenantId(tenantId, 'MonitoringConfigService.obtenerUmbrales');

    try {
      const filas = await this.prisma.$queryRaw<UmbralesMonitoreo[]>`
        SELECT umbral_en_vivo_minutos, umbral_inactivo_minutos, ventana_mapa_horas
        FROM tenant_monitoring_config
        WHERE tenant_id = ${tenant}::uuid
        LIMIT 1
      `;

      if (!filas || filas.length === 0) return umbralesPorDefecto();

      return this.sanear(filas[0]);
    } catch (error) {
      // Si la tabla todavía no existe (script sin ejecutar), el monitoreo tiene
      // que seguir funcionando con los defaults en lugar de romper el mapa.
      this.logger.warn(
        `No se pudo leer tenant_monitoring_config, se usan los valores por defecto: ${(error as Error).message}`,
      );
      return umbralesPorDefecto();
    }
  }

  /**
   * Actualiza los umbrales del tenant. Valida antes de escribir para devolver
   * un error entendible en lugar de dejar que estalle el CHECK de la base.
   */
  async guardarUmbrales(tenantId: string, valores: Partial<UmbralesMonitoreo>): Promise<UmbralesMonitoreo> {
    const tenant = requireTenantId(tenantId, 'MonitoringConfigService.guardarUmbrales');
    const actuales = await this.obtenerUmbrales(tenant);
    const nuevos = this.sanear({ ...actuales, ...valores });

    await this.prisma.$executeRaw`
      INSERT INTO tenant_monitoring_config (
        tenant_id, umbral_en_vivo_minutos, umbral_inactivo_minutos, ventana_mapa_horas, updated_at
      ) VALUES (
        ${tenant}::uuid, ${nuevos.umbral_en_vivo_minutos}, ${nuevos.umbral_inactivo_minutos},
        ${nuevos.ventana_mapa_horas}, now()
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        umbral_en_vivo_minutos  = EXCLUDED.umbral_en_vivo_minutos,
        umbral_inactivo_minutos = EXCLUDED.umbral_inactivo_minutos,
        ventana_mapa_horas      = EXCLUDED.ventana_mapa_horas,
        updated_at              = now()
    `;

    return nuevos;
  }

  /**
   * Acota los valores a los rangos válidos y garantiza la coherencia entre
   * umbrales. Es la misma regla que el CHECK de la base, aplicada acá para
   * poder corregir en lugar de rechazar cuando el dato viene de una fila vieja.
   */
  private sanear(v: UmbralesMonitoreo): UmbralesMonitoreo {
    const porDefecto = umbralesPorDefecto();
    const enVivo = this.acotar(v.umbral_en_vivo_minutos, 1, 120, porDefecto.umbral_en_vivo_minutos);
    let inactivo = this.acotar(v.umbral_inactivo_minutos, 2, 720, porDefecto.umbral_inactivo_minutos);

    // "Inactivo" tiene que estar después de "en vivo": si no, ningún vehículo
    // pasaría nunca por ese estado.
    if (inactivo <= enVivo) inactivo = enVivo + 1;

    return {
      umbral_en_vivo_minutos: enVivo,
      umbral_inactivo_minutos: inactivo,
      ventana_mapa_horas: this.acotar(
        v.ventana_mapa_horas, 1, VENTANA_MAPA_HORAS_MAX, porDefecto.ventana_mapa_horas,
      ),
    };
  }

  private acotar(valor: number | undefined | null, min: number, max: number, porDefecto: number): number {
    const n = Number(valor);
    if (!Number.isFinite(n)) return porDefecto;
    return Math.min(max, Math.max(min, Math.floor(n)));
  }
}
