import { Module } from '@nestjs/common';
import { SimulatorController } from './simulator.controller';
import { SimulatorService } from './simulator.service';
import { SimulatorProcessor } from './simulator.processor';
import { TelemetryModule } from '../telemetry/telemetry.module';
import {
  colasOpcionales,
  proveedoresColasInertes,
  soloConRedis,
} from '../common/config/bull-opcional';

@Module({
  imports: [
    // Sin REDIS_URL la cola no se registra; SimulatorService responde con un
    // BadRequestException claro si alguien intenta simular una ruta.
    ...colasOpcionales('simulator.route'),
    TelemetryModule,
  ],
  controllers: [SimulatorController],
  providers: [
    SimulatorService,
    ...soloConRedis(SimulatorProcessor),
    ...proveedoresColasInertes('simulator.route'),
  ],
})
export class SimulatorModule {}
