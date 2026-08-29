import {
  IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString,
  Max, MaxLength, Min,
} from 'class-validator';
import { IdOpcional } from '../../common/dto/id-opcional.decorator';

/**
 * PUT /api/v1/vehicles/:id
 *
 * Campos copiados de `model Vehicle` en schema.prisma, uno por uno.
 * NO están, a propósito: `id`, `tenant_id`, `created_at`, `updated_at`.
 *
 * `tenant_id` es el que motivó esta tanda: `vehicles.update` pasaba el cuerpo
 * crudo a Prisma, así que un `tenant_id` en el JSON **movía el vehículo a otro
 * cliente**. No era una lectura indebida: era una transferencia de propiedad.
 *
 * La pantalla (VehiclesPage.tsx:198-213) manda 14 de estos campos; los otros
 * cuatro (`year`, `group_id`, `status`, `metadata_json`) son columnas reales que
 * hoy ningún formulario envía. Se declaran igual porque son escribibles y
 * legítimas: omitirlas haría que, el día que la pantalla las mande, el
 * `whitelist` las descarte SIN AVISAR.
 *
 * `is_blocked` y `block_reason` NO van acá: tienen su propia ruta
 * (`PATCH /vehicles/:id/block`), que además registra el evento de bloqueo.
 */
export class ActualizarVehiculoDto {
  @IsOptional() @IsString() @MaxLength(20)
  plate?: string;

  @IsOptional() @IsString() @MaxLength(100)
  alias?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  brand?: string | null;

  @IsOptional() @IsString() @MaxLength(200)
  model?: string | null;

  // @db.SmallInt: el rango se acota acá para que un año absurdo dé 400 y no un
  // error de rango de Postgres convertido en 500.
  @IsOptional() @IsInt() @Min(1900) @Max(2100)
  year?: number | null;

  @IsOptional() @IsString() @MaxLength(50)
  vehicle_type?: string;

  @IsOptional() @IsString() @MaxLength(30)
  fuel_type?: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 })
  fuel_efficiency_lper100km?: number | null;

  @IsOptional() @IsString() @MaxLength(100)
  hub_asset_id?: string | null;

  @IdOpcional()
  avl_user_id?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  dictionary_category?: string | null;

  @IdOpcional()
  carrier_id?: string | null;

  @IdOpcional()
  group_id?: string | null;

  @IsOptional() @IsString() @MaxLength(500)
  image_front_url?: string | null;

  @IsOptional() @IsString() @MaxLength(500)
  image_rear_url?: string | null;

  @IsOptional() @IsString() @MaxLength(500)
  image_side_url?: string | null;

  // Los dos valores que el propio backend escribe (`remove()` pone 'inactive').
  @IsOptional() @IsIn(['active', 'inactive'])
  status?: string;

  @IsOptional() @IsObject()
  metadata_json?: Record<string, unknown>;
}
