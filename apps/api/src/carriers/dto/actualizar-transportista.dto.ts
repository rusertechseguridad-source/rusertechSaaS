import { IsEmail, IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/**
 * PUT /api/v1/carriers/:id  ·  POST /api/v1/carriers
 *
 * Campos copiados de `model Carrier` en schema.prisma.
 * NO están: `id`, `tenant_id`, `created_at`.
 *
 * ⚠️ Igual que en conductores, la pantalla manda TRES campos inexistentes:
 * `fleet_size`, `insurance_info` y `notes` (CarrierModal.tsx:84-86). Mismo
 * criterio: no se declaran, y el fallo pasa de un 500 mudo a un 400 que los
 * nombra. → Tanda 6.
 *
 * `operating_bases` es `String?` sin límite en el esquema (texto largo), por eso
 * es el único sin `@MaxLength`.
 */
export class ActualizarTransportistaDto {
  @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @IsOptional() @IsString() @MaxLength(50)
  tax_id?: string | null;

  @IsOptional() @IsString() @MaxLength(200)
  contact_name?: string | null;

  // ⚠️ `@IsOptional()` NO alcanza acá. Sólo saltea `null` y `undefined`, y el
  // formulario manda `contact_email: contactEmail` en crudo — o sea `''` cuando
  // el operador no lo completa. Con sólo `@IsEmail` esto rechazaría el alta de
  // un transportista sin correo, que es legítima. `@ValidateIf` deja pasar el
  // vacío y valida el formato únicamente cuando hay algo escrito.
  @ValidateIf((o) => o.contact_email !== '' && o.contact_email !== null && o.contact_email !== undefined)
  @IsEmail({}, { message: 'contact_email debe ser un correo válido' })
  @MaxLength(254)
  contact_email?: string | null;

  @IsOptional() @IsString() @MaxLength(50)
  contact_phone?: string | null;

  @IsOptional() @IsString() @MaxLength(300)
  address?: string | null;

  @IsOptional() @IsString() @MaxLength(500)
  google_maps_link?: string | null;

  @IsOptional() @IsString()
  operating_bases?: string | null;

  @IsOptional() @IsIn(['active', 'inactive', 'suspended'])
  status?: string;
}
