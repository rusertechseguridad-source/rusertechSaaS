/**
 * CIFRADO REVERSIBLE DE SECRETOS GUARDADOS EN COLUMNAS DE TEXTO.
 *
 * Por qué existe: `avl_users.provider_password` y `avl_users.provider_api_key`
 * guardaban en texto plano las credenciales que el proveedor GPS nos entrega
 * para entrar a SU plataforma. Quien lograra leer la base —un backup, un dump,
 * una consulta desde el panel de Supabase— se llevaba las credenciales de
 * todos los proveedores de todos los clientes.
 *
 * ⚠️ POR QUÉ CIFRADO Y NO HASH: un hash sería más simple y más seguro, pero
 * inservible acá. Estas credenciales existen para que un operador las LEA y se
 * loguee a mano en la plataforma del proveedor (la propia pantalla lo dice:
 * "Estos datos son solo para consulta manual"). El backend nunca las verifica
 * contra nada, así que no hay nada que hashear: hay que poder recuperar el
 * valor original. Eso obliga a cifrado reversible.
 *
 * ⚠️ POR QUÉ AES-256-GCM Y NO AES-256-CBC: GCM es cifrado *autenticado*.
 * Produce un tag que se verifica al descifrar, así que un texto alterado en la
 * base —o descifrado con la clave equivocada— falla de forma explícita en
 * lugar de devolver bytes basura que la aplicación tomaría por una contraseña.
 * Esa propiedad es la que además hace segura la rotación de clave por
 * "probar la actual y si no la anterior": sin el tag no habría forma de
 * distinguir la clave correcta de la incorrecta.
 *
 * Sin dependencias nuevas: todo sale de `node:crypto`.
 */
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'crypto';

/** Nombre de la variable de entorno con la clave activa. */
export const VARIABLE_CLAVE = 'CREDENTIALS_ENCRYPTION_KEY';

/**
 * Clave anterior, opcional. Sólo se usa DURANTE una rotación: el descifrado la
 * prueba si la clave activa no logra autenticar el tag. Terminada la pasada de
 * re-cifrado, se borra del entorno.
 */
export const VARIABLE_CLAVE_ANTERIOR = 'CREDENTIALS_ENCRYPTION_KEY_PREVIOUS';

/** Versión de esquema del formato almacenado. Cambia si cambia el algoritmo. */
const VERSION_ACTUAL = 'v1';

const ALGORITMO = 'aes-256-gcm';
const LONGITUD_CLAVE_BYTES = 32; // AES-256
const LONGITUD_IV_BYTES = 12;    // recomendado para GCM: 96 bits
const LONGITUD_TAG_BYTES = 16;

/**
 * Reconoce un valor ya cifrado por su prefijo de versión.
 *
 * Es la pieza que permite convivir con los datos que HOY están en texto plano:
 * un valor sin prefijo `vN:` no se intenta descifrar, se devuelve tal cual.
 * Se prefiere el prefijo explícito a un "intentar descifrar y si falla asumir
 * texto plano" porque ese fallback silencioso convertiría cualquier error real
 * (clave mal configurada, dato corrupto) en "acá había texto plano", que es
 * exactamente la clase de mentira que no queremos.
 */
const PREFIJO_VERSION = /^v(\d+):/;

/** Un valor cifrado: `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`. */
const FORMATO_V1 = /^v1:([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]*)$/;

/** Error de configuración: la aplicación no debe arrancar así. */
export class ClaveDeCifradoInvalidaError extends Error {}

/** Error de datos: el valor guardado no se pudo descifrar. */
export class SecretoIndescifrableError extends Error {}

/**
 * Lee y valida una clave del entorno.
 *
 * Mismo criterio que `common/config/secrets.ts`: no hay valor por defecto y no
 * hay degradación silenciosa. Una clave ausente o inválida es un error de
 * arranque con un mensaje que dice cómo generarla, no un modo "sin cifrado".
 */
