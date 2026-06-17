import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CarbonController } from './carbon.controller';
import { CarbonService } from './carbon.service';
import { CarbonProcessor } from './carbon.processor';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'carbon',
    }),
  ],
  controllers: [CarbonController],
  providers: [CarbonService, CarbonProcessor],
  exports: [CarbonService],
})
export class CarbonModule {}
