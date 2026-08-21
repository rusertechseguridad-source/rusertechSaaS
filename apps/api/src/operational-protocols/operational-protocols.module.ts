import { Module } from '@nestjs/common';
import { OperationalProtocolsController } from './operational-protocols.controller';
import { OperationalProtocolsService } from './operational-protocols.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OperationalProtocolsController],
  providers: [OperationalProtocolsService],
  exports: [OperationalProtocolsService],
})
export class OperationalProtocolsModule {}
