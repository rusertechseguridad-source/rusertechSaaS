import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
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
    // `last_login_at` la mostraba el panel de administración y NADIE la
    // escribía: el panel hacía creer que el dato existía (auditoría, E3).
    // Fire-and-forget con rastro: el login no puede fallar porque falle esta
    // marca, pero el error tampoco se silencia — mismo patrón que
    // last_data_at en el ingest.
    this.prisma.user
      .update({ where: { id: user.id }, data: { last_login_at: new Date() } })
      .catch((err: any) =>
        this.logger.warn(`No se pudo registrar last_login_at de ${user.id}: ${err?.message ?? err}`),
      );

    const basePermissions = user.role?.permissions || [];
    const granted = user.granted_permissions || [];
    const revoked = user.revoked_permissions || [];
    const finalPermissions = Array.from(new Set([...basePermissions, ...granted])).filter(p => !revoked.includes(p));

    // Generar claims para el JWT
    const payload = { 
      email: user.email, 
      sub: user.id, 
      tenantId: user.tenant_id,
      role: user.role_code,
      permissions: finalPermissions
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        tenant_id: user.tenant_id,
        role: user.role_code,
        permissions: finalPermissions
      }
    };
  }
}
