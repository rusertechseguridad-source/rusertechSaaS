/**
 * DIRECCIÓN PÚBLICA DE LA API Y ORÍGENES PERMITIDOS.
 *
 * Dos cosas que hasta ahora estaban escritas a mano dentro del código y que
 * cambian en cada despliegue.
 *
 * ── 1. `direccionPublica()` ────────────────────────────────────────────────
 * La URL con la que un navegador llega a ESTA API. Se usa para armar la
 * dirección de los archivos subidos.
 *
 * ⚠️ POR QUÉ NO SIRVE UNA RUTA RELATIVA ACÁ. Es la pregunta que ya se frenó
 * una vez, con razón: en desarrollo el frontend corre en Vite (:5173) y la API
 * en :3000, así que un `/uploads/x.jpg` devuelto por la API resolvería contra
 * Vite y daría 404. La respuesta tiene que ser absoluta, y por eso hay una
 * variable en vez de un `localhost` fijo.
 *
 * ── 2. `origenesPermitidos()` ──────────────────────────────────────────────
 * Qué orígenes acepta CORS. Antes eran dos literales de localhost dentro de
 * `main.ts`: en un servidor, el navegador bloqueaba todas las llamadas del
 * frontend aunque la API estuviera respondiendo perfectamente.
 *
 * Ni cerrado a localhost ni abierto a todo: `CORS_ORIGIN` acepta una lista
 * separada por comas. `*` se rechaza a propósito — con `credentials: true` el
 * navegador lo ignora igual, así que aceptarlo sería prometer algo que no
 * pasa.
 */

/** Valor de desarrollo del frontend. */
const ORIGEN_DEV = ['http://localhost:5173', 'http://127.0.0.1:5173'];

/** Valor de desarrollo de la API. */
const API_DEV = 'http://localhost:3000';

/**
 * Dirección pública de esta API, sin barra final.
 *
 * Se lee en cada llamada y no en un módulo constante para que las pruebas
 * puedan cambiar la variable de entorno sin recargar el módulo.
 */
export function direccionPublica(): string {
  const configurada = process.env.PUBLIC_API_URL?.trim();
  if (!configurada) return API_DEV;
  return configurada.replace(/\/+$/, '');
}

/**
 * Orígenes que CORS acepta.
 *
 * Sin `CORS_ORIGIN`, los dos de desarrollo. Con la variable, exactamente lo
 * que diga: quien despliega decide, y si se equivoca lo ve en el navegador,
 * no en un comportamiento silencioso.
 */
export function origenesPermitidos(): string[] {
  const crudo = process.env.CORS_ORIGIN?.trim();
  if (!crudo) return [...ORIGEN_DEV];

  const origenes = crudo
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter((o) => o.length > 0);

  if (origenes.length === 0) return [...ORIGEN_DEV];
  return origenes;
}

/**
 * Problemas de configuración de CORS, para que el arranque los cante.
 *
 * Devuelve mensajes en vez de lanzar: quien llama decide si son fatales. Hoy
 * lo son (ver `verificar-configuracion.ts`), pero la decisión no vive acá.
 */
export function problemasDeCors(): string[] {
  const crudo = process.env.CORS_ORIGIN?.trim();
  if (!crudo) return [];

  const problemas: string[] = [];

  for (const origen of origenesPermitidos()) {
    if (origen === '*') {
      problemas.push(
        'CORS_ORIGIN contiene "*". No se acepta: la API responde con ' +
          '`credentials: true`, y ante un comodín el navegador descarta la ' +
          'respuesta igual. Enumerá los orígenes reales separados por comas.',
      );
      continue;
    }
    // Un origen es esquema + host + puerto. Ni ruta ni barra final: el
    // navegador compara la cadena exacta y un `/` de más no matchea nunca.
    if (!/^https?:\/\/[^/]+$/.test(origen)) {
      problemas.push(
        `CORS_ORIGIN tiene una entrada que no es un origen válido: "${origen}". ` +
          'Se espera esquema://host[:puerto], sin ruta ni barra final ' +
          '(ej: https://app.midominio.com).',
      );
    }
  }

  return problemas;
}
