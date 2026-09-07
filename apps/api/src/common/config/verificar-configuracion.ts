/**
 * VERIFICACIÓN DE CONFIGURACIÓN AL ARRANCAR.
 *
 * Extiende lo que ya hacía `assertRequiredSecrets` —que sólo miraba los dos
 * secretos de JWT— al resto de las variables que deciden si la aplicación
 * funciona o funciona MAL.
 *
 * ⚠️ EL CRITERIO: fallar al arrancar es preferible a arrancar roto.
 *
 * No es una preferencia estética. Los tres incidentes de este proyecto que
 * costaron más tiempo fueron todos "la aplicación levantó y algo no andaba":
 *   · el `.env` sin `REDIS_URL` → BullMQ reintentando para siempre;
 *   · la `REDIS_URL` con formato de API REST → el pool de Prisma agotado y la
 *     API sin responder, sin un solo mensaje que dijera por qué;
 *   · `JWT_SECRET` ausente → arrancaba con la clave de ejemplo del repositorio.
 * En los tres, un proceso que se niega a arrancar y dice qué falta habría
 * ahorrado horas.
 *
 * Hay dos niveles, y la diferencia importa:
 *   · ERROR   → la aplicación NO arranca. Sin esto no funciona, o funciona de
 *               una forma que engaña.
 *   · AVISO   → arranca, y deja dicho qué queda degradado. Es para lo
 *               opcional de verdad (Redis, el correo), no para tapar dudas.
 *
 * Todo se junta y se informa DE UNA VEZ: descubrir las variables faltantes de
 * a una, reiniciando entre cada una, es su propia forma de castigo.
 */
import { REQUIRED_SECRETS, getRequiredSecret } from './secrets';
import { VARIABLE_CLAVE } from '../crypto/secretos-cifrados';
import { problemasDeCors, origenesPermitidos, direccionPublica } from './direccion-publica';
import { problemasDeRedis } from './redis-conexion';
import { problemasDeUmbralesSalud, umbralesSalud } from './umbrales-salud';

export interface Diagnostico {
  errores: string[];
  avisos: string[];
}

/** Prefijos de una URL de Postgres válida. */
const ESQUEMAS_POSTGRES = ['postgresql://', 'postgres://'];

function revisarBaseDeDatos(d: Diagnostico): void {
  const url = process.env.DATABASE_URL?.trim();

  if (!url) {
    d.errores.push(
      'Falta DATABASE_URL. Es la conexión que usa toda la aplicación; sin ella ' +
        'no hay nada que servir. Ver README_DESPLIEGUE.md § Base de datos.',
    );
    return;
  }

  if (!ESQUEMAS_POSTGRES.some((e) => url.startsWith(e))) {
    d.errores.push(
      `DATABASE_URL no parece una URL de Postgres (empieza con "${url.slice(0, 12)}…"). ` +
        'Se espera postgresql://usuario:clave@host:puerto/base',
    );
    return;
  }

  // ── Pooler ────────────────────────────────────────────────────────────────
  // Sólo AVISOS. Cambiar el puerto de la conexión en caliente es la clase de
  // corrección que deja a un sistema que funciona sin funcionar, así que acá
  // se DICE y no se decide. El procedimiento para probarlo sin riesgo está en
  // README_DESPLIEGUE.md.
  const usaPgbouncer = url.includes('pgbouncer=true');
  const puerto = url.match(/:(\d+)\/[^/?]*(\?|$)/)?.[1];

  if (usaPgbouncer && puerto === '5432') {
    d.avisos.push(
      'DATABASE_URL declara pgbouncer=true pero apunta al puerto 5432, que es ' +
        'la conexión DIRECTA de Supabase, no el Transaction Pooler (6543). ' +
        'Hoy funciona porque el 5432 acepta prepared statements; lo que se ' +
        'pierde es el pooler, y con varias instancias el proyecto se queda sin ' +
        'conexiones. Ver README_DESPLIEGUE.md § El puerto del pooler para el ' +
        'procedimiento de cambio sin riesgo.',
    );
  }

  if (!url.includes('connection_limit=')) {
    d.avisos.push(
      'DATABASE_URL no define connection_limit. Prisma usa (núcleos × 2 + 1) por ' +
        'instancia: en una máquina de 8 núcleos son 17 conexiones por réplica. ' +
        'Con el pooler conviene fijarlo (connection_limit=10).',
    );
  }

  if (!process.env.DIRECT_URL?.trim()) {
    d.avisos.push(
      'Falta DIRECT_URL. La aplicación no la usa para servir tráfico, pero sin ' +
        'ella `prisma db pull` y la introspección no funcionan.',
    );
  }
}

function revisarCifrado(d: Diagnostico): void {
  // No se valida el formato acá: `assertClaveDeCifrado()` ya lo hace y su
  // mensaje es mejor. Lo que se agrega es que la ausencia se informe JUNTO al
  // resto, en vez de reventar por separado a mitad del arranque.
  if (!process.env[VARIABLE_CLAVE]?.trim()) {
    d.errores.push(
      `Falta ${VARIABLE_CLAVE}. Es la clave con la que se cifran las credenciales ` +
        'de terceros guardadas en la base (proveedores GPS, reenvío de posiciones, ' +
        'Climatiq, SMTP). Sin ella no se pueden leer ni escribir. ' +
        'Generala con: openssl rand -base64 32',
    );
  }
}

