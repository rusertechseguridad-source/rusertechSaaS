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
import { EventosService } from './eventos.service';
import { SeguimientoService } from './seguimiento/seguimiento.service';
import { SeguimientoController } from './seguimiento/seguimiento.controller';

/**
 * MOTOR DE EVENTOS — Etapas 1 y 3A.
 *
 * Cubre el circuito completo con un solo evaluador: la cola se drena, las
 * geocercas se evalúan, y los viajes cambian de estado solos cuando el
 * vehículo entra en una zona de control.
 *
 * ⚠️ ETAPA 3A · el estado de SEGUIMIENTO se suma acá y no en `TripsModule`:
 * lo deriva el motor de las condiciones abiertas, así que ponerlo en `trips`
 * obligaría a ese módulo a depender del motor por una responsabilidad ajena.
 * La URL sí cuelga del viaje, que es donde el operador lo busca.
 *
 * PrismaModule es @Global, así que no hace falta importarlo.
 */
@Module({
  imports: [TelemetryModule],
  controllers: [MotorController, SeguimientoController],
  providers: [EventosService, 
    ColaService,
    EstadoVehiculoService,
    MotorConfigService,
    TransicionesService,
    VehiculosActivosService,
    TrabajosService,
    MotorWorker,
    SeguimientoService,
  ],
  exports: [ColaService, VehiculosActivosService, TrabajosService, SeguimientoService],
})
export class MotorModule {}
