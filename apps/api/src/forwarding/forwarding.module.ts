import { Module } from '@nestjs/common';
import { ForwardingController } from './forwarding.controller';
import { ForwardingService } from './forwarding.service';
import { ForwardingProcessor } from './forwarding.processor';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'forwarding.send',
    }),
  ],
  controllers: [ForwardingController],
  providers: [ForwardingService, ForwardingProcessor],
})
export class ForwardingModule {}
