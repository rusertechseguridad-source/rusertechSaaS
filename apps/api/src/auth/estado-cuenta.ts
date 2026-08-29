/**
 * ESTADO DE LA CUENTA — la regla de "quién puede usar el sistema", en un solo lugar.
 *
 * Por qué existe: el chequeo hace falta en DOS puntos que no se pueden fusionar —
 * `AuthService.validateUser` (al emitir el token) y `JwtStrategy.validate` (en cada
 * request con un token ya emitido). Sin el segundo, suspender a alguien no surte
 * efecto hasta 12 h después, que es lo que dura el token.
 *
 * Dos copias de la misma regla es exactamente como se desincronizan: si mañana se
 * agrega un estado `pending_activation`, se agrega acá y los dos puntos lo respetan.
 *
 * Contexto de la verificación integral (§1.1): la palabra `status` no aparecía ni
 * una vez en `auth/` ni en `users/`. `users.status` se escribía desde el botón de
 * suspender y NADIE la leía; `tenants.status` se escribía al suspender un cliente y
 * tampoco se leía en ningún punto del backend. Las dos acciones eran decorativas.
 */

/** Único estado que habilita el acceso. Cualquier otro valor lo niega. */
export const ESTADO_ACTIVO = 'active';

export interface EstadoCuenta {
  /** `users.status` */
  estadoUsuario: string | null | undefined;
  /** `tenants.status` */
  estadoTenant: string | null | undefined;
}

/**
 * Resultado explícito en vez de un booleano: el motivo se necesita para el log.
 * Nunca se le devuelve al cliente — decirle "tu empresa está suspendida" a quien
 * todavía no probó una contraseña válida es información que no le corresponde.
 */
export type VeredictoAcceso =
  | { permitido: true }
  | { permitido: false; motivo: 'usuario_inactivo' | 'tenant_inactivo' | 'sin_datos' };

/**
 * Falla CERRADO: si falta el dato del usuario o del tenant, se niega.
 * Un `undefined` acá significa que la consulta no trajo lo que se esperaba, y en
 * una comprobación de acceso eso se trata como negativo, no como "seguí".
 */
export function evaluarAcceso(estado: EstadoCuenta): VeredictoAcceso {
  const { estadoUsuario, estadoTenant } = estado;

  if (!estadoUsuario || !estadoTenant) {
    return { permitido: false, motivo: 'sin_datos' };
  }
  if (estadoUsuario !== ESTADO_ACTIVO) {
    return { permitido: false, motivo: 'usuario_inactivo' };
  }
  if (estadoTenant !== ESTADO_ACTIVO) {
    return { permitido: false, motivo: 'tenant_inactivo' };
  }
  return { permitido: true };
}
