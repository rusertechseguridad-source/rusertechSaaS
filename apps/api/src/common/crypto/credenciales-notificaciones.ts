import { cifrarSecreto, descifrarSecreto, hayCredencial, CONTEXTO } from './secretos-cifrados';

/**
 * LAS CREDENCIALES QUE VIVEN DENTRO DE `tenants.settings_json`.
 *
 * `settings_json` es un JSON libre con dos subobjetos que traen secretos:
 *   · `smtp` → `{ host, port, user, password, ... }`
 *   · `fcm`  → clave del servicio de notificaciones push
 *
 * Dos problemas distintos, y conviene no mezclarlos:
 *
 *  1. **Estaban en texto plano.** Cualquiera con acceso a la base los leía.
 *  2. **Viajaban al navegador.** `GET /alerts/settings` y
 *     `GET /settings/notifications` devolvían `settings_json` entero, así que
 *     la contraseña SMTP llegaba a la consola del navegador de cualquier
 *     usuario autenticado — incluido un `viewer`. Y la pantalla no las muestra
 *     en ninguna parte: viajaban para nada.
 *
 * ⚠️ UN HALLAZGO QUE CAMBIA LA CORRECCIÓN. Se buscó quién ENVÍA por SMTP en
 * todo el backend: nadie. El correo sale por Resend (`MailService`). Estas
 * credenciales se guardan y se muestran, pero ningún código las consume.
 *
 * Eso simplifica el arreglo y conviene decirlo: no hace falta descifrarlas en
 * ningún punto de uso, porque no hay punto de uso. Se cifran al guardar y se
 * ENMASCARAN al leer. Cuando exista un envío por SMTP propio, el descifrado va
 * ahí y sólo ahí.
 */

/** Campos de `smtp` que son secretos. El resto es configuración visible. */
const CAMPOS_SECRETOS_SMTP = ['password', 'pass'] as const;

/** Marcador de "hay una credencial guardada" que va al navegador. */
export const MARCADOR = '__guardado__';

type Objeto = Record<string, unknown>;

function esObjeto(v: unknown): v is Objeto {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Cifra los secretos de `smtp` y `fcm` antes de guardar.
 *
 * ⚠️ El caso del MARCADOR es el que hace que esto funcione de verdad. La
 * pantalla recibe `password: '__guardado__'` al leer; si el operador cambia el
 * host y guarda, el formulario reenvía ese marcador. Sin este control, la
 * contraseña real se sobreescribiría con la cadena `__guardado__` y el SMTP
 * quedaría roto sin que nadie hubiera tocado la contraseña. Ante el marcador
 * se devuelve `undefined` para esa clave: quien llama la omite y conserva lo
 * que había.
 */
export function cifrarCredencialesNotificaciones(
  entrante: unknown,
  guardadoPrevio: unknown,
): Objeto | null {
  if (!esObjeto(entrante)) return null;

  const previo = esObjeto(guardadoPrevio) ? guardadoPrevio : {};
  const resultado: Objeto = { ...entrante };

  for (const campo of CAMPOS_SECRETOS_SMTP) {
    if (!(campo in resultado)) continue;
    const valor = resultado[campo];

    if (valor === MARCADOR) {
      // "No lo toqués": se conserva lo que ya estaba guardado.
      if (campo in previo) resultado[campo] = previo[campo];
      else delete resultado[campo];
      continue;
    }

    if (typeof valor !== 'string' || !hayCredencial(valor)) {
      // Vaciar el campo a propósito es una acción válida (quitar la contraseña).
      resultado[campo] = null;
      continue;
    }

    resultado[campo] = cifrarSecreto(valor, CONTEXTO.smtpPassword);
  }

  return resultado;
}

/**
 * Reemplaza los secretos por el marcador antes de responder.
 *
 * Se devuelve el marcador y no `null` porque la pantalla tiene que poder
 * distinguir "hay una contraseña configurada" de "no hay ninguna" — es
 * exactamente la clase de dato que, mostrado como vacío, hace creer que algo
 * no está configurado cuando sí lo está.
 */
export function enmascararCredencialesNotificaciones(guardado: unknown): Objeto | null {
  if (!esObjeto(guardado)) return null;

  const resultado: Objeto = { ...guardado };
  for (const campo of CAMPOS_SECRETOS_SMTP) {
    if (!(campo in resultado)) continue;
    resultado[campo] = hayCredencial(resultado[campo] as string) ? MARCADOR : null;
  }
  return resultado;
}

/**
 * Enmascara `settings_json` entero.
 *
 * Es lo que usan las dos rutas que devolvían el objeto completo. Se enmascara
 * por ESTRUCTURA y no por lista de rutas conocidas: `settings_json` es libre y
 * una clave nueva no debería filtrarse por olvido.
 */
export function enmascararSettingsJson(settings: unknown): Objeto {
  if (!esObjeto(settings)) return {};

  const resultado: Objeto = { ...settings };
  if ('smtp' in resultado) {
    resultado.smtp = enmascararCredencialesNotificaciones(resultado.smtp);
  }
  // `fcm` no tiene una forma fija documentada: si es una cadena, es la clave
  // entera. Se enmascara completa en vez de adivinar qué campo es el secreto.
  if ('fcm' in resultado && typeof resultado.fcm === 'string') {
    resultado.fcm = hayCredencial(resultado.fcm) ? MARCADOR : null;
  }
  return resultado;
}

/**
 * Descifra la contraseña SMTP. HOY NO LA LLAMA NADIE, y es correcto.
 *
 * Existe para que el día que se agregue un envío por SMTP propio, el
 * descifrado esté escrito junto al cifrado y no se reinvente mal. Si el valor
 * es anterior a esta tanda, vuelve tal cual (`esLegado`).
 */
export function descifrarPasswordSmtp(guardado: unknown): string | null {
  if (typeof guardado !== 'string' || !hayCredencial(guardado)) return null;
  return descifrarSecreto(guardado, CONTEXTO.smtpPassword).valor;
}
