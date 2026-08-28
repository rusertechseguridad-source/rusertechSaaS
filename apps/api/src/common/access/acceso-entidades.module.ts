import { Module } from '@nestjs/common';
import { AccesoEntidadesService } from './acceso-entidades.service';

/**
 * PrismaModule es @Global, así que este módulo sólo publica el servicio.
 * Lo importan vehicles, trips y locations — los tres consumidores de
 * `users.entity_restrictions`.
 */
@Module({
  providers: [AccesoEntidadesService],
  exports: [AccesoEntidadesService],
})
export class AccesoEntidadesModule {}
