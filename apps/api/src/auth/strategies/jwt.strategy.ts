import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { getRequiredSecret } from '../../common/config/secrets';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Sin valor por defecto: antes había un secreto hardcodeado en el repo,
      // con el que cualquiera que leyera el código podía firmar tokens válidos.
      // Si falta la variable, la aplicación no arranca (ver common/config/secrets).
      secretOrKey: getRequiredSecret('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // Este payload se inyecta en req.user
    return {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      role: payload.role,
      permissions: payload.permissions || [],
    };
  }
}
