import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { IdOpcional } from '../../common/dto/id-opcional.decorator';

/**
 * PUT /api/v1/devices/:id  ·  POST /api/v1/devices
 *
 * Campos copiados de `model Device` en schema.prisma.
 * NO están: `id`, `tenant_id`, `created_at`, `updated_at`.
 *
 * La pantalla (DevicesPage.tsx:68-74) manda seis: `name`, `imei`, `device_code`,
 * `device_type`, `status`, `avl_user_id`. Todos existen.
 *
 * `battery_level` y `signal_strength` se declaran aunque ninguna pantalla los
 * mande: son columnas reales que **hoy nadie escribe** —por eso la Fase E las
 * sacó de la pantalla, que las mostraba siempre vacías— y el día que el ingest
 * empiece a llenarlas, esta ruta no debe descartarlas en silencio.
 */
export class ActualizarDispositivoDto {
  @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @IsOptional() @IsString() @MaxLength(50)
  imei?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  device_code?: string | null;

  @IsOptional() @IsString() @MaxLength(50)
  device_type?: string;

  // Mayúsculas: así lo escribe el esquema (`@default("ACTIVE")`) y así lo manda
  // la pantalla. Verificado contra el `default` de la columna, no de memoria.
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE', 'MAINTENANCE'])
  status?: string;

  @IdOpcional()
  avl_user_id?: string | null;

  @IdOpcional()
  operation_id?: string | null;

  @IsOptional() @IsInt() @Min(0) @Max(100)
  battery_level?: number | null;

  @IsOptional() @IsInt() @Min(0) @Max(100)
  signal_strength?: number | null;
}
