import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { CONFIG_MOTOR_POR_DEFECTO, type ConfigMotor } from './tipos';

/**
 * CONFIGURACIÓN DEL MOTOR POR TENANT.
 *
 * Mismo patrón que `MonitoringConfigService`, que ya está en producción: tabla
 * tipada con CHECK, defaults en el código, y la aplicación funciona sin fila.
 * Un cliente sin configurar tiene un motor razonable, no un motor apagado.
 *
 * Se lee UNA VEZ POR LOTE, no una vez por punto: apagar un evaluador tiene que
 * ahorrar su costo, no sólo ocultar su resultado.
 */
@Injectable()
export class MotorConfigService {
  private readonly logger = new Logger(MotorConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  async obtener(tenantId: string): Promise<ConfigMotor> {
    const tenant = requireTenantId(tenantId, 'MotorConfigService.obtener');
    try {
      const filas: ConfigMotor[] = await this.prisma.$queryRaw<ConfigMotor[]>`
        SELECT red_seguridad_minutos, red_seguridad_activa,
               parada_minutos, parada_velocidad_kmh,
               eval_geocercas, eval_reglas, eval_desvio,
               eval_protocolos, eval_riesgo, eval_sensores
        FROM tenant_engine_config
        WHERE tenant_id = ${tenant}::uuid
        LIMIT 1
      `;
      if (!filas || filas.length === 0) return { ...CONFIG_MOTOR_POR_DEFECTO };
      return { ...CONFIG_MOTOR_POR_DEFECTO, ...filas[0] };
    } catch (error) {
      // Si la tabla todavía no existe (Etapa 0 sin ejecutar), el motor tiene
      // que seguir funcionando con los defaults en lugar de romper.
      this.logger.warn(
        `No se pudo leer tenant_engine_config, se usan los valores por defecto: ${(error as Error).message}`,
      );
      return { ...CONFIG_MOTOR_POR_DEFECTO };
    }
  }

  /**
   * Tolerancia de simplificación del recorrido guardado, en metros (E7).
   *
   * Devuelve el valor efectivo del tenant: su fila si existe, o el default de
   * la instalación (2 m — alineado en la Fase E con el default de la columna
   * y con el de `fn_calcular_trip_summary`).
   */
  async obtenerToleranciaRecorrido(tenantId: string): Promise<{ tolerancia_m: number; es_default: boolean }> {
    const tenant = requireTenantId(tenantId, 'MotorConfigService.obtenerToleranciaRecorrido');
    const filas = await this.prisma.$queryRaw<Array<{ tolerancia_m: number }>>`
      SELECT recorrido_tolerancia_m::float8 AS tolerancia_m
      FROM tenant_engine_config
      WHERE tenant_id = ${tenant}::uuid
      LIMIT 1
    `;
    if (!filas || filas.length === 0) return { tolerancia_m: 2, es_default: true };
    return { tolerancia_m: Number(filas[0].tolerancia_m), es_default: false };
  }

  /**
   * Cambia la tolerancia del tenant. Upsert: un tenant sin fila la gana acá.
   *
   * La validación replica el CHECK de la base (chk_tec_recorrido_tolerancia)
   * para que el operador reciba un mensaje en su idioma y no un 23514: el
   * rango permitido es (0, 50] metros. El valor usado queda estampado en cada
   * viaje al calcular su resumen, así que cambiarlo NO altera los recorridos
   * ya guardados — sólo los que se cierren de acá en adelante.
   */
  async cambiarToleranciaRecorrido(tenantId: string, toleranciaM: number): Promise<{ tolerancia_m: number }> {
    const tenant = requireTenantId(tenantId, 'MotorConfigService.cambiarToleranciaRecorrido');
    const valor = Number(toleranciaM);
    // Rango [0, 50]: espejo EXACTO del CHECK de la base
    // (chk_tec_recorrido_tolerancia, `between 0 and 50`). El 0 es legítimo:
    // significa "guardar el recorrido sin simplificar" — máximo detalle.
    if (!Number.isFinite(valor) || valor < 0 || valor > 50) {
      throw new BadRequestException(
        'La precisión del recorrido debe ser un número entre 0 y 50 metros ' +
          `(0 = guardar sin simplificar). Llegó: ${String(toleranciaM)}.`,
      );
    }

    await this.prisma.$executeRaw`
      INSERT INTO tenant_engine_config (tenant_id, recorrido_tolerancia_m)
      VALUES (${tenant}::uuid, ${valor})
      ON CONFLICT (tenant_id)
      DO UPDATE SET recorrido_tolerancia_m = ${valor}
    `;
    this.logger.log(`Tolerancia de recorrido del tenant ${tenant} cambiada a ${valor} m.`);
    return { tolerancia_m: valor };
  }
}
