/**
 * UMBRALES DEL CHEQUEO DE SALUD.
 *
 * ⚠️ POR QUÉ EXISTE ESTE ARCHIVO — el defecto que lo produjo.
 *
 * La primera versión del chequeo tenía un `3000` escrito a mano y UN SOLO
 * umbral: si la consulta no volvía en 3 segundos, la instancia se declaraba
 * `caido` y respondía 503.
 *
 * Medido en producción por Gustavo, contra la base real:
 *
 *     {"estado":"caido","base_de_datos":{"ok":false,"ms":3010,
 *      "detalle":"sin respuesta en 3 s"}}
 *
 * …en un arranque donde Prisma conectó bien y el motor sincronizó 4 vehículos.
 * O sea: **falso negativo**. La base responde; lo que no alcanzaba era el
 * número. La base vive en us-west-2 y la aplicación consulta desde Buenos
 * Aires, con el pooler de por medio.
 *
 * El resultado es exactamente el daño que el propio chequeo decía evitar con
 * Redis: un balanceador sacando de rotación una instancia sana.
 *
 * Dos errores en una línea, y conviene separarlos porque las correcciones son
 * distintas:
 *
 *   1. **Era un número mágico.** Un valor que depende de dónde está la base y
 *      desde dónde se la consulta no puede vivir en el código: es
 *      configuración. Va a variable de entorno, con un valor por defecto
 *      pensado para una base REMOTA, que es el caso real, y no para una local,
 *      que es donde yo lo probé.
 *
 *   2. **Colapsaba dos cosas distintas en una.** "Tardó más de lo que
 *      quisiéramos" y "no contestó" no son el mismo hecho y no merecen la misma
 *      respuesta. Una base lenta sigue sirviendo: sacarla de rotación empeora
 *      el problema, porque concentra el tráfico en menos instancias contra la
 *      MISMA base lenta. Ahora son dos umbrales y tres estados.
 *
 * ── LOS TRES ESTADOS ──────────────────────────────────────────────────────
 *
 *   ok         → respondió por debajo de `degradadoMs`.            HTTP 200
 *   degradado  → respondió, pero tarde; o Redis está caído.        HTTP 200
 *   caido      → no respondió antes de `timeoutMs`.                HTTP 503
 *
 * Sólo el tercero saca la instancia de rotación.
 */

/** Umbrales efectivos, ya resueltos desde el entorno. */
export interface UmbralesSalud {
  /** Sin respuesta pasado esto, se considera caída. */
  timeoutMs: number;
  /** Respondió, pero por encima de esto se considera lenta. */
  degradadoMs: number;
}

/**
 * Tope antes de declarar caída una dependencia.
 *
 * 10 s y no 3: tiene que cubrir el peor caso legítimo de una base remota —
 * latencia de continente a continente más el arranque en frío del pooler de
 * Supavisor, que abre una conexión nueva cuando no hay ninguna libre. Es
 * deliberadamente holgado: el costo de un falso negativo (sacar de rotación
 * una instancia sana) es mucho mayor que el de tardar unos segundos más en
 * detectar una base que de verdad se cayó, sobre todo porque la sonda se
 * repite cada pocos segundos.
 */
const TIMEOUT_POR_DEFECTO_MS = 10_000;

/**
 * A partir de cuánto una respuesta cuenta como lenta.
 *
 * 1 s. Una consulta `SELECT 1` contra una base sana, incluso cruzando
 * continentes, vuelve en cientos de milisegundos. Pasado un segundo hay algo
 * que mirar —el pooler saturado, la red, la base bajo carga— pero la instancia
 * sigue sirviendo, así que se informa y NO se la saca de rotación.
 */
const DEGRADADO_POR_DEFECTO_MS = 1_000;

/** Piso de cordura: por debajo de esto cualquier base remota daría falso. */
const TIMEOUT_MINIMO_MS = 500;

