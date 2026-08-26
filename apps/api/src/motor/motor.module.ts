import { Module } from '@nestjs/common';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { ColaService } from './cola.service';
import { EstadoVehiculoService } from './estado-vehiculo.service';
import { MotorConfigService } from './motor-config.service';
import { TransicionesService } from './transiciones.service';
import { VehiculosActivosService } from './vehiculos-activos.service';
import { TrabajosService } from './trabajos.service';
import { MotorWorker } from './motor.worker';
import { MotorController } from './motor.controller';

/**
 * MOTOR DE EVENTOS — Etapa 1.
 *
 * Cubre el circuito completo con un solo evaluador: la cola se drena, las
 * geocercas se evalúan, y los viajes cambian de estado solos cuando el
 * vehículo entra en una zona de control.
 *
 * PrismaModule es @Global, así que no hace falta importarlo.
 */
@Module({
  imports: [TelemetryModule],
  controllers: [MotorController],
  providers: [
    ColaService,
    EstadoVehiculoService,
    MotorConfigService,
    TransicionesService,
    VehiculosActivosService,
    TrabajosService,
    MotorWorker,
  ],
  exports: [ColaService, VehiculosActivosService, TrabajosService],
})
export class MotorModule {}
