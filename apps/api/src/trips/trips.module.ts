import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { CarbonModule } from '../carbon/carbon.module';
import { AccesoEntidadesModule } from '../common/access/acceso-entidades.module';

@Module({
  imports: [CarbonModule, AccesoEntidadesModule],
  controllers: [TripsController],
  providers: [TripsService],
})
export class TripsModule {}
