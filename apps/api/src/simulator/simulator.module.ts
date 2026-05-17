import { Module } from '@nestjs/common';
import { SimulatorController } from './simulator.controller';
import { SimulatorService } from './simulator.service';
import { SimulatorProcessor } from './simulator.processor';
import { BullModule } from '@nestjs/bullmq';
import { TelemetryModule } from '../telemetry/telemetry.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'simulator.route' }),
    TelemetryModule,
  ],
  controllers: [SimulatorController],
  providers: [SimulatorService, SimulatorProcessor],
})
export class SimulatorModule {}
