import { InternalServerErrorException, NotFoundException } from '@nestjs/common';

/**
 * AISLAMIENTO MULTI-TENANT — helper compartido.
 *
 * Por qué existe: hasta esta tanda, cada servicio decidía por su cuenta si
 * verificaba la pertenencia del recurso al tenant del usuario. Algunos lo
 * hacían (`carriers`, `drivers`, `devices`) y la mayoría no, de modo que un
 * usuario autenticado del Cliente A podía editar o borrar recursos del
 * Cliente B con sólo conocer un UUID.
 *
 * Reglas que impone este helper:
 *
 *  1. **El `tenantId` es obligatorio y se valida.** Es la trampa más peligrosa
 *     de Prisma: `where: { id, tenant_id: undefined }` NO filtra por tenant —
 *     Prisma descarta las claves `undefined` y la consulta queda como
 *     `where: { id }`. Un olvido en el controller se convertiría en una fuga
 *     silenciosa. Acá eso es un error explícito.
 *
 *  2. **404, nunca 403.** Un 403 confirmaría que el UUID existe en otro tenant;
 *     el 404 no filtra información: para el usuario, el recurso simplemente no
 *     existe.
 */

/** Porción del delegate de Prisma que necesita el helper. */
interface TenantScopedDelegate {
  findFirst(args: any): Promise<any>;
}

/**
 * Valida que el `tenantId` recibido sea utilizable como filtro.
 * Lanza 500 (no 404) porque un tenant vacío es un bug del backend, no una
 * situación que el usuario pueda provocar con datos válidos.
 */
export function requireTenantId(tenantId: string | undefined | null, contexto: string): string {
  if (typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new InternalServerErrorException(
      `Aislamiento multi-tenant: falta tenantId en ${contexto}. ` +
        'El controller debe propagar user.tenantId al servicio.',
    );
  }
  return tenantId;
}

/**
 * Construye un `where` scopeado por tenant, validando el tenantId.
 * Uso: `where: tenantWhere(tenantId, 'VehiclesService.findAll', { status: 'active' })`
 */
export function tenantWhere<T extends Record<string, any>>(
  tenantId: string | undefined | null,
  contexto: string,
  extra?: T,
): T & { tenant_id: string } {
  return {
    ...(extra ?? ({} as T)),
    tenant_id: requireTenantId(tenantId, contexto),
  };
}

/**
 * Verifica que el recurso `id` pertenezca a `tenantId` antes de operar sobre él.
 * Devuelve el registro mínimo encontrado (sólo `id`) o lanza 404.
 *
 * Uso típico antes de un update/delete:
 *
 *   await assertTenantOwnership(this.prisma.vehicle, id, tenantId, 'Vehículo');
 *   return this.prisma.vehicle.update({ where: { id }, data });
 *
 * El `update` posterior puede ir por `{ id }` sin riesgo: la pertenencia ya
 * quedó verificada en la misma request.
 */
export async function assertTenantOwnership(
  delegate: TenantScopedDelegate,
  id: string,
  tenantId: string | undefined | null,
  recurso: string,
  opciones?: {
    /**
     * Para recursos que no tienen `tenant_id` propio y heredan la pertenencia
     * de un padre. Recibe el tenant validado y devuelve la condición.
     * Ej. diccionario AVL: `(t) => ({ avl_user: { tenant_id: t } })`
     */
    via?: (tenantId: string) => Record<string, any>;
  },
): Promise<{ id: string }> {
  const scopedTenantId = requireTenantId(tenantId, `${recurso}#${id}`);

  const condicionTenant = opciones?.via
    ? opciones.via(scopedTenantId)
    : { tenant_id: scopedTenantId };

  const encontrado = await delegate.findFirst({
    where: { id, ...condicionTenant },
    select: { id: true },
  });

  // 404 y no 403: no confirmamos la existencia de recursos de otros tenants.
  if (!encontrado) throw new NotFoundException(`${recurso} no encontrado`);

  return encontrado;
}
