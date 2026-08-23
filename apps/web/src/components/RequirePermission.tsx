import React from 'react';
import { useAuthStore } from '../store/authStore';
import { isAdminRole } from '../constants/adminRoles';
import type { PermissionKey } from '../constants/permissions';

/**
 * Muestra sus hijos sólo si el usuario tiene el permiso indicado.
 *
 * El permiso está tipado contra el catálogo canónico (`constants/permissions`),
 * que usa el mismo formato `accion_recurso` que la tabla `roles`, el JWT y los
 * decoradores del backend. Antes convivían formatos distintos entre el menú y
 * los guards, así que la UI mostraba acciones que la API rechazaba (y al revés).
 *
 * Nota: esto es sólo presentación. La autorización real la aplica
 * `PermissionsGuard` en el backend.
 */
export const RequirePermission: React.FC<{
  permission: PermissionKey;
  children: React.ReactNode;
}> = ({ permission, children }) => {
  const { user } = useAuthStore();

  if (!user) return null;

  // Administradores del sistema: lista única en constants/adminRoles.
  if (isAdminRole(user.role || user.role_code)) return <>{children}</>;

  if (!Array.isArray(user.permissions)) return null;

  const hasPermission = user.permissions.includes('*') || user.permissions.includes(permission);

  if (!hasPermission) return null;

  return <>{children}</>;
};
