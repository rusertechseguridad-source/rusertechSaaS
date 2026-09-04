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

/**
 * La misma decisión que `RequirePermission`, como valor.
 *
 * Existe para poder DESHABILITAR un botón en vez de esconderlo. Es una
 * decisión deliberada y sigue el criterio del propio proyecto:
 *
 *   > "un botón ausente es indistinguible de una función que no existe"
 *
 * Un botón escondido le enseña al operador que la función no existe; uno
 * deshabilitado, con un título que dice por qué, le enseña que existe y que le
 * falta permiso — que es la verdad, y es accionable: puede pedírselo a su
 * administrador.
 *
 * Se esconde, en cambio, lo que no tiene sentido ni mencionar (una pantalla
 * entera de otro módulo). Para eso está `RequirePermission`.
 */
export function useTienePermiso(permission: PermissionKey): boolean {
  const { user } = useAuthStore();
  if (!user) return false;
  if (isAdminRole(user.role ?? (user as any).role_code)) return true;
  return (user.permissions ?? []).includes(permission);
}

/** Título uniforme para un control deshabilitado por falta de permiso. */
export const SIN_PERMISO = 'No tenés permiso para esta acción. Pedísela al administrador de la cuenta.';

/**
 * El mismo motivo, nombrando el permiso cuando se lo conoce.
 *
 * Nombrarlo no es un detalle técnico: el operador le pide el permiso a su
 * administrador, y el administrador tiene que saber cuál habilitar. "No tenés
 * permiso" a secas obliga a adivinar entre veinte.
 */
export function motivoSinPermiso(permission?: string): string {
  if (!permission) return SIN_PERMISO;
  return `${SIN_PERMISO} Requiere el permiso ${permission}.`;
}

/**
 * Clases del estado deshabilitado, en un solo lugar.
 *
 * Un botón deshabilitado tiene que VERSE deshabilitado. Sin esto queda idéntico
 * a uno habilitado y el operador cree que la pantalla no responde.
 */
export const CLASES_DESHABILITADO = 'disabled:opacity-40 disabled:cursor-not-allowed';

/**
 * Props de un control de escritura sujeto a permiso.
 *
 * Devuelve `disabled` y `title` juntos porque van juntos siempre: deshabilitar
 * sin decir por qué es la mitad del problema que estamos corrigiendo.
 *
 * `tituloHabilitado` es el tooltip normal del control (el que ya tenía cuando
 * el permiso está); si no hay, queda sin tooltip.
 */
export function propsSinPermiso(
  tienePermiso: boolean,
  permission?: string,
  tituloHabilitado?: string,
): { disabled: boolean; title: string | undefined } {
  return {
    disabled: !tienePermiso,
    title: tienePermiso ? tituloHabilitado : motivoSinPermiso(permission),
  };
}
