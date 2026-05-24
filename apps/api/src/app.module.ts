import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { AvlUsersModule } from './avl-users/avl-users.module';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
import { SimulatorModule } from './simulator/simulator.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { LocationsModule } from './locations/locations.module';
import { RoutesModule } from './routes/routes.module';
import { OperationsModule } from './operations/operations.module';
import { TripsModule } from './trips/trips.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: (() => {
        let connectionUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        if (connectionUrl.startsWith('https://')) {
          const url = new URL(connectionUrl);
          const host = url.host;
          const password = process.env.REDIS_TOKEN || '';
          connectionUrl = `rediss://default:${password}@${host}:6379`;
        }
        return { url: connectionUrl };
      })(),
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    TelemetryModule,
    AvlUsersModule,
    SimulatorModule,
    VehiclesModule,
    LocationsModule,
    RoutesModule,
    OperationsModule,
    TripsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
})
export class AppModule {}
