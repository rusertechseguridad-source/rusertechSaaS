/**
 * VALIDACIÓN DE SECRETOS DE ENTORNO.
 *
 * Antes, `jwt.strategy.ts` usaba `process.env.JWT_SECRET || 'rusertech-super-secret-key-2026'`.
 * Ese fallback es público: está en el repositorio. Si la variable no estuviera
 * definida en un despliegue, cualquiera podría firmar tokens válidos y hacerse
 * pasar por cualquier usuario de cualquier tenant.
 *
 * Ahora no hay valor por defecto. Si falta un secreto, la aplicación falla al
 * arrancar con un mensaje explícito, que es infinitamente preferible a
 * levantar con una clave que todo el mundo conoce.
 */

/** Secretos que deben estar definidos sí o sí para arrancar. */
export const REQUIRED_SECRETS = ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;

/**
 * Valores placeholder conocidos: están en `.env.example` y en los `.env` de
 * desarrollo. Son tan públicos como un hardcodeo, así que se rechazan igual.
 */
const PLACEHOLDERS_PROHIBIDOS = ['rusertech-super-secret-key-2026', 'secret'];

/** Fragmentos que delatan un valor de plantilla (`changeme_random_64_chars_...`). */
const FRAGMENTOS_PLACEHOLDER = ['changeme', 'your-secret', 'example', 'placeholder'];

const LONGITUD_MINIMA = 32;

/**
 * Devuelve el secreto o lanza si falta / es un placeholder conocido.
 * Se llama en el constructor de la estrategia JWT, de modo que un secreto
 * ausente impide el arranque del módulo de autenticación.
 */
export function getRequiredSecret(nombre: string): string {
  const valor = process.env[nombre];

  if (!valor || valor.trim() === '') {
    throw new Error(
      `[Configuración] Falta la variable de entorno ${nombre}. ` +
        'La aplicación no arranca sin ella: no hay valor por defecto a propósito. ' +
        'Generá uno con: openssl rand -base64 48',
    );
  }

  const normalizado = valor.trim().toLowerCase();
  const esPlaceholder =
    PLACEHOLDERS_PROHIBIDOS.includes(normalizado) ||
    FRAGMENTOS_PLACEHOLDER.some((fragmento) => normalizado.includes(fragmento));

  if (esPlaceholder) {
    throw new Error(
      `[Configuración] ${nombre} tiene un valor placeholder conocido y público. ` +
        'Generá un secreto real con: openssl rand -base64 48',
    );
  }

  if (valor.trim().length < LONGITUD_MINIMA) {
    throw new Error(
      `[Configuración] ${nombre} es demasiado corto (${valor.trim().length} caracteres, ` +
        `mínimo ${LONGITUD_MINIMA}). Generá uno con: openssl rand -base64 48`,
    );
  }

  return valor;
}

/**
 * Verifica todos los secretos requeridos de una vez. Se invoca en `main.ts`
 * antes de crear la aplicación, para fallar temprano y con un solo mensaje
 * en lugar de hacerlo a mitad del arranque de los módulos.
 */
export function assertRequiredSecrets(): void {
  const faltantes: string[] = [];

  for (const nombre of REQUIRED_SECRETS) {
    try {
      getRequiredSecret(nombre);
    } catch (error) {
      faltantes.push((error as Error).message);
    }
  }

  if (faltantes.length > 0) {
    throw new Error(
      'No se puede arrancar la API por problemas de configuración:\n' +
        faltantes.map((m) => `  · ${m}`).join('\n'),
    );
  }
}
