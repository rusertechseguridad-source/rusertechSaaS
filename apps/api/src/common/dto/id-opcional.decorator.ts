import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { Matches, ValidateIf } from 'class-validator';

/**
 * CLAVE FORÁNEA OPCIONAL, tal como la mandan los formularios de verdad.
 *
 * ⚠️ Por qué existe: la Tanda 3 usó `@IsUUID()` en los campos `*_id` y **rompió
 * la pantalla de vehículos en producción** con
 * `400 PUT /api/v1/vehicles/... — carrier_id must be a UUID`.
 * Mi prueba, con datos sintéticos, daba 200. Medí después los dos motivos:
 *
 *   · `@IsOptional()` NO saltea el string vacío, sólo `null` y `undefined`.
 *     Un `<select>` sin elegir manda `''`.
 *   · `@IsUUID('all')` **no** significa "cualquier UUID": exige que el dígito
 *     de versión sea 1–5. Un UUID perfectamente válido generado por otra vía
 *     —o sembrado a mano, como los hay en esta base compartida por tres
 *     productos— se rechaza.
 *
 * Qué hace este decorador:
 *   1. Convierte `''` en `null` ANTES de validar, que es lo que el formulario
 *      quiere decir con "ninguno".
 *   2. Saltea la validación cuando el valor es `null`/`undefined`.
 *   3. Cuando hay valor, exige sólo la FORMA canónica (8-4-4-4-12 hexadecimal),
 *      sin opinar sobre la versión.
 *
 * Qué NO hace, a propósito: comprobar que el id exista o pertenezca al tenant.
 * Eso lo hace la clave foránea de la base, y el `FiltroDeExcepciones` ya traduce
 * ese error a un 409 con mensaje. Validar el formato acá sólo sirve para que no
 * entre basura; endurecerlo más sólo sirve para romper pantallas.
 */
const FORMA_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function IdOpcional(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }) => (value === '' ? null : value)),
    ValidateIf((_obj, valor) => valor !== null && valor !== undefined),
    Matches(FORMA_UUID, { message: '$property debe ser un identificador válido' }),
  );
}
