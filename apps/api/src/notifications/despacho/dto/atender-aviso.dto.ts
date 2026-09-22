import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

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

  /** Lo que el operador quiera dejar dicho. Va a `nota` / `resolution_note`. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nota?: string;
}
