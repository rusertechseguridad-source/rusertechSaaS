import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AccesoEntidadesModule } from '../common/access/acceso-entidades.module';

@Module({
  imports: [AccesoEntidadesModule, PrismaModule],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
