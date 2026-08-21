import { Module } from '@nestjs/common';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule, TelemetryModule],
  controllers: [MobileController],
  providers: [MobileService],
  exports: [MobileService],
})
export class MobileModule {}