function revisarCorreo(d: Diagnostico): void {
  if (!process.env.RESEND_API_KEY?.trim()) {
    d.avisos.push(
      'Falta RESEND_API_KEY: no se va a enviar ningún correo. La aplicación ' +
        'funciona, pero un usuario invitado NO recibe su contraseña y hay que ' +
        'regenerársela a mano. Ver README_DESPLIEGUE.md § Correo.',
    );
    return;
  }

  const remitente = process.env.MAIL_FROM?.trim();
  if (!remitente) {
    d.avisos.push(
      'Falta MAIL_FROM: se usa el remitente de prueba de Resend (@resend.dev), ' +
        'que SÓLO puede escribirle a la dirección dueña de la cuenta. Ningún ' +
        'usuario invitado va a recibir su correo. Ver README_DESPLIEGUE.md § Correo.',
    );
  } else if (remitente.includes('resend.dev')) {
    d.avisos.push(
      `MAIL_FROM apunta a ${remitente}, que es el dominio de prueba de Resend: ` +
        'sólo entrega a la dirección dueña de la cuenta. Verificá un dominio ' +
        'propio en resend.com/domains antes del primer cliente.',
    );
  }
}

function revisarFrontend(d: Diagnostico): void {
  d.errores.push(...problemasDeCors());

  const enProduccion = process.env.NODE_ENV === 'production';
  if (!enProduccion) return;

  // En producción, quedarse con los valores de desarrollo no es un detalle:
  // significa que el navegador del cliente va a bloquear todas las llamadas,
  // o que las fotos subidas van a apuntar a la máquina de quien las mire.
  if (!process.env.CORS_ORIGIN?.trim()) {
    d.errores.push(
      'NODE_ENV=production sin CORS_ORIGIN. La API aceptaría únicamente ' +
        `${origenesPermitidos().join(' y ')}, que son los de desarrollo: el ` +
        'navegador bloquearía todas las llamadas del frontend.',
    );
  }

  if (!process.env.PUBLIC_API_URL?.trim()) {
    d.errores.push(
      'NODE_ENV=production sin PUBLIC_API_URL. Las direcciones de los archivos ' +
        `subidos saldrían como ${direccionPublica()}/…, o sea apuntando a la ` +
        'máquina de quien abra el navegador.',
    );
  }

}

/**
 * El chequeo de salud.
 *
 * Los umbrales inválidos son ERROR y los aporta `problemasDeUmbralesSalud`.
 * Acá va sólo el recordatorio de la sonda, que no se puede verificar desde el
 * proceso: el timeout de la sonda vive en la plataforma, no en el `.env`.
 *
 * ⚠️ Sólo en producción. En desarrollo nadie tiene un balanceador delante y el
 * aviso sería ruido en cada `npm run start:dev` — que es como se entrena a la
 * gente a no leer los avisos.
 */
function revisarSalud(d: Diagnostico): void {
  if (process.env.NODE_ENV !== 'production') return;

  const { timeoutMs } = umbralesSalud();
  d.avisos.push(
    `El chequeo de salud espera hasta ${timeoutMs} ms por la base antes de ` +
      'declararla caída. La sonda del balanceador tiene que tener un timeout ' +
      'MAYOR que ese número: si corta antes, nunca ve el 503 ni el diagnóstico ' +
      '—ve un timeout genérico, igual para una base caída que para un proceso ' +
      'colgado. Ver README_DESPLIEGUE.md § Chequeo de salud.',
  );
}

/** Reúne el diagnóstico completo sin lanzar. Es lo que prueban los tests. */
export function diagnosticarConfiguracion(): Diagnostico {
  const d: Diagnostico = { errores: [], avisos: [] };

  for (const nombre of REQUIRED_SECRETS) {
    try {
      getRequiredSecret(nombre);
    } catch (error) {
      d.errores.push((error as Error).message);
    }
  }

  revisarBaseDeDatos(d);
  revisarCifrado(d);
  revisarCorreo(d);
  revisarFrontend(d);
  revisarSalud(d);
  const redis = problemasDeRedis();
  d.errores.push(...redis.errores);
  d.avisos.push(...redis.avisos);

  // ⚠️ Un par de umbrales mal puesto no rompe nada visible: el chequeo de
  // salud simplemente deja de distinguir "lenta" de "caída" y vuelve a sacar
  // de rotación instancias sanas. Es exactamente la clase de fallo silencioso
  // que este verificador existe para atrapar, así que va como ERROR.
  d.errores.push(...problemasDeUmbralesSalud());

  return d;
}

/**
 * Verifica la configuración y ABORTA si hay errores.
 *
 * Los avisos se devuelven para que `main.ts` los registre con el logger de
 * Nest (que todavía no existe cuando esto corre).
 */
export function verificarConfiguracion(): string[] {
  const { errores, avisos } = diagnosticarConfiguracion();

  if (errores.length > 0) {
    throw new Error(
      `No se puede arrancar la API: ${errores.length} problema(s) de configuración.\n` +
        errores.map((m) => `  ✖ ${m}`).join('\n') +
        (avisos.length
          ? '\n\nAdemás, con menor gravedad:\n' + avisos.map((m) => `  ! ${m}`).join('\n')
          : '') +
        '\n\nLa referencia completa de variables está en README_DESPLIEGUE.md.',
    );
  }

  return avisos;
}
