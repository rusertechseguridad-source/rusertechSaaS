import { Module } from '@nestjs/common';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';
import { GeocodingService } from './geocoding.service';
import { OutboxProcessorService } from './outbox-processor.service';
import { BullModule } from '@nestjs/bullmq';
import { RiskLevelProcessor } from './risk-level.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'telemetry.raw' },
      { name: 'forwarding.send' }
    ),
  ],
  controllers: [TelemetryController],
  providers: [TelemetryService, GeocodingService, OutboxProcessorService, RiskLevelProcessor],
  exports: [TelemetryService],
})
export class TelemetryModule {}
