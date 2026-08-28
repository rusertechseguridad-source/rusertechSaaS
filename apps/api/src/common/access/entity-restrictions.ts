/**
 * RESTRICCIONES DE ACCESO POR ENTIDAD — núcleo puro.
 *
 * Por qué existe: `users.entity_restrictions` es un `jsonb` sin esquema que
 * decide qué vehículos y qué ubicaciones puede ver un usuario. Hasta esta
 * corrección, los tres consumidores (vehicles, trips, locations) repetían la
 * misma línea:
 *
 *     if (er && Array.isArray(er.vehicles) && er.vehicles.length > 0) { ... }
 *
 * Esa línea FALLA EN ABIERTO: cualquier forma que no sea exactamente un
 * arreglo no vacío hace que la consulta salga SIN filtro, y el usuario ve todo
 * el tenant. `{vehicles: "abc"}`, `{vehicles: {}}`, un string suelto o un
 * arreglo en la raíz no son "sin restricción": son una restricción que el
 * código no supo leer, y la respuesta correcta a eso es negar, no permitir.
 *
 * Este módulo separa las dos cosas que la línea vieja confundía:
 *
 *   · SIN_RESTRICCION → el usuario legítimamente no tiene límites
 *     (columna en su default `{}`, JSON null, la clave ausente, o la lista
 *      vacía que escribe la pantalla de Configuración cuando no se tildó nada).
 *   · ILEGIBLE        → hay algo escrito y NO se entiende. Es un bug de datos.
 *     Se deniega y se deja rastro; nunca se degrada a "sin restricción".
 *
 * Es una función pura a propósito (misma tesis que `telemetry/dedupe.ts` y
 * `motor/evaluadores/`): no lee la base, no loguea, no lanza. Toda la tabla de
 * comportamiento se prueba sin Postgres. La política (qué hacer con un
 * ILEGIBLE) vive en `acceso-entidades.service.ts`, que sí puede loguear.
 */

/** Dimensiones que hoy guarda el jsonb. Son las claves reales del objeto. */
export type AlcanceRestriccion = 'vehicles' | 'locations';

/**
 * Resultado de leer el jsonb para UNA dimensión.
 * Los tres casos son excluyentes y ninguno significa "no sé": esa es la
 * diferencia con el `Array.isArray` que reemplaza.
 */
export type RestriccionResuelta =
  | { readonly decision: 'sin_restriccion' }
  | { readonly decision: 'lista'; readonly ids: readonly string[] }
  | { readonly decision: 'ilegible'; readonly motivo: string };

/**
 * Las columnas destino (`vehicles.id`, `saved_locations.id`) son `uuid`.
 * Un elemento que no es UUID no sólo es sospechoso: mandado a Prisma provoca
 * `22P02 invalid input syntax for type uuid` → 500. Validarlo acá convierte un
 * error de runtime opaco en una decisión explícita y registrada.
 */
const PATRON_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Instancia compartida e inmutable: no hay estado que mutar. */
const SIN_RESTRICCION: RestriccionResuelta = Object.freeze({
  decision: 'sin_restriccion' as const,
});

function ilegible(motivo: string): RestriccionResuelta {
  return Object.freeze({ decision: 'ilegible' as const, motivo });
}

/** Nombre del tipo JSON de un valor, para que el motivo sea accionable. */
function describirTipo(valor: unknown): string {
  if (valor === null) return 'null';
  if (Array.isArray(valor)) return 'arreglo';
  return typeof valor;
}

/**
 * Interpreta `users.entity_restrictions` para una dimensión.
 *
 * @param valorCrudo Lo que devuelve Prisma para la columna `jsonb`. Puede ser
 *                   cualquier cosa: el escritor (`PUT /settings/users/:id`) no
 *                   valida el body y lo pasa tal cual a `prisma.user.update`.
 * @param alcance    'vehicles' | 'locations'.
 *
 * Reglas, en orden:
 *  1. ausente / null            → SIN_RESTRICCION (caso legítimo y mayoritario)
 *  2. raíz no-objeto o arreglo  → ILEGIBLE
 *  3. clave ausente / null      → SIN_RESTRICCION (esa dimensión no se limita)
 *  4. clave no-arreglo          → ILEGIBLE
 *  5. arreglo vacío             → SIN_RESTRICCION (lo que escribe hoy la UI)
 *  6. arreglo con algo que no es UUID → ILEGIBLE
 *  7. arreglo de UUIDs          → LISTA (deduplicada)
 */
