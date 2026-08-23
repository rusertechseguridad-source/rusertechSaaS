import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { getRequiredSecret } from '../common/config/secrets';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      // Sin fallback hardcodeado: el secreto se valida al arrancar y, si falta,
      // la aplicación no levanta. `registerAsync` difiere la lectura hasta que
      // el módulo se inicializa, para que el error salga por el mismo camino
      // que el resto de la validación de configuración.
      useFactory: () => ({
        secret: getRequiredSecret('JWT_SECRET'),
        signOptions: { expiresIn: '12h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