function leerClave(nombreVariable: string): Buffer {
  const valor = process.env[nombreVariable];

  if (!valor || valor.trim() === '') {
    throw new ClaveDeCifradoInvalidaError(
      `[Configuración] Falta la variable de entorno ${nombreVariable}. ` +
        'Sin ella no se pueden guardar ni leer las credenciales de los proveedores GPS. ' +
        'Generá una con: openssl rand -base64 32',
    );
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(valor.trim(), 'base64');
  } catch {
    throw new ClaveDeCifradoInvalidaError(
      `[Configuración] ${nombreVariable} no es base64 válido. ` +
        'Generá una con: openssl rand -base64 32',
    );
  }

  if (bytes.length !== LONGITUD_CLAVE_BYTES) {
    throw new ClaveDeCifradoInvalidaError(
      `[Configuración] ${nombreVariable} decodifica a ${bytes.length} bytes y AES-256 ` +
        `necesita exactamente ${LONGITUD_CLAVE_BYTES}. ` +
        'No se deriva la clave de una frase a propósito: una clave de largo incorrecto ' +
        'casi siempre es un valor pegado a medias, y adivinar lo taparía. ' +
        'Generá una con: openssl rand -base64 32',
    );
  }

  return bytes;
}

/** Clave activa. Se lee en cada llamada: el entorno puede cambiar entre tests. */
function claveActiva(): Buffer {
  return leerClave(VARIABLE_CLAVE);
}

/** Claves a probar al descifrar: la activa primero, la anterior si existe. */
function clavesDeDescifrado(): Buffer[] {
  const claves = [claveActiva()];
  const anterior = process.env[VARIABLE_CLAVE_ANTERIOR];
  if (anterior && anterior.trim() !== '') {
    claves.push(leerClave(VARIABLE_CLAVE_ANTERIOR));
  }
  return claves;
}

/**
 * Verifica al arrancar que la clave existe y es utilizable.
 * Se invoca desde `main.ts` junto a `assertRequiredSecrets()`, para fallar con
 * un solo mensaje antes de levantar los módulos.
 */
export function assertClaveDeCifrado(): void {
  clavesDeDescifrado();
}

/**
 * ¿El valor guardado está cifrado?
 * Público porque la migración y el pre-vuelo necesitan contarlos sin descifrar.
 */
export function estaCifrado(valor: string | null | undefined): boolean {
  return typeof valor === 'string' && PREFIJO_VERSION.test(valor);
}

/**
 * ¿Hay credencial guardada? Sin descifrarla.
 *
 * Es lo que la API devuelve al navegador en lugar del valor. Vive acá y no en
 * el servicio porque la respuesta de la pantalla y la migración tienen que
 * coincidir en qué cuenta como "hay credencial".
 */
export function hayCredencial(guardado: string | null | undefined): guardado is string {
  return typeof guardado === 'string' && guardado.trim() !== '';
}

/**
 * Cifra un secreto para guardarlo en una columna `text`.
 *
 * `contexto` viaja como AAD (datos autenticados pero no cifrados): queda
 * cubierto por el tag sin quedar guardado. Sirve para atar el criptograma a la
 * columna donde vive, de modo que copiar el valor de `provider_api_key` a
 * `provider_password` con un UPDATE directo a la base no produzca un valor
 * descifrable. Es barato y no obliga a guardar nada extra.
 *
 * `null`, `undefined` y una cadena en blanco devuelven `null`: "no hay
 * credencial" es un estado legítimo y cifrarlo produciría un criptograma que
 * miente sobre la existencia de un dato — la pantalla diría "hay una credencial
 * guardada" por un valor que son tres espacios. El criterio de "en blanco" es
 * el mismo que usa `hayCredencial`, a propósito: si difirieran, la migración y
 * la pantalla contarían cosas distintas.
 *
 * Lo que NO se hace es recortar el valor que sí tiene contenido: una contraseña
 * puede legítimamente empezar o terminar con un espacio, y "arreglarla" en
 * silencio la volvería inservible sin que nadie se entere.
 */
