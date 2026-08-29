import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * POST /api/v1/avl-users/:id/dictionary
 *
 * Campos copiados de `model AvlEventDictionary` en schema.prisma.
 * NO están: `id`, `avl_user_id`, `created_at`.
 *
 * `avl_user_id` lo pone el servicio desde el parámetro de la ruta, que ya pasó
 * por `assertAvlUserDelTenant`. Aceptarlo del cuerpo permitiría colgar una
 * entrada del diccionario de otro AVL user.
 *
 * `id` tampoco: el servicio hacía `{ ...data }` con el cuerpo crudo, así que el
 * cliente podía elegir el UUID de la fila. Con el DTO deja de poder.
 *
 * La pantalla (AvlEventDictionaryPage.tsx:39) manda seis: `category`,
 * `raw_code`, `event_type`, `description`, `triggers_alert`, `severity`.
 */
export class CrearEntradaDiccionarioDto {
  @IsString() @MaxLength(50)
  raw_code!: string;

  @IsString() @MaxLength(100)
  event_type!: string;

  @IsOptional() @IsString() @MaxLength(300)
  description?: string | null;

  @IsOptional() @IsBoolean()
  triggers_alert?: boolean;

  // El vocabulario que usa el formulario. `@db.VarChar(20)` sin CHECK en la
  // base: la restricción vive acá.
  @IsOptional() @IsIn(['info', 'warning', 'critical'])
  severity?: string;

  @IsOptional() @IsBoolean()
  is_active?: boolean;

  @IsOptional() @IsString() @MaxLength(100)
  category?: string;
}
