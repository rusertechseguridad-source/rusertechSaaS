import { randomBytes } from 'crypto';

/**
 * CONTRASEÑAS TEMPORALES.
 *
 * Existía tres veces, con tres implementaciones distintas y dos de ellas
 * débiles:
 *
 *   · `admin.createTenant`      → `randomBytes(4)`  = 32 bits de entropía
 *   · `admin.resetUserPassword` → `randomBytes(4)`  = 32 bits
 *   · `settings.inviteUser`     → `Math.random()`   = predecible, no aleatorio
 *
 * ⚠️ POR QUÉ `Math.random()` ES EL PEOR DE LOS TRES. No es que sea "menos
 * aleatorio": es que no lo es. V8 usa xorshift128+, y de unas pocas salidas
 * consecutivas se reconstruye el estado interno y se predicen todas las
 * siguientes. Quien pueda pedir un par de invitaciones a direcciones propias
 * predice la contraseña temporal de la siguiente invitación, sea de quien sea.
 *
 * ⚠️ Y POR QUÉ 32 BITS TAMPOCO ALCANZAN. Son ~4.300 millones de posibilidades:
 * mucho para tipear a mano, nada para un atacante que prueba contra la ruta de
 * login. La contraseña además viaja por correo y vive hasta que la persona la
 * cambia, que en la práctica puede ser nunca.
 *
 * 16 bytes = 128 bits, que es el piso habitual para un secreto que se genera
 * y se transmite.
 *
 * Formato: base64url (sin `+`, `/` ni `=`) más un sufijo fijo. El sufijo NO
 * agrega seguridad — está para satisfacer reglas de composición (mayúscula,
 * minúscula, número, símbolo) sin recortar la entropía real, que sale entera
 * de los 16 bytes.
 */

/** Bytes de aleatoriedad real. 16 = 128 bits. */
const BYTES = 16;

/**
 * Sufijo fijo para cumplir reglas de composición.
 *
 * Es público y da igual que lo sea: la fuerza está en los 128 bits de adelante.
 * Escribirlo acá, una vez, es mejor que tres variantes distintas repartidas por
 * el código (`Aa1!`, `Rr1@`, `Temp-…!`) que además hacían adivinable el ORIGEN
 * de la contraseña.
 */
const SUFIJO = 'Aa1!';

/**
 * Genera una contraseña temporal criptográficamente aleatoria.
 *
 * Se devuelve para mostrarla o mandarla por correo una sola vez; nunca se
 * guarda en claro (lo que persiste es su hash de bcrypt).
 */
export function generarClaveTemporal(): string {
  return randomBytes(BYTES).toString('base64url') + SUFIJO;
}
