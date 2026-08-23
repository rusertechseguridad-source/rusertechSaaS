import { Module } from '@nestjs/common';
import { LivePositionsService } from './live-positions.service';

/**
 * Módulo de posiciones en vivo. Lo importan los módulos que necesitan saber
 * dónde está cada vehículo (vehicles, sensors), en lugar de que cada uno
 * resuelva la consulta por su cuenta.
 *
 * PrismaModule y RedisModule son @Global, así que no hace falta importarlos.
 */
@Module({
  providers: [LivePositionsService],
  exports: [LivePositionsService],
})
export class LivePositionsModule {}
