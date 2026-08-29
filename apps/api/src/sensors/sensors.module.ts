import { Module } from '@nestjs/common';
import { SensorsService } from './sensors.service';
import { SensorsController } from './sensors.controller';
import { LivePositionsModule } from '../common/live-positions/live-positions.module';
import { AccesoEntidadesModule } from '../common/access/acceso-entidades.module';

@Module({
  imports: [AccesoEntidadesModule, LivePositionsModule],
  controllers: [SensorsController],
  providers: [SensorsService],
  exports: [SensorsService]
})
export class SensorsModule {}
