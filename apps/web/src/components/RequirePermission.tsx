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
  /**
   * Qué mostrar cuando falta el permiso. Por defecto no muestra nada, que es lo
   * correcto para un botón: esconderlo alcanza y explicarlo sería ruido.
   *
   * Para una **pantalla entera** hay que pasar un mensaje. Sin él, el usuario ve
   * un área en blanco sin ninguna pista de que le falta un permiso, y lo
   * interpreta —con razón— como que la pantalla está rota.
   */
  fallback?: React.ReactNode;
}> = ({ permission, children, fallback = null }) => {
  const { user } = useAuthStore();

  if (!user) return <>{fallback}</>;

  // Administradores del sistema: lista única en constants/adminRoles.
  if (isAdminRole(user.role || user.role_code)) return <>{children}</>;

  if (!Array.isArray(user.permissions)) return <>{fallback}</>;

  const hasPermission = user.permissions.includes('*') || user.permissions.includes(permission);

  if (!hasPermission) return <>{fallback}</>;

  return <>{children}</>;
};

/**
 * Aviso estándar de permiso faltante, para usar como `fallback` en pantallas
 * completas. Nombra el permiso: sin eso, el administrador que tiene que
 * habilitarlo no sabe cuál buscar.
 */
export const SinPermiso: React.FC<{ permission: string }> = ({ permission }) => (
  <div className="bg-bgSurface border border-borderDefault rounded-xl p-6 text-center">
    <p className="text-white font-bold mb-1">No tenés permiso para ver esta sección</p>
    <p className="text-textMuted text-sm">
      Requiere el permiso <span className="font-mono text-textSecondary">{permission}</span>.
      Pedíselo al propietario de la cuenta.
    </p>
  </div>
);
