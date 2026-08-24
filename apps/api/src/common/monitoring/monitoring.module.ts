import { Global, Module } from '@nestjs/common';
import { MonitoringConfigService } from './monitoring-config.service';

/**
 * Configuración de monitoreo del tenant. Es @Global porque la consumen tanto
 * las posiciones en vivo como el monitor AVL y la pantalla de administración,
 * y es un servicio sin estado que sólo lee una fila.
 */
@Global()
@Module({
  providers: [MonitoringConfigService],
  exports: [MonitoringConfigService],
})
export class MonitoringModule {}
