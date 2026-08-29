import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * PUT /api/v1/settings/users/:id
 *
 * Campos copiados de `model User` en schema.prisma, restringidos a los que un
 * `account_owner` puede tocar sobre otro usuario de SU tenant.
 *
 * NO están, y cada ausencia es deliberada:
 *   · `id`, `tenant_id`, `created_at`, `last_login_at` → identidad y auditoría.
 *   · `password_hash` → jamás por el cuerpo de una petición.
 *   · `email` → es la clave de login y es `@unique`; cambiarla es otra operación.
 *   · `granted_permissions` / `revoked_permissions` → sobrescriben el rol
 *     permiso por permiso. Que estén en el esquema no significa que se editen
 *     desde este formulario; hoy ninguna pantalla los manda.
 *   · `parent_user_id` → reasignar la jerarquía desde acá no tiene pantalla.
 *
 * `role_code` SÍ está —la pantalla lo manda y es su función— pero **el DTO no
 * alcanza para protegerlo**: valida que sea un string, no CUÁL string. La regla
 * de qué rol se puede asignar vive en `roles-asignables.ts` y la aplica el
 * controller. Un `@IsIn` acá sería una cuarta copia de la lista de roles.
 *
 * La pantalla manda `{ role_code, full_name, entity_restrictions }`
 * (SettingsPage.tsx:195) y, desde el selector rápido, sólo `{ role_code }` (:182).
 */
export class ActualizarUsuarioDto {
  @IsOptional() @IsString() @MaxLength(50)
  role_code?: string;

  @IsOptional() @IsString() @MaxLength(200)
  full_name?: string | null;

  // `Json @default("{}")`. El contenido lo interpreta `interpretarRestricciones`,
  // que ya distingue "sin restricción" de "ilegible" y falla cerrado.
  // `Record<string, any>` y no `unknown`: el tipo de entrada JSON de Prisma no
  // acepta `unknown` en los valores, y este objeto se pasa tal cual al `update`.
  @IsOptional() @IsObject()
  entity_restrictions?: Record<string, any>;

  @IsOptional() @IsString() @MaxLength(30)
  contact_type?: string | null;

  // `status` se cambia por `PATCH /settings/users/:id/toggle`, que es la ruta
  // que la pantalla usa. Se declara para no romperla si algún día manda el
  // campo por acá, con el vocabulario real medido en la Fase E.
  @IsOptional() @IsIn(['active', 'suspended', 'inactive'])
  status?: string;
}
