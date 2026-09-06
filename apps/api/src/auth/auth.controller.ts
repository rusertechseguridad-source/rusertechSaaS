import { Controller, Post, UseGuards, Request, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { LimitePeticionesGuard, LimitarPeticiones } from '../common/guards/limite-peticiones.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService
  ) {}

  // ⚠️ EL ORDEN DE LOS GUARDS IMPORTA: el límite va PRIMERO. Si fuera después
  // de `LocalAuthGuard`, cada intento bloqueado igual habría ejecutado la
  // consulta del usuario y el `bcrypt.compare` — que es caro a propósito— y el
  // límite protegería la contraseña pero no al servidor.
  //
  // 10 intentos cada 5 minutos por origen: un humano que se equivoca de
  // contraseña tres o cuatro veces no lo nota; una lista de contraseñas
  // comunes muere en el intento once.
  @UseGuards(LimitePeticionesGuard, LocalAuthGuard)
  @LimitarPeticiones({ nombre: 'login', intentos: 10, ventanaSegundos: 300 })
  @Post('login')
  async login(@Request() req: any) {
    // req.user viene seteado por LocalStrategy después de validar email y pass
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: any) {
    // Buscar el usuario fresco de la base de datos
    const freshUser = await this.usersService.findByEmail(user.email);
    if (!freshUser) return user; // fallback
    
    // Recalcular permisos
    const basePermissions = freshUser.role?.permissions || [];
    const granted = freshUser.granted_permissions || [];
    const revoked = freshUser.revoked_permissions || [];
    const finalPermissions = Array.from(new Set([...basePermissions, ...granted])).filter(p => !revoked.includes(p as string));

    return {
      id: freshUser.id,
      email: freshUser.email,
      full_name: freshUser.full_name,
      tenant_id: freshUser.tenant_id,
      role: freshUser.role_code,
      permissions: finalPermissions
    };
  }
}
