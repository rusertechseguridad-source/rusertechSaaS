import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { MonitoringModule } from './common/monitoring/monitoring.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { AvlUsersModule } from './avl-users/avl-users.module';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
import { conexionBull } from './common/config/redis-conexion';
import { soloConRedis } from './common/config/bull-opcional';
import { SimulatorModule } from './simulator/simulator.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { LocationsModule } from './locations/locations.module';
import { RoutesModule } from './routes/routes.module';
import { OperationsModule } from './operations/operations.module';
import { TripsModule } from './trips/trips.module';
import { CarriersModule } from './carriers/carriers.module';
import { DriversModule } from './drivers/drivers.module';
import { SensorsModule } from './sensors/sensors.module';
import { DevicesModule } from './devices/devices.module';
import { AlertsModule } from './alerts/alerts.module';
import { CarbonModule } from './carbon/carbon.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AdminModule } from './admin/admin.module';
import { SettingsModule } from './settings/settings.module';
import { ForwardingModule } from './forwarding/forwarding.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OperationalProtocolsModule } from './operational-protocols/operational-protocols.module';
import { SecurityKeysModule } from './security-keys/security-keys.module';
import { MotorModule } from './motor/motor.module';
import { InformesModule } from './informes/informes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Sin REDIS_URL, BullMQ directamente NO se registra: ninguna cola se
    // instancia y no hay conexiones que puedan fallar. La conexión centinela
    // anterior no alcanzaba — BullMQ abre varias conexiones por cola y no
    // todas heredan retryStrategy. Detalle en common/config/bull-opcional.ts.
    ...soloConRedis(BullModule.forRoot({ connection: conexionBull() as any })),
    PrismaModule,
    RedisModule,
    MonitoringModule,
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
    CarriersModule,
    DriversModule,
    SensorsModule,
    DevicesModule,
    AlertsModule,
    CarbonModule,
    AnalyticsModule,
    AdminModule,
    SettingsModule,
    ForwardingModule,
    NotificationsModule,
    OperationalProtocolsModule,
    SecurityKeysModule,
    MotorModule,
    InformesModule,
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
