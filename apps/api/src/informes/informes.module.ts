import { Module } from '@nestjs/common';
import { InformeDatosService } from './informe-datos.service';
import { InformeService } from './informe.service';
import { ReportesService } from './reportes.service';
import { InformesController } from './informes.controller';
import { MotorModule } from '../motor/motor.module';

/**
 * INFORMES — Etapa 2 del motor.
 *
 * El informe por viaje es el entregable del producto: lo que el cliente
 * archiva, presenta ante un reclamo, y muestra a *su* cliente.
 */
@Module({
  imports: [MotorModule],
  controllers: [InformesController],
  providers: [InformeDatosService, InformeService, ReportesService],
})
export class InformesModule {}
