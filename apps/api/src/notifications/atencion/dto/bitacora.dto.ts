import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * Los cuerpos de la bitácora, como DTO y no como `any`.
 *
 * ⚠️ Es la regla del cliquet (R7): el cuerpo sin DTO sólo puede achicarse.
 * Tres rutas nuevas que escriben en la base con `body: any` serían tres
 * lugares donde cualquier campo entra sin mirar.
 */

/** De qué tabla es la alerta. Son dos fuentes y hay que decir cuál. */
export class FuenteDto {
  @IsIn(['condicion', 'evento'])
  fuente!: 'condicion' | 'evento';
}

/**
 * Registrar una entrada — lo que hace `Atender`.
 *
 * ⚠️ NO hay `@IsNotEmpty` cruzado entre `resultado_codigo` y `nota`: vale
 * cualquiera de los dos y `class-validator` no expresa bien ese «o». La regla
 * la aplica `registroDiceAlgo`, que además está probada sola, y el CHECK de
 * la tabla la sostiene por debajo. Un decorador que sólo cubriera la mitad
 * del caso sería peor que ninguno, porque parecería que la cubre entera.
 */
export class RegistrarAtencionDto extends FuenteDto {
  /** El paso del protocolo que se estaba ejecutando, si fue uno. */
  @IsOptional()
  @IsUUID()
  paso_id?: string;

  /** Código del catálogo de resultados de ESE tipo de alerta. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  resultado_codigo?: string;

  /** Texto libre. La otra vía válida para registrar. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  nota?: string;
}

/** Escalar: el destino lo decide el servidor, no el cuerpo. */
export class EscalarDto extends FuenteDto {
  /**
   * ⚠️ NO hay campo `escalado_a`. El destino sale de la jerarquía y no de lo
   * que mande el navegador: si viniera en el cuerpo, cualquiera podría
   * escalarle a quien quisiera —o a sí mismo— y la cadena de mando sería una
   * sugerencia.
   */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  nota?: string;
}

/** Cerrar: el motivo es obligatorio y no puede ser un espacio. */
export class CerrarAlertaDto extends FuenteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  motivo!: string;
}
