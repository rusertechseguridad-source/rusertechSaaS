import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

/**
 * Sin providers propios: el chequeo se apoya en los servicios que ya existen.
 * Lo único que aporta este módulo es la ruta.
 */
@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [HealthController],
})
export class HealthModule {}
