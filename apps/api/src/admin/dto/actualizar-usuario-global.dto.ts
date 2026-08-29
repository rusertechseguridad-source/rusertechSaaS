import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { SonPermisosDelCatalogo } from '../../common/dto/permisos.validator';

/**
 * PUT /api/v1/admin/users/:id
 *
 * El servicio ya copiaba campo por campo (`updateUserGlobal` arma `updateData`
 * con cuatro `if`), así que no había asignación masiva. Lo que faltaba era
 * validar el CONTENIDO: `granted_permissions` y `revoked_permissions` entraban
 * como vinieran, y un permiso inventado se guardaba sin que nadie lo notara.
 *
 * `role_code` va sin `@IsIn`: la regla la aplica `roles-asignables.ts`, que
 * desde la corrección de la Tanda 3 cubre también esta ruta.
 */
export class ActualizarUsuarioGlobalDto {
  @IsOptional() @IsString() @MaxLength(50)
  role_code?: string;

  @IsOptional() @IsIn(['active', 'suspended', 'inactive'])
  status?: string;

  @IsOptional() @SonPermisosDelCatalogo()
  granted_permissions?: string[];

  @IsOptional() @SonPermisosDelCatalogo()
  revoked_permissions?: string[];
}
