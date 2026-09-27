import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Atender una alerta desde la campana.
 *
 * ⚠️ Existe como DTO y no como `any` por la regla del cliquet (R7): el cuerpo
 * sin DTO sólo puede achicarse. Una ruta nueva que escribe en la base y recibe
 * un `body: any` es una ruta donde cualquier campo entra sin mirar.
 */
export class AtenderAvisoDto {
  /**
   * De qué tabla es la alerta. Son dos fuentes y hay que decir cuál: el mismo
   * uuid podría existir en las dos, y adivinar por «probá en una y si no en la
   * otra» convertiría un error de la pantalla en una escritura en otro lado.
   */
  @IsIn(['condicion', 'evento'])
  fuente!: 'condicion' | 'evento';

  /**
   * El paso del protocolo que se estaba ejecutando, si fue uno.
   * ⚠️ Etapa 3C-A: atender dejó de ser «silenciar» para ser «registrar».
   */
  @IsOptional()
  @IsUUID()
  paso_id?: string;

  /** Código del catálogo de resultados de ESE tipo de alerta. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  resultado_codigo?: string;

  /**
   * Texto libre. Es la otra vía válida para registrar.
   *
   * ⚠️ Ya no alcanza con dejarla vacía: hay que elegir un resultado O escribir
   * acá. La regla vive en `registroDiceAlgo` y en un CHECK de la tabla.
   */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  nota?: string;
}
