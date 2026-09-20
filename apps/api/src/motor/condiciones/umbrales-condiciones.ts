/**
 * LOS UMBRALES DE LAS CONDICIONES — UN SOLO NÚMERO POR UMBRAL.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ POR QUÉ ESTE ARCHIVO EXISTE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * «Ya nos pasó con la tolerancia del recorrido: un default en el código y otro
 * en la base, desalineados.»
 *
 * Un comentario que dice «tiene que coincidir con la base» no impide que se
 * separen: sólo deja constancia de quién tenía razón después. Lo único que lo
 * impide es una PRUEBA QUE FALLE cuando se separan.
 *
 * Estas constantes son el espejo del `DEFAULT` de las columnas en
 * `prisma/migrations/031_etapa3b_condiciones.sql`, y
 * `umbrales-condiciones.spec.ts` **lee ese archivo SQL** y compara número
 * contra número. Si alguien cambia uno de los dos lados, la suite falla y dice
 * cuál.
 *
 * Por eso el script vive en el repositorio y no sólo en el ZIP: para que la
 * prueba tenga algo que leer.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * QUÉ PASA SI UN TENANT NO TIENE FILA
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Funciona con estos valores. Es el patrón que `tenant_engine_config` ya usa y
 * que su propio comentario en la base declara: «Sin fila, la aplicación usa los
 * valores por defecto del código: un cliente sin configurar tiene un motor
 * razonable, no un motor apagado».
 *
 * El SQL del barrido usa `coalesce(cfg.sin_reporte_minutos, <esta constante>)`,
 * así que la ausencia de fila y la ausencia de valor caen al mismo número.
 */

/**
 * Cuánto silencio es «sin reporte», en minutos.
 *
 * 20 min: más que el intervalo de reporte de cualquier equipo en uso, y menos
 * que el tiempo en que un camión puede alejarse sin que nadie lo note.
 */
export const UMBRAL_SIN_REPORTE_POR_DEFECTO = 20;

/**
 * Cuánto es una parada «prolongada», en minutos.
 *
 * 60 min: seis veces el umbral de parada (10 min). Una hora quieto ya no es
 * una maniobra ni un semáforo, ni siquiera dentro de una ubicación habilitada.
 */
export const UMBRAL_PARADA_PROLONGADA_POR_DEFECTO = 60;

/**
 * Los nombres de las columnas, para que la prueba sepa qué buscar en el SQL.
 *
 * ⚠️ Es una lista y no dos constantes sueltas porque la prueba tiene que poder
 * fallar por OMISIÓN: si mañana se agrega un tercer umbral y nadie lo suma acá,
 * el número nuevo queda sin vigilar. Con la lista, agregar la constante sin
 * agregar la columna —o al revés— también falla.
 */
export const UMBRALES_ESPEJADOS: ReadonlyArray<{ columna: string; valor: number }> = [
  { columna: 'sin_reporte_minutos', valor: UMBRAL_SIN_REPORTE_POR_DEFECTO },
  { columna: 'parada_prolongada_minutos', valor: UMBRAL_PARADA_PROLONGADA_POR_DEFECTO },
];
