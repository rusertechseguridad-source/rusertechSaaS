/**
 * ROLES ADMINISTRATIVOS — fuente de verdad única.
 *
 * Antes, el bypass de administrador estaba escrito con strings sueltos y
 * distintos en cada capa: el backend aceptaba `rusertech_admin` o `super_admin`;
 * el frontend aceptaba además `SUPERADMIN`. Como ninguno de esos dos últimos
 * existe en el seed, alcanzaba con que alguien creara un rol llamado
 * `super_admin` desde la pantalla de roles para obtener acceso total sin que
 * nadie lo hubiera decidido.
 *
 * Ahora la lista es una sola y vive acá. El espejo en el frontend es
 * `apps/web/src/constants/adminRoles.ts`.
 */
export const ADMIN_ROLES = ['rusertech_admin'] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Indica si un `role_code` tiene privilegios de administrador del sistema. */
export function isAdminRole(roleCode?: string | null): boolean {
  if (!roleCode) return false;
  return (ADMIN_ROLES as readonly string[]).includes(roleCode);
}
