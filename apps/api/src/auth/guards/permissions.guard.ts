import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { WILDCARD_PERMISSION, type PermissionKey } from '../../common/constants/permissions';
import { isAdminRole } from '../../common/constants/admin-roles';

/**
 * Autoriza el handler comparando los permisos declarados con los que trae el
 * JWT. Ambos lados usan ahora el mismo formato canónico (`accion_recurso`),
 * que es el que guarda la tabla `roles`.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Handler sin decorador: la autorización queda a cargo de JwtAuthGuard.
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !Array.isArray(user.permissions)) {
      return false;
    }

    // Administradores del sistema: única lista, en common/constants/admin-roles.
    if (isAdminRole(user.role)) {
      return true;
    }

    // Comodín histórico. Ningún rol del seed lo usa, pero se respeta si existe.
    if (user.permissions.includes(WILDCARD_PERMISSION)) {
      return true;
    }

    return requiredPermissions.some((permission) => user.permissions.includes(permission));
  }
}
