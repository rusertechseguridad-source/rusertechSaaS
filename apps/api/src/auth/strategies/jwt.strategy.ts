import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'rusertech-super-secret-key-2026',
    });
  }

  async validate(payload: any) {
    // Este payload se inyecta en req.user
    return { 
      id: payload.sub, 
      email: payload.email, 
      tenantId: payload.tenantId, 
      role: payload.role,
      permissions: payload.permissions || []
    };
  }
}
