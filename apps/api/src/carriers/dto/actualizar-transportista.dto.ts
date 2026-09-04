import { IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * PUT /api/v1/carriers/:id  ·  POST /api/v1/carriers
 *
 * Campos copiados de `model Carrier` en schema.prisma.
 * NO están: `id`, `tenant_id`, `created_at`.
 *
 * `fleet_size`, `insurance_info` y `notes` SÍ están: Gustavo agregó las tres
 * columnas por SQL (decisión de producto — un transportista lleva tamaño de
 * flota, datos del seguro y notas). Verificadas contra `information_schema` de
 * la base real: `integer`, `text`, `text`, las tres nullable.
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

  /**
   * ⚠️ Llega de un `<input>`, así que el navegador manda **string**: `"12"`,
   * no `12`. El `ValidationPipe` corre con `enableImplicitConversion: false`
   * —a propósito, para que `"no soy un número"` no se vuelva `NaN` y pase un
   * `@IsInt`— así que la conversión va acá, explícita y sólo para lo que de
   * verdad es numérico.
   *
   * El `''` del campo vacío se convierte en `null`, no en `0`: una flota de
   * tamaño desconocido no es una flota de cero camiones.
   */
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    const n = Number(value);
    // Si no es numérico se devuelve el valor original para que `@IsInt` lo
    // rechace con un mensaje claro, en vez de convertirlo en NaN.
    return Number.isFinite(n) ? n : value;
  })
  @IsOptional() @IsInt() @Min(0) @Max(100000)
  fleet_size?: number | null;

  @IsOptional() @IsString()
  insurance_info?: string | null;

  @IsOptional() @IsString()
  notes?: string | null;

  @IsOptional() @IsIn(['active', 'inactive', 'suspended'])
  status?: string;
}
