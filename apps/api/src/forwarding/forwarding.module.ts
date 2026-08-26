import { Module } from '@nestjs/common';
import { ForwardingController } from './forwarding.controller';
import { ForwardingService } from './forwarding.service';
import { ForwardingProcessor } from './forwarding.processor';
import {
  colasOpcionales,
  proveedoresColasInertes,
  soloConRedis,
} from '../common/config/bull-opcional';

@Module({
  imports: [
    // Sin REDIS_URL la cola no se registra: el reenvío queda en el outbox de
    // Postgres (pendiente), que es exactamente lo que el guarda del
    // outbox-processor ya documenta.
    ...colasOpcionales('forwarding.send'),
  ],
  controllers: [ForwardingController],
  providers: [
    ForwardingService,
    ...soloConRedis(ForwardingProcessor),
    ...proveedoresColasInertes('forwarding.send'),
  ],
})
export class ForwardingModule {}
