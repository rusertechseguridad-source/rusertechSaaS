import { Module } from '@nestjs/common';
import { SensorsService } from './sensors.service';
import { SensorsController } from './sensors.controller';
import { LivePositionsModule } from '../common/live-positions/live-positions.module';

@Module({
  imports: [LivePositionsModule],
  controllers: [SensorsController],
  providers: [SensorsService],
  exports: [SensorsService]
})
export class SensorsModule {}
