import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { IdOpcional } from '../../common/dto/id-opcional.decorator';

/**
 * PUT /api/v1/drivers/:id  ·  POST /api/v1/drivers
 *
 * Campos copiados de `model Driver` en schema.prisma.
 * NO están: `id`, `tenant_id`, `created_at`.
 *
 * ⚠️ La pantalla manda TRES campos que no son columnas de esta tabla:
 * `email`, `address` y `notes` (DriverModal.tsx:110-112). No los agrego —
 * agregarlos sería declarar columnas que no existen y el `update` reventaría
 * igual, sólo que más adentro. Lo que cambia con esta tanda es CÓMO falla:
 *
 *   antes → 500 mudo desde Prisma ("Unknown argument `email`")
 *   ahora → 400 nombrando exactamente los tres campos sobrantes
 *
 * Y sólo falla si el operador los completa: el formulario los manda como
 * `undefined` cuando están vacíos, y `JSON.stringify` descarta esas claves,
 * así que nunca llegan al servidor. Que esos tres campos existan como columnas
 * o desaparezcan del formulario es una decisión de producto → Tanda 6.
 */
export class ActualizarConductorDto {
  @IsOptional() @IsString() @MaxLength(200)
  full_name?: string;

  @IsOptional() @IsString() @MaxLength(50)
  document?: string | null;

  @IsOptional() @IsString() @MaxLength(20)
  document_type?: string | null;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string | null;

  @IsOptional() @IsString() @MaxLength(50)
  license_number?: string | null;

  // @db.Date. La pantalla manda ISO completo (`new Date(x).toISOString()`),
  // que `IsDateString` acepta y Prisma trunca al guardar.
  @IsOptional() @IsDateString()
  license_expiry?: string | null;

  @IdOpcional()
  carrier_id?: string | null;

  @IsOptional() @IsString() @MaxLength(500)
  document_image_url?: string | null;

  // Los tres valores que produce el sistema hoy. La Fase E ya midió que el
  // vocabulario real incluye 'suspended' e 'inactive', no sólo 'active'.
  @IsOptional() @IsIn(['active', 'inactive', 'suspended'])
  status?: string;
}
