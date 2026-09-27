/**
 * LA HORA, EN UN SOLO LUGAR — y siempre en 24 horas.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ POR QUÉ ESTE ARCHIVO EXISTE: una alerta de las 20:19 se mostraba 08:19
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `toLocaleString('es-AR')` no garantiza reloj de 24 horas: el formato que
 * elige depende de la versión de ICU del navegador, y en varias devuelve
 * 12 horas. Cuando el marcador de la tarde se pierde —porque el texto se
 * corta, porque el operador lo lee de reojo, o porque el motor de formato no
 * lo pone— un incidente de las ocho de la noche queda registrado como uno de
 * las ocho de la mañana.
 *
 * En custodia eso no es un detalle de presentación. Es el operador dictándole
 * al cliente la hora equivocada, y una bitácora que después no coincide con
 * lo que pasó.
 *
 * ⚠️ Por eso `hour12: false` es EXPLÍCITO y no se confía en la configuración
 * regional. Y por eso está acá y no repetido en cada componente: la hora se
 * muestra en el aviso, en el hilo y en la campana, y tres formatos distintos
 * es la forma de que uno se quede atrás.
 */

/** Opciones comunes. `hour12: false` es la razón de ser del archivo. */
const RELOJ_24: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
};

const SOLO_HORA_24: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
};

/** Acepta `Date` o el texto ISO que manda el backend. */
function aFecha(valor: Date | string): Date {
  return valor instanceof Date ? valor : new Date(valor);
}

/**
 * Fecha y hora completas, en 24 horas. Ej: «22/09/2026, 20:19:51».
 *
 * ⚠️ Si la fecha es inválida se dice, en vez de mostrar «Invalid Date». Un
 * dato roto que se ve como texto raro se reporta; uno que se ve como una
 * fecha plausible, no.
 */
export function fechaHora(valor: Date | string): string {
  const d = aFecha(valor);
  if (Number.isNaN(d.getTime())) return 'fecha desconocida';
  return d.toLocaleString('es-AR', RELOJ_24);
}

/** Sólo la hora, en 24 horas. Ej: «20:19:51». */
export function soloHora(valor: Date | string): string {
  const d = aFecha(valor);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  return d.toLocaleTimeString('es-AR', SOLO_HORA_24);
}

/**
 * «hace 4 minutos», sin traer una biblioteca de fechas para esto.
 *
 * Vivía en `AvisoCritico.tsx`. Se mudó acá con el resto del tiempo: que una
 * mitad del formato esté en un servicio y la otra dentro de un componente es
 * cómo empiezan a divergir.
 */
export function desde(valor: Date | string): string {
  const d = aFecha(valor);
  if (Number.isNaN(d.getTime())) return 'hace un rato';
  const minutos = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} d`;
}
