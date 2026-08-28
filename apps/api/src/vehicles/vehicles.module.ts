import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { MailModule } from '../mail/mail.module';
import { LivePositionsModule } from '../common/live-positions/live-positions.module';
import { AccesoEntidadesModule } from '../common/access/acceso-entidades.module';

@Module({
  imports: [MailModule, LivePositionsModule, AccesoEntidadesModule],
  controllers: [VehiclesController],
  providers: [VehiclesService],
})
export class VehiclesModule {}
