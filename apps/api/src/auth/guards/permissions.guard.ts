import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import {
  SYSTEM_PERMISSIONS, WILDCARD_PERMISSION, type PermissionKey,
} from '../../common/constants/permissions';
import { isAdminRole } from '../../common/constants/admin-roles';

/**
 * El motivo del rechazo: el permiso que FALTA, con su nombre del catálogo.
 *
 * ⚠️ Nombra lo que la ruta exige y nada más. No enumera los permisos que
 * existen ni los que el usuario tiene: eso es el mapa de autorización del
 * sistema, y a quien lo rechazan le alcanza con saber qué pedir.
 */
export function motivoSinPermiso(requeridos: PermissionKey[]): string {
  const nombres = requeridos.map((p) => `«${SYSTEM_PERMISSIONS[p] ?? p}»`);
  return nombres.length === 1
    ? `Necesitás el permiso ${nombres[0]}. Pedíselo a quien administra tu cuenta.`
    : `Necesitás alguno de estos permisos: ${nombres.join(' o ')}. Pedíselo a quien administra tu cuenta.`;
}

/**
 * Autoriza el handler comparando los permisos declarados con los que trae el
 * JWT. Ambos lados usan ahora el mismo formato canónico (`accion_recurso`),
 * que es el que guarda la tabla `roles`.
 *
 * ⚠️ RECHAZA CON MOTIVO, no con `false`. Devolver `false` hace que Nest
 * responda «Forbidden resource», y la pantalla lo mostraba tal cual: un
 * rechazo sin motivo es indistinguible de una función rota. El código sigue
 * siendo 403 — el frontend decide por el código, no por el texto (medido:
 * nada en el repositorio compara contra «Forbidden resource»).
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
      throw new ForbiddenException('Tu sesión no trae permisos. Iniciá sesión nuevamente.');
    }

    // Administradores del sistema: única lista, en common/constants/admin-roles.
    if (isAdminRole(user.role)) {
      return true;
    }

    // Comodín histórico. Ningún rol del seed lo usa, pero se respeta si existe.
    if (user.permissions.includes(WILDCARD_PERMISSION)) {
      return true;
    }

    if (requiredPermissions.some((permission) => user.permissions.includes(permission))) {
      return true;
    }
    throw new ForbiddenException(motivoSinPermiso(requiredPermissions));
  }
}
