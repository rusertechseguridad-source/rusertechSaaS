import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * POST /api/v1/settings/users/invite
 *
 * Quedó sin DTO en la Tanda 3 porque el encargo nombraba otros seis handlers.
 * La regla de roles ya lo cubría —es la puerta por la que un `account_owner`
 * invitaba un `rusertech_admin` y entraba con esa cuenta— pero el resto del
 * cuerpo seguía llegando crudo a `prisma.user.create`.
 *
 * NO están: `tenant_id` (lo pone el servicio), `password_hash` (se genera),
 * `status`, `granted_permissions`, `revoked_permissions` y `entity_restrictions`:
 * una invitación crea al usuario con su rol, y los ajustes finos se hacen
 * después por `PUT /settings/users/:id`, que sí tiene pantalla.
 *
 * `role_code` va sin `@IsIn`: qué rol se puede asignar lo decide
 * `roles-asignables.ts`, y una lista acá sería una copia más.
 */
export class InvitarUsuarioDto {
  @IsEmail({}, { message: 'email debe ser un correo válido' })
  @MaxLength(254)
  email!: string;

  @IsString() @MinLength(1) @MaxLength(200)
  full_name!: string;

  @IsString() @MaxLength(50)
  role_code!: string;

  @IsOptional() @IsString() @MaxLength(30)
  contact_type?: string | null;
}
