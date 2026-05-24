import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(pass, user.password_hash))) {
      // Devolvemos el usuario sin el password_hash
      const { password_hash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    // Generar claims para el JWT
    const payload = { 
      email: user.email, 
      sub: user.id, 
      tenantId: user.tenant_id,
      role: user.role_code,
      permissions: user.role?.permissions || []
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        tenant_id: user.tenant_id,
        role: user.role_code,
        permissions: user.role?.permissions || []
      }
    };
  }
}