export function cifrarSecreto(
  valor: string | null | undefined,
  contexto: string,
): string | null {
  if (!hayCredencial(valor)) return null;

  // Un valor ya cifrado no se vuelve a cifrar: hace idempotente cualquier
  // pasada de migración que se corra dos veces.
  if (estaCifrado(valor)) return valor;

  const iv = randomBytes(LONGITUD_IV_BYTES);
  const cipher = createCipheriv(ALGORITMO, claveActiva(), iv, {
    authTagLength: LONGITUD_TAG_BYTES,
  });
  cipher.setAAD(Buffer.from(contexto, 'utf8'));

  const cifrado = Buffer.concat([cipher.update(valor, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION_ACTUAL,
    iv.toString('base64'),
    tag.toString('base64'),
    cifrado.toString('base64'),
  ].join(':');
}

/**
 * Resultado del descifrado. Se devuelve `esLegado` en lugar de sólo el valor
 * para que quien llame pueda registrar cuántas credenciales siguen sin cifrar
 * sin tener que repetir la detección del prefijo.
 */
export interface SecretoDescifrado {
  valor: string | null;
  /** true si el valor estaba en texto plano (dato anterior a esta tanda). */
  esLegado: boolean;
}

/**
 * Descifra un valor guardado.
 *
 * Tres caminos, todos explícitos:
 *  · vacío/null         → `{ valor: null, esLegado: false }`
 *  · sin prefijo `vN:`  → texto plano heredado, se devuelve tal cual con
 *                         `esLegado: true`
 *  · con prefijo        → se descifra; si no autentica, LANZA.
 *
 * Nunca devuelve basura: si el tag no verifica —clave equivocada, criptograma
 * alterado, formato roto— tira `SecretoIndescifrableError`. Devolver un valor
 * inventado sería peor que fallar: el operador copiaría una contraseña falsa.
 */
export function descifrarSecreto(
  guardado: string | null | undefined,
  contexto: string,
): SecretoDescifrado {
  if (guardado === null || guardado === undefined || guardado === '') {
    return { valor: null, esLegado: false };
  }

  if (!estaCifrado(guardado)) {
    return { valor: guardado, esLegado: true };
  }

  const partes = FORMATO_V1.exec(guardado);
  if (!partes) {
    const version = PREFIJO_VERSION.exec(guardado)?.[1];
    throw new SecretoIndescifrableError(
      version && version !== '1'
        ? `El secreto está en formato v${version} y esta versión del código sólo entiende v1. ` +
          'Actualizá la aplicación antes de leerlo.'
        : 'El secreto guardado tiene el prefijo v1 pero no la estructura ' +
          'v1:<iv>:<tag>:<ciphertext>. El dato está corrupto.',
    );
  }

  const [, ivB64, tagB64, cifradoB64] = partes;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const cifrado = Buffer.from(cifradoB64, 'base64');

  if (iv.length !== LONGITUD_IV_BYTES || tag.length !== LONGITUD_TAG_BYTES) {
    throw new SecretoIndescifrableError(
      `El secreto guardado tiene un IV de ${iv.length} bytes y un tag de ${tag.length} ` +
        `(se esperaban ${LONGITUD_IV_BYTES} y ${LONGITUD_TAG_BYTES}). El dato está corrupto.`,
    );
  }

  // Se prueban la clave activa y, si está definida, la anterior. Que esto sea
  // seguro es mérito del tag de GCM: con la clave equivocada `final()` lanza.
  for (const clave of clavesDeDescifrado()) {
    try {
      const decipher = createDecipheriv(ALGORITMO, clave, iv, {
        authTagLength: LONGITUD_TAG_BYTES,
      });
      decipher.setAAD(Buffer.from(contexto, 'utf8'));
      decipher.setAuthTag(tag);
      const plano = Buffer.concat([decipher.update(cifrado), decipher.final()]);
      return { valor: plano.toString('utf8'), esLegado: false };
    } catch {
      // Se sigue con la próxima clave. El detalle NO se propaga: distinguir
      // "tag inválido" de "padding inválido" es información para quien ataca.
      continue;
    }
  }

  throw new SecretoIndescifrableError(
    'No se pudo descifrar el secreto guardado: ninguna clave configurada autentica el dato. ' +
      `Puede ser una clave rotada sin dejar la anterior en ${VARIABLE_CLAVE_ANTERIOR}, ` +
      'un contexto distinto al usado al cifrar, o un valor alterado en la base.',
  );
}

/**
 * Contextos (AAD) de cada columna. Centralizados para que el servicio, la
 * migración y los tests no puedan discrepar: un contexto distinto al usado
 * para cifrar hace fallar el descifrado.
 */
export const CONTEXTO = {
  avlProviderPassword: 'avl_users.provider_password',
  avlProviderApiKey: 'avl_users.provider_api_key',
  // ── Agregados en la Tanda 7 ──────────────────────────────────────────────
  // Las tres credenciales que quedaban en texto plano con este módulo ya
  // escrito y probado desde la Fase C.
  //
  // ⚠️ La diferencia con las de `avl_users`: aquéllas existen para que una
  // PERSONA las lea y se loguee a mano, así que se descifran al mostrarlas.
  // Éstas las consume el BACKEND, así que se descifran en el punto de uso y
  // NUNCA viajan al navegador — la pantalla recibe si hay credencial, no cuál.
  forwarderAuthCredentials: 'position_forwarders.auth_credentials',
  climatiqApiKey: 'carbon_settings.climatiq_api_key',
  smtpPassword: 'tenants.settings_json.smtp.password',
} as const;

/**
 * Marca de una credencial cifrada guardada DENTRO de una columna JSON.
 *
 * `position_forwarders.auth_credentials` es `Json?` y guarda un objeto cuya
 * forma depende de `auth_type` (hoy `{ token }` para bearer). Cifrar la
 * columna entera obligaría a cambiarla a `text`, que es una migración de
 * esquema y este proyecto no corre migraciones automáticas.
 *
 * La alternativa es guardar el criptograma como una propiedad reconocible
 * dentro del mismo JSON. La columna sigue siendo `Json`, no hay ALTER, y el
 * prefijo `v1:` del propio criptograma sigue distinguiendo cifrado de legado.
 */
export const CLAVE_JSON_CIFRADO = '__cifrado';

/**
 * Un objeto JSON con la credencial cifrada adentro.
 *
 * Se declara como `Record<string, string>` y no como una interfaz con una sola
 * propiedad porque Prisma exige un tipo con firma de índice para sus columnas
 * `Json` (`InputJsonObject`). Una interfaz cerrada no la tiene y el tipado
 * fallaba al guardar.
 */
export type JsonCifrado = Record<string, string>;

/** ¿Este JSON guarda una credencial cifrada? */
export function esJsonCifrado(valor: unknown): valor is JsonCifrado {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    !Array.isArray(valor) &&
    estaCifrado((valor as Record<string, unknown>)[CLAVE_JSON_CIFRADO] as string)
  );
}

/**
 * Cifra un objeto JSON entero para guardarlo en una columna `Json`.
 *
 * Devuelve `null` para un objeto vacío o ausente: mismo criterio que
 * `cifrarSecreto`, para que "no hay credencial" no se convierta en un
 * criptograma que miente sobre la existencia del dato.
 */
export function cifrarJson(valor: unknown, contexto: string): JsonCifrado | null {
  if (valor === null || valor === undefined) return null;
  if (esJsonCifrado(valor)) return valor; // ya cifrado: idempotente
  if (typeof valor === 'object' && !Array.isArray(valor) && Object.keys(valor).length === 0) {
    return null;
  }

  const cifrado = cifrarSecreto(JSON.stringify(valor), contexto);
  return cifrado === null ? null : { [CLAVE_JSON_CIFRADO]: cifrado };
}

/**
 * Descifra lo que `cifrarJson` guardó, tolerando el dato legado.
 *
 * Un JSON sin la marca es un valor anterior a la Tanda 7 y se devuelve tal
 * cual, igual que hace `descifrarSecreto` con el texto plano: la convivencia
 * es lo que permite cifrar sin una migración obligatoria previa.
 */
export function descifrarJson<T = unknown>(
  guardado: unknown,
  contexto: string,
): { valor: T | null; esLegado: boolean } {
  if (guardado === null || guardado === undefined) return { valor: null, esLegado: false };
  if (!esJsonCifrado(guardado)) return { valor: guardado as T, esLegado: true };

  const { valor } = descifrarSecreto(guardado[CLAVE_JSON_CIFRADO], contexto);
  if (valor === null) return { valor: null, esLegado: false };
  return { valor: JSON.parse(valor) as T, esLegado: false };
}


/** Comparación en tiempo constante, por si se necesita verificar un secreto. */
export function sonIguales(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
