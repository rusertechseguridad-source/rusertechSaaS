import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { MailModule } from '../mail/mail.module';
import { LivePositionsModule } from '../common/live-positions/live-positions.module';

@Module({
  imports: [MailModule, LivePositionsModule],
  controllers: [VehiclesController],
  providers: [VehiclesService],
})
export class VehiclesModule {}
