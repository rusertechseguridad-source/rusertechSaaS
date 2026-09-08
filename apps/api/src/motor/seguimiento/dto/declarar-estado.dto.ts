import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * POST /api/v1/trips/:tripId/seguimiento
 *
 * ⚠️ ESTA CLASE NO ES CEREMONIA. El `ValidationPipe` **sólo valida cuando el
 * parámetro está tipado con una clase**: donde dice `@Body() data: any` el
 * metatipo es `Object` y el pipe no hace absolutamente nada. Es el hallazgo que
 * la Tanda 8 dejó congelado en un cliquet, y una ruta nueva sin DTO haría subir
 * ese número — la regla R7 falla si eso pasa.
 *
 * ── QUÉ NO SE VALIDA ACÁ, Y POR QUÉ ───────────────────────────────────────
 *
 * `tipo` NO lleva `@IsIn([...])` con la lista de códigos declarables. La lista
 * vive en la base (`motor_tipos_condicion.declarable_por_operador`) y ahí es
 * donde tiene que vivir: una copia en el código se desincroniza el día que
 * alguien agrega una condición, y se desincroniza **en silencio**.
 *
 * Quien decide si el código se puede declarar es la máquina de estados, que lo
 * consulta contra el catálogo y devuelve el motivo del rechazo. Acá sólo se
 * comprueba la FORMA — que sea una cadena con pinta de código y no un objeto
 * anidado ni un texto de tres kilobytes.
 */
export class DeclararEstadoDto {
  /**
   * El código de `motor_tipos_condicion`. Mayúsculas, dígitos y guión bajo:
   * es la forma que usan los 25 códigos del catálogo.
   */
  @IsString()
  @MaxLength(60)
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message:
      'tipo debe ser un código del catálogo de condiciones (mayúsculas, dígitos y guión bajo).',
  })
  tipo!: string;

  /**
   * Por qué. Opcional, pero es lo que va a leer el próximo operador del turno
   * siguiente cuando pregunte por qué este viaje está en amarillo.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nota?: string;
}
