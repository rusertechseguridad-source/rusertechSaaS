import { Module } from '@nestjs/common';
import { SecurityKeysController } from './security-keys.controller';
import { SecurityKeysService } from './security-keys.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SecurityKeysController],
  providers: [SecurityKeysService],
  exports: [SecurityKeysService],
})
export class SecurityKeysModule {}
