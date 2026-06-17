import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { CarbonModule } from '../carbon/carbon.module';

@Module({
  imports: [CarbonModule],
  controllers: [TripsController],
  providers: [TripsService],
})
export class TripsModule {}