export function interpretarRestricciones(
  valorCrudo: unknown,
  alcance: AlcanceRestriccion,
): RestriccionResuelta {
  // 1. La columna tiene default '{}', pero un JSON null es representable y
  //    Prisma lo devuelve como `null`. Ninguno de los dos es una restricción.
  if (valorCrudo === undefined || valorCrudo === null) return SIN_RESTRICCION;

  // 2. Un string, un número o un booleano en la raíz no describen ningún
  //    permiso. La versión vieja los dejaba pasar: `('abc').vehicles` es
  //    undefined, `Array.isArray(undefined)` es false, y la consulta salía
  //    sin filtro.
  if (typeof valorCrudo !== 'object') {
    return ilegible(`la raíz es ${describirTipo(valorCrudo)}, se esperaba un objeto`);
  }
  if (Array.isArray(valorCrudo)) {
    return ilegible('la raíz es un arreglo, se esperaba un objeto');
  }

  const lista = (valorCrudo as Record<string, unknown>)[alcance];

  // 3. Las dimensiones son independientes: `{vehicles: [...]}` sin `locations`
  //    limita vehículos y no limita ubicaciones. Ese es el comportamiento
  //    actual y se conserva.
  if (lista === undefined || lista === null) return SIN_RESTRICCION;

  // 4. Acá estaba el agujero principal: `{vehicles: "abc"}` y `{vehicles: {}}`
  //    son intentos de restringir mal escritos, no ausencia de restricción.
  if (!Array.isArray(lista)) {
    return ilegible(`"${alcance}" es ${describirTipo(lista)}, se esperaba un arreglo`);
  }

  // 5. Decisión deliberada, no descuido: la pantalla de Configuración manda
  //    `{vehicles: [], locations: []}` para todo viewer al que no se le tildó
  //    nada, y esos usuarios hoy ven todo el tenant. Tratar `[]` como "no ve
  //    nada" los dejaría sin pantalla de un día para el otro. La ambigüedad de
  //    fondo — `[]` no distingue "sin configurar" de "expresamente nada" — es
  //    un límite del modelo jsonb y se resuelve migrando a tablas, no acá.
  if (lista.length === 0) return SIN_RESTRICCION;

  const invalidos = lista.filter(
    (elemento) => typeof elemento !== 'string' || !PATRON_UUID.test(elemento),
  );
  // 6. Un solo elemento inválido invalida la lista entera: no se puede saber
  //    si los que sí son UUID son "los permitidos" o apenas la parte que
  //    sobrevivió a lo que haya corrompido el valor.
  if (invalidos.length > 0) {
    return ilegible(
      `"${alcance}" tiene ${invalidos.length} de ${lista.length} elemento(s) que no son UUID`,
    );
  }

  // 7. Dedupe: `{in: [...]}` tolera repetidos, pero una lista limpia hace que
  //    los logs y los tests digan lo mismo que la intención.
  return Object.freeze({
    decision: 'lista' as const,
    ids: Object.freeze(Array.from(new Set(lista as string[]))),
  });
}

/**
 * Traduce la decisión a un fragmento de `where` de Prisma.
 *
 * @param campo Columna a filtrar en la tabla consultada: `id` en vehicles y en
 *              saved_locations, `vehicle_id` en trips.
 *
 * `ilegible` mapea a `{ in: [] }` — un filtro que no matchea ninguna fila. Es
 * la segunda línea de defensa: aunque la política del servicio cambiara y
 * dejara de lanzar 403, el fragmento sigue siendo cerrado. Nunca devuelve
 * `undefined` para un caso desconocido, que es exactamente cómo se llega a una
 * consulta sin filtro.
 */
export function filtroDeAcceso(
  restriccion: RestriccionResuelta,
  campo: string,
): Record<string, unknown> {
  if (restriccion.decision === 'sin_restriccion') return {};
  if (restriccion.decision === 'lista') return { [campo]: { in: [...restriccion.ids] } };
  return { [campo]: { in: [] } };
}

/**
 * Resumen acotado del valor crudo para el log.
 * El contenido son UUIDs, no secretos, pero un jsonb corrupto puede ser enorme
 * y no tiene por qué entrar entero en el log.
 */
export function resumirValor(valorCrudo: unknown, maximo = 200): string {
  let texto: string;
  try {
    texto = JSON.stringify(valorCrudo) ?? String(valorCrudo);
  } catch {
    // JSON.stringify puede fallar con referencias circulares o BigInt: el log
    // no puede ser la razón por la que se cae la request.
    texto = `<no serializable: ${describirTipo(valorCrudo)}>`;
  }
  return texto.length <= maximo ? texto : `${texto.slice(0, maximo)}…(${texto.length} chars)`;
}
