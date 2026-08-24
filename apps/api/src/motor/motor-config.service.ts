import { Injectable, Logger } from '@nestjs/common';
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
}
