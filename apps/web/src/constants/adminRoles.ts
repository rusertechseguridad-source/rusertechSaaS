/**
 * ROLES ADMINISTRATIVOS — espejo de `apps/api/src/common/constants/admin-roles.ts`.
 *
 * Antes el bypass de administrador estaba escrito con strings sueltos y
 * distintos en cada capa (`super_admin`, `SUPERADMIN`, `rusertech_admin`), y
 * sólo el último existe en el seed. Alcanzaba con crear un rol llamado
 * `super_admin` desde la pantalla de roles para obtener acceso total sin que
 * nadie lo hubiera decidido.
 *
 * Si se agrega un rol acá, agregarlo también del lado del backend.
 */
export const ADMIN_ROLES = ['rusertech_admin'] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Indica si un `role_code` tiene privilegios de administrador del sistema. */
export function isAdminRole(roleCode?: string | null): boolean {
  if (!roleCode) return false;
  return (ADMIN_ROLES as readonly string[]).includes(roleCode);
}
