/**
 * EL RESULTADO DE UN ENVÍO DE CORREO, COMO VALOR.
 *
 * ⚠️ POR QUÉ EXISTE — el hallazgo que hace falta explicar entero.
 *
 * El encargo decía "extendé `emailSent` a `inviteUser`". Al ir al código,
 * `inviteUser` YA lo tenía (settings.service.ts:83-87). Y sin embargo el
 * síntoma que Gustavo vio es real: se da el alta por buena y el correo no
 * sale. La causa es otra, y es peor.
 *
 * **El SDK de Resend no lanza cuando la API rechaza el envío.** Devuelve
 * `{ data: null, error: { name, message } }` con la promesa RESUELTA. El
 * rechazo por modo de prueba —"You can only send testing emails to your own
 * email address"— llega así. O sea que el `try/catch` que envuelve la llamada
 * nunca se dispara: `sendInvitation` termina bien, `emailSent` vale `true`, y
 * la pantalla dice que el usuario fue invitado.
 *
 * Es exactamente el patrón que este proyecto viene corrigiendo desde la Tanda
 * 2: una comprobación que no comprueba nada porque nunca la vieron fallar
 * contra el sistema real. `try/catch` es la forma correcta de capturar una
 * excepción, y acá no hay ninguna excepción que capturar.
 *
 * Por eso el servicio de correo deja de comunicarse por excepciones y devuelve
 * este tipo: quien envía TIENE que mirar el resultado para saber qué pasó, en
 * vez de deducirlo de la ausencia de un error que nunca llega.
 */

export type ResultadoEnvio =
  | { enviado: true; id: string | null }
  | { enviado: false; motivo: string };

/**
 * Traduce el error de Resend a algo que un operador pueda accionar.
 *
 * El mensaje crudo de la API es correcto pero no dice qué hacer. Estos casos
 * son los que de verdad ocurren en un despliegue nuevo, y cada uno tiene una
 * acción distinta.
 */
export function motivoLegible(error: { name?: string; message?: string } | null): string {
  const mensaje = error?.message ?? 'el proveedor de correo rechazó el envío sin dar motivo';

  // El caso exacto que bloquea el primer cliente: la cuenta de Resend sigue en
  // modo de prueba y sólo entrega a la dirección de su dueño.
  if (/only send testing emails|verify a domain/i.test(mensaje)) {
    return (
      'La cuenta de Resend está en modo de prueba: sólo entrega correo a la ' +
      'dirección dueña de la cuenta. Hay que verificar un dominio propio en ' +
      'resend.com/domains y poner ese remitente en MAIL_FROM. ' +
      `(Respuesta del proveedor: ${mensaje})`
    );
  }

  if (/api key|unauthorized|invalid.*token/i.test(mensaje)) {
    return `RESEND_API_KEY es inválida o no tiene permiso para enviar. (${mensaje})`;
  }

  if (/from|sender|domain is not verified/i.test(mensaje)) {
    return (
      `El remitente configurado en MAIL_FROM no está verificado en Resend. (${mensaje})`
    );
  }

  return mensaje;
}