function leerEntero(nombre: string): number | null {
  const crudo = process.env[nombre]?.trim();
  if (!crudo) return null;
  const valor = Number(crudo);
  return Number.isInteger(valor) ? valor : NaN;
}

/**
 * Los umbrales configurados.
 *
 * Se leen en cada llamada y no en una constante de módulo para que las pruebas
 * puedan cambiar el entorno sin recargar el módulo, igual que el resto de la
 * configuración de esta carpeta.
 *
 * Los valores inválidos NO se corrigen en silencio: `problemasDeUmbralesSalud`
 * los reporta y el arranque los rechaza. Acá simplemente se cae al valor por
 * defecto, de modo que si alguien llama a esta función fuera del camino de
 * arranque obtenga algo utilizable en vez de un `NaN` que haría que TODA
 * comparación diera falso y el chequeo dejara de detectar nada.
 */
export function umbralesSalud(): UmbralesSalud {
  const timeout = leerEntero('HEALTH_TIMEOUT_MS');
  const degradado = leerEntero('HEALTH_DEGRADADO_MS');

  return {
    timeoutMs: timeout !== null && Number.isInteger(timeout) && timeout >= TIMEOUT_MINIMO_MS
      ? timeout
      : TIMEOUT_POR_DEFECTO_MS,
    degradadoMs: degradado !== null && Number.isInteger(degradado) && degradado > 0
      ? degradado
      : DEGRADADO_POR_DEFECTO_MS,
  };
}

/**
 * Problemas de configuración de los umbrales, para el chequeo de arranque.
 *
 * ⚠️ El caso que de verdad importa es `degradadoMs >= timeoutMs`. Con esa
 * combinación el estado `degradado` se vuelve **inalcanzable**: toda respuesta
 * es o rápida o caída, y volvemos exactamente al comportamiento binario que
 * esta corrección elimina. Es un error silencioso —nada falla, el chequeo
 * simplemente deja de distinguir— así que se rechaza al arrancar.
 */
export function problemasDeUmbralesSalud(): string[] {
  const problemas: string[] = [];

  const timeout = leerEntero('HEALTH_TIMEOUT_MS');
  const degradado = leerEntero('HEALTH_DEGRADADO_MS');

  if (timeout !== null && !Number.isInteger(timeout)) {
    problemas.push(
      `HEALTH_TIMEOUT_MS no es un número entero de milisegundos: "${process.env.HEALTH_TIMEOUT_MS}".`,
    );
  } else if (timeout !== null && timeout < TIMEOUT_MINIMO_MS) {
    problemas.push(
      `HEALTH_TIMEOUT_MS es ${timeout} ms, por debajo del mínimo de ${TIMEOUT_MINIMO_MS} ms. ` +
        'Un tope tan corto declara caída una base remota sana: es el falso negativo ' +
        'que esta variable existe para evitar.',
    );
  }

  if (degradado !== null && !Number.isInteger(degradado)) {
    problemas.push(
      `HEALTH_DEGRADADO_MS no es un número entero de milisegundos: "${process.env.HEALTH_DEGRADADO_MS}".`,
    );
  } else if (degradado !== null && degradado <= 0) {
    problemas.push(
      `HEALTH_DEGRADADO_MS es ${degradado}: tiene que ser mayor que cero. ` +
        'Con 0 o menos, toda respuesta se informaría como lenta.',
    );
  }

  // Sólo tiene sentido comparar si los dos valores son utilizables.
  if (problemas.length === 0) {
    const { timeoutMs, degradadoMs } = umbralesSalud();
    if (degradadoMs >= timeoutMs) {
      problemas.push(
        `HEALTH_DEGRADADO_MS (${degradadoMs} ms) tiene que ser MENOR que ` +
          `HEALTH_TIMEOUT_MS (${timeoutMs} ms). Con este par, el estado "degradado" ` +
          'es inalcanzable: toda respuesta sería rápida o caída, y el chequeo ' +
          'volvería a sacar de rotación instancias sanas por lentitud.',
      );
    }
  }

  return problemas;
}
