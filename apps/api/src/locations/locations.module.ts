import { Module } from '@nestjs/common';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { AccesoEntidadesModule } from '../common/access/acceso-entidades.module';

@Module({
  controllers: [LocationsController],
  imports: [AccesoEntidadesModule],
  providers: [LocationsService],
})
export class LocationsModule {}
