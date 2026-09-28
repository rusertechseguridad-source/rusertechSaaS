import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { isAdminRole } from '../../common/constants/admin-roles';

/**
 * El motivo del rechazo: qué rol hace falta.
 *
 * ⚠️ Nombra sólo los roles de CLIENTE que la ruta admite. El de plataforma
 * (`ADMIN_ROLES`) se deja afuera: un cliente no lo puede pedir, y nombrarlo es
 * contarle cómo está armada la administración del sistema. Si la ruta es sólo
 * de plataforma, se dice eso y nada más.
 *
 * Los roles van por su código (`account_owner`): el nombre legible vive en la
 * tabla `roles`, y leerla en cada rechazo para armar un mensaje sería una
 * consulta en el camino de toda ruta protegida.
 */
export function motivoSinRol(requeridos: string[]): string {
  const deCliente = requeridos.filter((r) => !isAdminRole(r)).map((r) => `«${r}»`);
  if (deCliente.length === 0) return 'Esta acción es de la administración de la plataforma.';
  return deCliente.length === 1
    ? `Esta acción es del rol ${deCliente[0]}.`
    : `Esta acción es de los roles ${deCliente.join(' o ')}.`;
}

/**
 * ⚠️ RECHAZA CON MOTIVO, no con `false`. Mismo motivo que `PermissionsGuard`:
 * con `false` Nest responde «Forbidden resource» y la pantalla lo mostraba
 * tal cual. El código sigue siendo 403.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    // Validar si el usuario tiene uno de los roles requeridos
    if (user && requiredRoles.includes(user.role)) {
      return true;
    }
    throw new ForbiddenException(motivoSinRol(requiredRoles));
  }
}
