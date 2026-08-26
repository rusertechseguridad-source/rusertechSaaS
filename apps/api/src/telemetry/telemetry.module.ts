import { Module } from '@nestjs/common';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';
import { GeocodingService } from './geocoding.service';
import { OutboxProcessorService } from './outbox-processor.service';
import { RiskLevelProcessor } from './risk-level.processor';
import {
  colasOpcionales,
  proveedoresColasInertes,
  soloConRedis,
} from '../common/config/bull-opcional';

@Module({
  imports: [
    // Sin REDIS_URL las colas no se registran (ver bull-opcional.ts): la
    // inyección de @InjectQueue la cubren las colas inertes de abajo.
    ...colasOpcionales('telemetry.raw', 'forwarding.send'),
  ],
  controllers: [TelemetryController],
  providers: [
    TelemetryService,
    GeocodingService,
    OutboxProcessorService,
    // Cada @Processor crea un Worker con conexiones propias a Redis; sin
    // REDIS_URL no se registra. (RiskLevelProcessor además está marcado para
    // retiro: su payload camelCase nunca coincide con el snake_case real.)
    ...soloConRedis(RiskLevelProcessor),
    ...proveedoresColasInertes('telemetry.raw', 'forwarding.send'),
  ],
  // GeocodingService lo usa también el motor (dirección de las excursiones al
  // calcular la serie): se exporta para no duplicar el provider ni su caché.
  exports: [TelemetryService, GeocodingService],
})
export class TelemetryModule {}
