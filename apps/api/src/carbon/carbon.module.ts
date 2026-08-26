import { Module } from '@nestjs/common';
import { CarbonController } from './carbon.controller';
import { CarbonService } from './carbon.service';
import { CarbonProcessor } from './carbon.processor';
import { PrismaModule } from '../prisma/prisma.module';
import {
  colasOpcionales,
  proveedoresColasInertes,
  soloConRedis,
} from '../common/config/bull-opcional';

@Module({
  imports: [
    PrismaModule,
    // Sin REDIS_URL la cola no se registra; CarbonService ya avisa una única
    // vez en el constructor que el cálculo queda pausado.
    ...colasOpcionales('carbon'),
  ],
  controllers: [CarbonController],
  providers: [
    CarbonService,
    ...soloConRedis(CarbonProcessor),
    ...proveedoresColasInertes('carbon'),
  ],
  exports: [CarbonService],
})
export class CarbonModule {}
