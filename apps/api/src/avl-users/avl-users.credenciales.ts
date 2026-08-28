/**
 * QUÉ SALE DEL BACKEND CUANDO SE PIDE UN PROVEEDOR GPS.
 *
 * Este archivo existe para que haya UN solo lugar donde se decide qué campos
 * de `avl_users` viajan al navegador. Antes la decisión no existía: el servicio
 * devolvía la fila entera de Prisma, y eso incluía `provider_password` y
 * `provider_api_key` — las credenciales que el proveedor GPS nos da para entrar
 * a SU plataforma — en texto plano, a cualquier usuario del tenant con sólo
 * abrir la pantalla de proveedores. No hacía falta ni el permiso `manage_avl`.
 */
import {
  CONTEXTO,
  cifrarSecreto,
  descifrarSecreto,
  hayCredencial,
} from '../common/crypto/secretos-cifrados';

/**
 * Campos que se leen de `avl_users`.
 *
 * ⚠️ Es una lista BLANCA, no una lista de exclusiones. Si mañana alguien agrega
 * una columna `provider_totp_seed`, con una lista negra viajaría al navegador
 * hasta que alguien se acuerde de excluirla; con esta lista, simplemente no
 * aparece. El costo es tener que agregarla acá a mano cuando sí debe mostrarse,
 * que es exactamente la revisión que queremos forzar.
 *
 * Las dos columnas de credenciales SÍ se seleccionan —hacen falta para saber si
 * hay algo guardado— pero `aVistaPublica` las quita antes de responder.
 */
export const CAMPOS_AVL_USER = {
  id: true,
  tenant_id: true,
  user_avl_code: true,
  name: true,
  description: true,
  provider_name: true,
  provider_platform_url: true,
  provider_username: true,
  provider_api_url: true,
  provider_notes: true,
  operational_contact: true,
  api_key: true,
  is_active: true,
  last_data_at: true,
  created_at: true,
  updated_at: true,
  provider_password: true,
  provider_api_key: true,
} as const;

/** Fila tal como sale de Prisma con `CAMPOS_AVL_USER`. */
export interface FilaAvlUser {
  provider_password: string | null;
  provider_api_key: string | null;
  [otro: string]: unknown;
}

/**
 * Quita las credenciales y las reemplaza por la única información que la
 * pantalla necesita: si hay algo guardado.
 *
 * ⚠️ NO devuelve la credencial enmascarada (`'••••••'`). Un valor falso en el
 * mismo campo que antes traía el valor real es una trampa: el formulario lo
 * mandaría de vuelta al guardar y la credencial quedaría reemplazada por los
 * asteriscos. Un booleano con otro nombre no se puede confundir con un valor.
 *
 * Destructura en vez de `delete`: si el objeto se arma por descarte, un campo
 * nuevo entra solo. Acá lo que no se nombra, no sale.
 */
export function aVistaPublica<T extends FilaAvlUser>(fila: T) {
  const { provider_password, provider_api_key, ...publico } = fila;

  return {
    ...publico,
    /** Hay contraseña guardada. El valor se pide aparte, con permiso. */
    tiene_password_proveedor: hayCredencial(provider_password),
    /** Hay API key del proveedor guardada. */
    tiene_api_key_proveedor: hayCredencial(provider_api_key),
  };
}

/**
 * Traduce lo que manda el formulario a lo que se escribe en la base.
 *
 * Tres casos, y la diferencia entre ellos es la que evita perder credenciales:
 *
 *  · la clave NO viene   → `undefined`: Prisma no toca la columna. Es el caso
 *                          normal — el formulario sólo manda la credencial si
 *                          el operador escribió una nueva.
 *  · viene `null`        → borrado explícito (el botón "Eliminar credencial").
 *  · viene un texto      → credencial nueva, se cifra.
 *
 * `''` en un UPDATE es el cuarto caso y es el bug que estamos arreglando: hasta
 * hoy el formulario inicializaba el campo con `existingUser?.provider_password
 * || ''`, así que en cuanto el backend deje de devolver el valor, guardar
 * escribiría la cadena vacía encima de la credencial buena. Por eso no se
 * interpreta como "borrar": se rechaza, para que el error se vea en vez de
 * perder el dato en silencio.
 */
export function credencialParaGuardar(
  recibido: unknown,
  contexto: string,
  campo: string,
  permitirVacio: boolean,
): string | null | undefined {
  if (recibido === undefined) return undefined;
  if (recibido === null) return null;

  if (typeof recibido !== 'string') {
    throw new TypeError(`${campo} debe ser un texto o null, llegó ${typeof recibido}.`);
  }

  if (!hayCredencial(recibido)) {
    if (permitirVacio) return null;
    throw new Error(
      `${campo} llegó vacío. Si querés borrar la credencial guardada, enviá null; ` +
        'una cadena vacía no se acepta en una edición porque casi siempre es un ' +
        'formulario que reenvió un campo que nunca se completó.',
    );
  }

  return cifrarSecreto(recibido, contexto);
}

/** Credenciales en claro. Sólo las devuelve el endpoint dedicado. */
export interface CredencialesEnClaro {
  provider_username: string | null;
  provider_password: string | null;
  provider_api_key: string | null;
  /** true si alguna seguía en texto plano: hay que correr la migración. */
  hay_texto_plano: boolean;
}

/** Descifra las credenciales de una fila para mostrarlas una vez. */
export function descifrarCredenciales(fila: {
  provider_username: string | null;
  provider_password: string | null;
  provider_api_key: string | null;
}): CredencialesEnClaro {
  const password = descifrarSecreto(fila.provider_password, CONTEXTO.avlProviderPassword);
  const apiKey = descifrarSecreto(fila.provider_api_key, CONTEXTO.avlProviderApiKey);

  return {
    provider_username: fila.provider_username,
    provider_password: password.valor,
    provider_api_key: apiKey.valor,
    hay_texto_plano: password.esLegado || apiKey.esLegado,
  };
}
