import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '../../common/constants/permissions';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Declara los permisos necesarios para ejecutar el handler.
 *
 * El tipo `PermissionKey` obliga a que el permiso exista en el catálogo
 * canónico (`common/constants/permissions.ts`): un string inventado ya no
 * compila. Antes se aceptaba cualquier `string`, y por eso convivían
 * decoradores con formatos (`vehicles:manage`) que la base nunca otorgaba.
 */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
