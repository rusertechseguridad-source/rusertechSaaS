import { readFileSync } from 'fs';
import { join } from 'path';
import { globSync } from 'glob';

/**
 * PRIMITIVAS DE BARRIDO — leer el LUGAR que importa, no el archivo.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUÉ EXISTE ESTE MÓDULO
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Los dos hallazgos más caros de la verificación integral no eran errores de
 * código sino de CABLEADO, y ninguno aparece en `tsc`, en un test, ni leyendo
 * el archivo:
 *
 *   · `forwarding` declaraba `@Roles` y no enchufaba `RolesGuard`.
 *   · `routes.findAll` recibía `tenantId`, importaba `tenantWhere`, y no lo
 *     usaba.
 *
 * Se escribieron barridos para atraparlos. Y entonces apareció el problema de
 * segundo orden: **seis de esos barridos fallaron su primera prueba negativa**,
 * todos por el mismo motivo — preguntaban si el ARCHIVO contenía un texto, en
 * vez de si lo contenía el lugar donde ese texto significa algo.
 *
 *   | Barrido                  | Por qué pasaba con la corrección deshecha   |
 *   |--------------------------|---------------------------------------------|
 *   | `PermissionsGuard`       | el `import` contiene el nombre              |
 *   | `HealthModule`           | el `import` contiene el nombre              |
 *   | `role_code`              | anclado a principio de línea; `data: { … }` |
 *   | `EstadoConsulta`         | `toContain` matchea `EstadoConsultaX`       |
 *   | `Math.random()`          | el COMENTARIO que explica la corrección     |
 *   | `fetch('/api/v1/…')`     | ídem, la prosa del comentario               |
 *
 * Un barrido que no puede fallar es peor que ninguno: da una garantía que no
 * tiene. Este módulo concentra las cuatro primitivas que faltaban, para que un
 * barrido nuevo no tenga que redescubrirlas:
 *
 *   1. `sinComentarios`     — la prosa no es código
 *   2. `dentroDeDecorador`  — un guard cuenta si está en `@UseGuards(...)`
 *   3. `dentroDeArray`      — un módulo cuenta si está en `imports: [...]`
 *   4. `corto`              — separador normalizado ⚠️ Windows y Linux
 *
 * ⚠️ Es código de PRUEBA y vive en `src/` a propósito: los barridos lo importan
 * con una ruta relativa, y la exclusión de `tsconfig.build.json` cubre los
 * archivos `spec` pero no éste. Es un archivo sin dependencias de Nest y sin
 * efectos: entra al bundle de producción como texto muerto. La alternativa
 * —moverlo a `test/`— rompería las rutas relativas de seis suites por una
 * ganancia de unos kilobytes.
 *
 * ⚠️ Y una nota que me costó una compilación: en los comentarios de este
 * archivo NO se puede escribir un patrón glob con asterisco-barra, porque esa
 * secuencia cierra el bloque de comentario. Por eso se nombran en palabras.
 */

// ══════════════════════════════════════════════════════════════════════════
// Raíces del repositorio
// ══════════════════════════════════════════════════════════════════════════

/** `apps/api/src` */
export const RAIZ_API = join(__dirname, '..', '..');

/**
 * `apps/api` — la raíz del PAQUETE, donde viven `package.json` y los dos
 * `tsconfig`.
 *
 * ⚠️ Existe porque escribir `join(RAIZ_API, '..', 'tsconfig.json')` en cada
 * regla es una trampa: la primera versión de R12 se olvidó del `'..'` y buscó
 * `src/tsconfig.json`. Falló con ENOENT y se vio; pero una regla que en vez de
 * reventar hubiese leído un archivo vacío habría quedado en verde sin mirar
 * nada, que es el modo de fallar que esta tanda persigue.
 */
export const RAIZ_PAQUETE_API = join(RAIZ_API, '..');

/** `apps/web/src` */
export const RAIZ_WEB = join(__dirname, '..', '..', '..', '..', 'web', 'src');

export const leer = (archivo: string): string => readFileSync(archivo, 'utf-8');

/**
 * Ruta relativa a la raíz, con separador `/` SIEMPRE.
 *
 * ⚠️ Normalizar NO es cosmético. `path.join` devuelve `\` en Windows, las
 * listas de exenciones se escriben con `/`, y ninguna coincidía: el barrido
 * fallaba entero en la máquina de Gustavo y pasaba en la mía. Es la tercera
 * vez en esta serie que un verificador da un resultado distinto según el
 * sistema operativo, y por eso hay una regla dedicada a que no se repita.
 */
export const corto = (archivo: string, raiz: string = RAIZ_API): string =>
  archivo.replace(raiz, '').replace(/\\/g, '/').replace(/^\//, '');

/** Archivos del backend. */
export function fuentesApi(patron = '**/*.ts'): string[] {
  return globSync(patron, { cwd: RAIZ_API, absolute: true }).filter(
    (f) => !f.endsWith('.spec.ts') && !f.endsWith('.d.ts'),
  );
}

/** Controladores del backend. */
export const controladores = (): string[] => fuentesApi('**/*.controller.ts');

/** Servicios del backend. */
export const servicios = (): string[] => fuentesApi('**/*.service.ts');

/** ¿Está el frontend en este árbol? Permite saltear sus barridos sin fallar. */
export function hayWeb(): boolean {
  try {
    return globSync('**/*.tsx', { cwd: RAIZ_WEB }).length > 0;
  } catch {
    return false;
  }
}

/** Archivos del frontend. */
export function fuentesWeb(patron = '**/*.{ts,tsx}'): string[] {
  if (!hayWeb()) return [];
  return globSync(patron, { cwd: RAIZ_WEB, absolute: true }).filter((f) => !f.endsWith('.d.ts'));
}

// ══════════════════════════════════════════════════════════════════════════
// 1 · La prosa no es código
// ══════════════════════════════════════════════════════════════════════════

/**
 * Quita comentarios y el contenido de los literales de texto.
 *
 * ⚠️ DOS COSAS, no una, y la segunda cuesta descubrirla.
 *
 * Los comentarios son el caso obvio: un barrido de `Math.random()` matcheaba
 * el comentario «⚠️ Era `Math.random()`, que no es aleatorio…», o sea la
 * explicación de la corrección hacía fallar la comprobación de la corrección.
 *
 * Los literales son el caso sutil: un mensaje de error que dice
 * `'Usá tenantWhere en vez de un where suelto'` haría que un barrido de
 * `tenantWhere` diera por bueno un archivo que sólo lo NOMBRA. Se vacían en
 * lugar de borrarse para no correr las posiciones de las demás líneas.
 *
 * No es un parser de TypeScript y no pretende serlo: es un filtro para
 * barridos. Casos que no cubre —una barra dentro de una expresión regular que
 * parezca el inicio de un comentario— están documentados abajo y ninguna regla
 * de esta tanda depende de ellos.
 */
export function sinComentarios(texto: string): string {
  let salida = '';
  let i = 0;
  const n = texto.length;

  while (i < n) {
    const c = texto[i];
    const siguiente = texto[i + 1];

    // Comentario de bloque
    if (c === '/' && siguiente === '*') {
      const fin = texto.indexOf('*/', i + 2);
      const trozo = texto.slice(i, fin < 0 ? n : fin + 2);
      // Se conservan los saltos de línea: si no, los números de línea que
      // reporta un barrido dejarían de corresponder al archivo real.
      salida += trozo.replace(/[^\n]/g, ' ');
      i = fin < 0 ? n : fin + 2;
      continue;
    }

    // Comentario de línea. `[^:]` no alcanza: `https://` lo esquiva pero
    // `a//b` no. Se comprueba que no venga de un `:` inmediato, que es el
    // único caso frecuente (una URL) en este repositorio.
    if (c === '/' && siguiente === '/' && texto[i - 1] !== ':') {
      const fin = texto.indexOf('\n', i);
      i = fin < 0 ? n : fin;
      continue;
    }

    // Literales: se vacía el contenido y se conservan los delimitadores, para
    // que `'x'` siga pareciendo un literal y no desaparezca la sintaxis.
    if (c === "'" || c === '"' || c === '`') {
      const cierre = c;
      salida += c;
      i += 1;
      let profundidad = 0;
      while (i < n) {
        if (texto[i] === '\\') { salida += ' '; i += 2; continue; }
        // En una plantilla, `${…}` SÍ es código y no se puede vaciar.
        if (cierre === '`' && texto[i] === '$' && texto[i + 1] === '{') {
          profundidad += 1;
          salida += '${';
          i += 2;
          continue;
        }
        if (profundidad > 0) {
          if (texto[i] === '}') profundidad -= 1;
          salida += texto[i];
          i += 1;
          continue;
        }
        if (texto[i] === cierre) break;
        salida += texto[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      salida += cierre;
      i += 1;
      continue;
    }

    salida += c;
    i += 1;
  }

  return salida;
}

/** Igual que `sinComentarios` pero conservando los literales. */
export function soloCodigo(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// ══════════════════════════════════════════════════════════════════════════
// 2 · Dentro de un decorador
// ══════════════════════════════════════════════════════════════════════════

/**
 * Argumentos de cada aparición de `@Decorador(...)`.
 *
 * Cuenta paréntesis en vez de usar `[^)]*` para no cortarse en el primer
 * cierre: `@UseGuards(JwtAuthGuard, RolesGuard)` sobrevive, pero también
 * `@Roles(...)` con una llamada anidada adentro.
 */
export function argumentosDeDecorador(texto: string, decorador: string): string[] {
  const codigo = soloCodigo(texto);
  const salida: string[] = [];
  const marca = `@${decorador}(`;
  let desde = 0;

  for (;;) {
    const inicio = codigo.indexOf(marca, desde);
    if (inicio < 0) break;
    let i = inicio + marca.length;
    let profundidad = 1;
    while (i < codigo.length && profundidad > 0) {
      if (codigo[i] === '(') profundidad += 1;
      else if (codigo[i] === ')') profundidad -= 1;
      i += 1;
    }
    salida.push(codigo.slice(inicio + marca.length, i - 1));
    desde = i;
  }

  return salida;
}

/**
 * ¿Está `simbolo` DENTRO de algún `@decorador(...)`?
 *
 * ⚠️ ESTA ES LA PRIMITIVA QUE FALTÓ. La primera versión del barrido de
 * autorización preguntaba si el archivo "contenía" `PermissionsGuard` — y el
 * `import` lo contiene. Quitarlo del `@UseGuards` dejaba el decorador inerte y
 * el barrido seguía en verde: el mismo error que venía a detectar, dentro del
 * detector. Lo encontró la prueba negativa, no la lectura.
 */
export function dentroDeDecorador(texto: string, decorador: string, simbolo: string): boolean {
  return argumentosDeDecorador(texto, decorador).some((args) =>
    new RegExp(`\\b${simbolo}\\b`).test(args),
  );
}

/** Valores de texto pasados a un decorador: `@RequirePermissions('a','b')`. */
export function literalesDeDecorador(texto: string, decorador: string): string[] {
  const salida: string[] = [];
  for (const args of argumentosDeDecorador(texto, decorador)) {
    for (const m of args.matchAll(/['"]([^'"]+)['"]/g)) salida.push(m[1]);
  }
  return salida;
}

// ══════════════════════════════════════════════════════════════════════════
// 3 · Dentro de un array
// ══════════════════════════════════════════════════════════════════════════

/**
 * Contenido del array `nombre: [ … ]`, contando corchetes.
 *
 * ⚠️ El otro lugar donde "contiene el nombre" engaña. `HealthModule` aparece en
 * el `import` de `app.module.ts`, así que un barrido que buscara el nombre en
 * el archivo daba verde con el módulo importado **pero no registrado**. Mi
 * prueba de eso no falló en su primera reversión, exactamente por esto.
 */
export function dentroDeArray(texto: string, nombre: string): string | null {
  const codigo = soloCodigo(texto);
  // ⚠️ La comilla de cierre es OPCIONAL a propósito: en un `tsconfig.json` la
  // clave se escribe `"exclude": [ … ]` y sin esto la marca no encontraba nada,
  // así que `registradoEnArray` devolvía `false` para un array que SÍ tenía el
  // símbolo. Un `false` por no saber leer se confunde con un `false` por
  // ausencia, y ahí la regla acusa a un archivo correcto.
  const marca = new RegExp(`\\b${nombre}["']?\\s*:\\s*\\[`);
  const m = marca.exec(codigo);
  if (!m) return null;

  let i = m.index + m[0].length;
  let profundidad = 1;
  const inicio = i;
  while (i < codigo.length && profundidad > 0) {
    if (codigo[i] === '[') profundidad += 1;
    else if (codigo[i] === ']') profundidad -= 1;
    i += 1;
  }
  return codigo.slice(inicio, i - 1);
}

/** ¿Está `simbolo` registrado en el array `nombre: [ … ]`? */
export function registradoEnArray(texto: string, nombre: string, simbolo: string): boolean {
  const bloque = dentroDeArray(texto, nombre);
  return bloque !== null && new RegExp(`\\b${simbolo}\\b`).test(bloque);
}

// ══════════════════════════════════════════════════════════════════════════
// 4 · Rutas HTTP
// ══════════════════════════════════════════════════════════════════════════

export interface RutaHttp {
  /** `Post`, `Put`, `Patch`, `Delete`, `Get`. */
  metodo: string;
  /** El camino declarado: `':id/logs'`, o `''` para la raíz. */
  camino: string;
  /** Línea (1-indexada) del decorador del método. */
  linea: number;
  /** Los decoradores que acompañan al handler, en su bloque. */
  decoradores: string[];
  /** El texto completo de la firma del handler. */
  firma: string;
}

const METODOS_ESCRITURA = ['Post', 'Put', 'Patch', 'Delete'];

/**
 * Rutas declaradas en un controlador, con SUS decoradores.
 *
 * ⚠️ La diferencia con "buscar el decorador en el archivo": acá cada ruta lleva
 * los decoradores de SU bloque. Un controlador puede tener diez rutas con
 * permiso y una sin, y buscar en el archivo entero diría que está protegido.
 *
 * El bloque de una ruta son las líneas de decoradores CONTIGUAS que la
 * preceden, hacia arriba hasta la primera línea que no sea decorador,
 * comentario o blanco.
 */
export function rutasDe(texto: string): RutaHttp[] {
  const lineas = soloCodigo(texto).split('\n');
  const salida: RutaHttp[] = [];

  for (let i = 0; i < lineas.length; i++) {
    const m = /^\s*@(Get|Post|Put|Patch|Delete)\(\s*(?:['"]([^'"]*)['"])?/.exec(lineas[i]);
    if (!m) continue;

    // Hacia arriba: decoradores del mismo bloque.
    const decoradores: string[] = [lineas[i].trim()];
    for (let j = i - 1; j >= 0; j--) {
      const l = lineas[j].trim();
      if (l === '' || l.startsWith('*') || l.startsWith('/*')) continue;
      if (l.startsWith('@')) { decoradores.push(l); continue; }
      break;
    }

    // Hacia abajo: los decoradores que van entre el método y la firma, y la
    // firma misma. `@HttpCode` suele ir después de `@Post`.
    //
    // ⚠️ Las líneas EN BLANCO no cortan el bloque, y esto no es un detalle: como
    // el texto viene de `soloCodigo`, un comentario ya se convirtió en espacios.
    // La primera versión cortaba ahí, y `operational-protocols` —que tiene tres
    // líneas de comentario entre `@Post()` y `@Roles(...)`— aparecía como ruta
    // SIN autorización teniéndola. Lo encontró la medición, no la lectura: es
    // el mismo error de "leer el archivo en vez del lugar" que este módulo
    // viene a evitar, otra vez, dentro del propio módulo.
    let k = i + 1;
    while (k < lineas.length) {
      const l = lineas[k].trim();
      if (l === '') { k += 1; continue; }
      if (!l.startsWith('@')) break;
      decoradores.push(l);
      k += 1;
    }
    const firma = lineas.slice(k, k + 4).join(' ');

    salida.push({
      metodo: m[1],
      camino: m[2] ?? '',
      linea: i + 1,
      decoradores,
      firma,
    });
  }

  return salida;
}

/** Sólo las rutas que ESCRIBEN. */
export const rutasDeEscritura = (texto: string): RutaHttp[] =>
  rutasDe(texto).filter((r) => METODOS_ESCRITURA.includes(r.metodo));

/** ¿Esta ruta declara alguna autorización propia? */
export const rutaTieneAutorizacion = (r: RutaHttp): boolean =>
  r.decoradores.some((d) => d.startsWith('@RequirePermissions(') || d.startsWith('@Roles('));

// ══════════════════════════════════════════════════════════════════════════
// 5 · Métodos de clase
// ══════════════════════════════════════════════════════════════════════════

export interface Metodo {
  nombre: string;
  /** Cuerpo del método, entre llaves. */
  cuerpo: string;
  /** Línea (1-indexada) donde empieza. */
  linea: number;
  /** Línea donde termina. */
  lineaFin: number;
}

/**
 * Métodos de una clase, con su cuerpo delimitado por llaves.
 *
 * ⚠️ POR QUÉ HACE FALTA MIRAR EL MÉTODO Y NO LA LLAMADA.
 *
 * La primera versión de la regla de aislamiento miraba sólo los ARGUMENTOS de
 * cada consulta, y marcó cuatro servicios que sí filtran por tenant. Todos
 * hacían lo mismo, que es lo normal en este repositorio:
 *
 *     const where: any = {};
 *     if (!esAdmin) where.tenant_id = user.tenantId;   ← el filtro está acá
 *     …
 *     return this.prisma.extended.securityKey.findMany({ where });
 *
 * El filtro existe, pero no dentro del paréntesis. Una regla que sólo mire ahí
 * produce cuatro falsos positivos, y una regla que grita en falso se apaga: es
 * la forma más rápida de que un barrido deje de proteger.
 */
/**
 * Lo que se escribe como una llamada pero no lo es: control de flujo. Ninguna
 * de éstas puede ser el nombre de un método, así que descartarlas no pierde
 * nada real.
 */
const PALABRAS_RESERVADAS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'do', 'else', 'with', 'function',
]);
// ⚠️ La lista es CORTA a propósito: sólo control de flujo. `delete`, `get`,
// `set` y `constructor` también son palabras del lenguaje, pero acá SON
// métodos reales —`async delete(id: string)` está en media docena de
// servicios— y meterlas convertiría un falso positivo en un falso negativo,
// que es el cambio malo: la regla dejaría de mirar dentro de ellos sin avisar.

export function metodosDe(texto: string): Metodo[] {
  const codigo = soloCodigo(texto);
  const salida: Metodo[] = [];
  // Sólo el ARRANQUE de la firma: indentación, modificadores, nombre y el
  // paréntesis. Lo que sigue se recorre contando, no con una expresión.
  const patron = /^[ \t]{2,}(?:public |private |protected |static )*(?:async )?([a-zA-Z_$][\w$]*)\s*\(/gm;

  for (const m of codigo.matchAll(patron)) {
    // ⚠️ `if (…) {` indentado tiene EXACTAMENTE la misma forma que un método,
    // y ningún lenguaje regular las distingue. Lo encontró la medición, no la
    // lectura: R6 marcaba `trips/trips.service.ts:235 if`, `:238`, `:241` y
    // `:244` —cuatro `if` anidados dentro de un método que sí comprueba la
    // pertenencia— como si fueran métodos que no la comprobaban.
    //
    // Importa más de lo que parece: un `if` tomado por método parte el cuerpo
    // real en trozos, y una regla que pregunta "¿este método filtra por
    // tenant?" pasa a mirar cuatro líneas en vez del método entero. Da falsos
    // positivos acá, y donde el `if` envuelva la consulta pero el filtro esté
    // arriba, daría el falso NEGATIVO que es el que hace daño.
    if (PALABRAS_RESERVADAS.has(m[1])) continue;

    // 1 · Los PARÁMETROS, contando paréntesis.
    //
    // ⚠️ Acá estaba el peor defecto de esta primitiva. La versión anterior
    // cerraba la firma con `\([^;]*?\)`, o sea prohibía el punto y coma —y un
    // parámetro tipado en línea lo tiene:
    //
    //     async inviteUser(tenantId: string, data: { email: string; ... })
    //
    // Con ese patrón `inviteUser` NO ERA UN MÉTODO para el barrido, y tampoco
    // `createTenant`. Los dos escriben `role_code`; `inviteUser` es la ruta
    // exacta de la escalada de la Tanda 3. La regla que los vigila corría
    // sobre un archivo del que faltaban justo esos dos métodos, y daba verde.
    // No lo encontré leyendo: lo dijo la comprobación de exenciones muertas al
    // avisar que `createTenant` no existía.
    let i = (m.index ?? 0) + m[0].length;
    let parentesis = 1;
    while (i < codigo.length && parentesis > 0) {
      if (codigo[i] === '(') parentesis += 1;
      else if (codigo[i] === ')') parentesis -= 1;
      i += 1;
    }

    // 2 · Saltar el tipo de retorno hasta la llave del CUERPO.
    //
    // ⚠️ No sirve buscar la primera `{` después del `)`: en
    // `resetUserPassword(...): Promise<{ newPassword: string }>` esa llave es
    // parte del TIPO. Por eso se cuenta la profundidad de `<>` y sólo vale la
    // llave que aparece a profundidad cero.
    let angulo = 0;
    let inicioCuerpo = -1;
    while (i < codigo.length) {
      const c = codigo[i];
      if (c === '<') angulo += 1;
      else if (c === '>') angulo = Math.max(0, angulo - 1);
      else if (angulo === 0 && c === '{') { inicioCuerpo = i + 1; break; }
      // Una declaración sin cuerpo (interfaz, sobrecarga) termina en `;`, y
      // un `=` sería una propiedad, no un método. Ni una ni otra son esto.
      else if (angulo === 0 && (c === ';' || c === '=')) break;
      i += 1;
    }
    if (inicioCuerpo < 0) continue;

    // 3 · El CUERPO, contando llaves.
    let j = inicioCuerpo;
    let profundidad = 1;
    while (j < codigo.length && profundidad > 0) {
      if (codigo[j] === '{') profundidad += 1;
      else if (codigo[j] === '}') profundidad -= 1;
      j += 1;
    }

    salida.push({
      nombre: m[1],
      cuerpo: codigo.slice(inicioCuerpo, j - 1),
      linea: codigo.slice(0, m.index).split('\n').length,
      lineaFin: codigo.slice(0, j).split('\n').length,
    });
  }

  return salida;
}

/** El método que contiene esa línea, si alguno. */
export const metodoEnLinea = (metodos: Metodo[], linea: number): Metodo | undefined =>
  metodos.find((m) => linea >= m.linea && linea <= m.lineaFin);

// ══════════════════════════════════════════════════════════════════════════
// 6 · Llamadas a Prisma
// ══════════════════════════════════════════════════════════════════════════

export interface LlamadaPrisma {
  /** `vehicle`, `trip`, … tal como se escribe en `prisma.<delegate>`. */
  delegate: string;
  /** `findMany`, `findFirst`, `updateMany`, … */
  operacion: string;
  /** Los argumentos completos de la llamada. */
  argumentos: string;
  linea: number;
}

/**
 * Llamadas `prisma.<delegate>.<op>( … )`, con sus argumentos.
 *
 * Cubre también `this.prisma.extended.<delegate>` y `tx.<delegate>` dentro de
 * una transacción, que son las tres formas que usa este repositorio.
 */
export function llamadasPrisma(texto: string): LlamadaPrisma[] {
  const codigo = soloCodigo(texto);
  const salida: LlamadaPrisma[] = [];
  const patron =
    /\b(?:this\.)?(?:prisma|tx)\.(?:extended\.)?([a-zA-Z_][\w]*)\.(findMany|findFirst|findUnique|updateMany|deleteMany|count|aggregate|groupBy)\s*\(/g;

  for (const m of codigo.matchAll(patron)) {
    let i = (m.index ?? 0) + m[0].length;
    let profundidad = 1;
    const inicio = i;
    while (i < codigo.length && profundidad > 0) {
      if (codigo[i] === '(') profundidad += 1;
      else if (codigo[i] === ')') profundidad -= 1;
      i += 1;
    }
    salida.push({
      delegate: m[1],
      operacion: m[2],
      argumentos: codigo.slice(inicio, i - 1),
      linea: codigo.slice(0, m.index).split('\n').length,
    });
  }

  return salida;
}

// ══════════════════════════════════════════════════════════════════════════
// 7 · Importaciones que nadie usa
// ══════════════════════════════════════════════════════════════════════════

/**
 * Los símbolos importados que NO aparecen en ninguna otra parte del archivo.
 *
 * ⚠️ Ésta es la forma exacta del hallazgo que dio origen a la tanda:
 * `routes.findAll` importaba `tenantWhere` y no lo llamaba. El archivo se lee
 * perfecto, `tsc` no dice nada —un import sin usar no es un error de tipos— y
 * ninguna prueba lo ve. El import declara una intención que el código no
 * cumple, igual que un `@Roles` sin guard.
 *
 * Cómo se busca el uso: sobre `sinComentarios`, que además VACÍA los literales
 * de texto. Si se buscara sobre el texto crudo, un `throw new Error('usá
 * tenantWhere')` haría pasar por usado un símbolo que sólo se NOMBRA en un
 * mensaje. La contracomprobación está en `reglas.spec.ts`: la lista de esta
 * función se compara contra la de `tsc --noUnusedLocals`, que es la autoridad.
 */
export function importacionesSinUsar(texto: string): string[] {
  const codigo = soloCodigo(texto);
  // Mismo `[^;]` que abajo, y por el mismo motivo: con `[\s\S]` un import de
  // efecto se comería el código que hay hasta el `from` siguiente, y entonces
  // símbolos que SÍ se usan aparecerían como muertos.
  const cuerpo = sinComentarios(texto).replace(/^import\s[^;]*?from\s*['"][^'"]+['"];?/gm, '');

  const simbolos: string[] = [];
  // ⚠️ `[^;]` y no `[\s\S]`: con el segundo, un import de EFECTO —
  // `import './common/config/cargar-env';`, que no tiene `from`— hacía que la
  // expresión siguiera buscando en la línea siguiente y devolviera basura como
  // símbolo. Lo delató comparar contra `tsc`: 8 hallazgos contra sus 7.
  for (const m of codigo.matchAll(/^import\s+(?!type\s)([^;]*?)\s+from\s*['"][^'"]+['"]/gm)) {
    const clausula = m[1].trim();
    // `import * as x from …` — el namespace es el símbolo.
    const ns = /^\*\s+as\s+([\w$]+)$/.exec(clausula);
    if (ns) { simbolos.push(ns[1]); continue; }

    // Lo de antes de la llave es el import por defecto.
    const llave = clausula.indexOf('{');
    const porDefecto = (llave < 0 ? clausula : clausula.slice(0, llave)).replace(/,\s*$/, '').trim();
    if (porDefecto && !porDefecto.startsWith('*')) simbolos.push(porDefecto);

    if (llave < 0) continue;
    const dentro = clausula.slice(llave + 1, clausula.lastIndexOf('}'));
    for (const parte of dentro.split(',')) {
      const t = parte.trim().replace(/^type\s+/, '');
      if (!t) continue;
      // `A as B`: lo que se usa en el archivo es B.
      const alias = /^([\w$]+)\s+as\s+([\w$]+)$/.exec(t);
      simbolos.push(alias ? alias[2] : t);
    }
  }

  return simbolos.filter((s) => s && !new RegExp(`\\b${s}\\b`).test(cuerpo));
}

// ══════════════════════════════════════════════════════════════════════════
// 8 · Qué métodos de una clase ESCRIBEN — siguiendo las llamadas internas
// ══════════════════════════════════════════════════════════════════════════

/** Las formas en que este repositorio escribe en la base. */
const ESCRITURA =
  /INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/i;

/**
 * Los métodos de un archivo que escriben en la base, DIRECTA o INDIRECTAMENTE.
 *
 * ⚠️ LA TRANSITIVIDAD NO ES UN LUJO: ES LO QUE HACE QUE LA REGLA PUEDA FALLAR.
 *
 * La primera versión miraba sólo el cuerpo del método, y medida contra el
 * repositorio encontró CATORCE métodos que escriben, todos con llamador — o
 * sea, verde. Pero el método que motivó la regla, `SeguimientoService.recalcular`,
 * NO aparecía en esa lista: escribe a través de un privado (`persistir`), así
 * que su cuerpo no tiene ningún INSERT.
 *
 * Habría sido una regla nueva, escrita a propósito para cazar un defecto
 * concreto, incapaz de cazar ese defecto. Es exactamente el género de barrido
 * decorativo que la Tanda 8 encontró seis veces.
 *
 * Con el cierre transitivo aparece, y es el único culpable de todo el motor.
 */
export function metodosQueEscriben(texto: string): Set<string> {
  const metodos = metodosDe(texto);
  const escriben = new Set<string>();

  for (const m of metodos) {
    if (ESCRITURA.test(m.cuerpo)) escriben.add(m.nombre);
  }

  // Punto fijo: se repite hasta que no se agregue ninguno más. El tope de
  // vueltas es la cantidad de métodos — una cadena no puede ser más larga.
  for (let vuelta = 0; vuelta < metodos.length; vuelta += 1) {
    let crecio = false;
    for (const m of metodos) {
      if (escriben.has(m.nombre)) continue;
      for (const otro of escriben) {
        if (new RegExp(`this\\.${otro}\\s*\\(`).test(m.cuerpo)) {
          escriben.add(m.nombre);
          crecio = true;
          break;
        }
      }
    }
    if (!crecio) break;
  }

  return escriben;
}

/**
 * ¿El método está declarado `private`?
 *
 * Se mira la línea de la declaración y no el cuerpo: un `private` mencionado
 * adentro del método no lo hace privado.
 */
export function esPrivado(texto: string, metodo: Metodo): boolean {
  const linea = soloCodigo(texto).split('\n')[metodo.linea - 1] ?? '';
  return /\bprivate\b/.test(linea);
}


// ══════════════════════════════════════════════════════════════════════════
// 9 · SQL crudo: qué columnas se leen y cuáles se escriben
// ══════════════════════════════════════════════════════════════════════════

/**
 * Las sentencias SQL escritas como plantilla, con los comentarios SQL fuera.
 *
 * ⚠️ DOS CAPAS DE COMENTARIOS, Y LAS DOS MUERDEN.
 *
 * La primera es `soloCodigo`, que saca los `//` de TypeScript. Sin eso, el
 * comentario de `condiciones.service.ts` que dice «el último punto conocido ya
 * está en `motor_estado_vehiculo`» contaría como una sentencia sobre esa tabla.
 *
 * La segunda son los `--` de SQL, que viven DENTRO de la plantilla y que
 * `soloCodigo` no toca. En `barrerSinReporte` hay cuatro líneas de `--`
 * explicando de dónde sale el umbral, y nombran columnas. Un barrido que las
 * leyera daría por leída una columna que la consulta no lee. Es, otra vez, la
 * prosa que explica el código haciéndose pasar por el código.
 *
 * No es un parser de SQL. Es un filtro para barridos, y cubre la única forma
 * en que este repositorio escribe SQL: plantillas con acento grave pasadas a
 * `$queryRaw` o `$executeRaw`.
 */
export function sentenciasSql(texto: string): string[] {
  const codigo = soloCodigo(texto);
  const salida: string[] = [];
  let i = 0;

  while (i < codigo.length) {
    if (codigo[i] !== '`') { i += 1; continue; }

    i += 1;
    const inicio = i;
    let profundidad = 0;
    while (i < codigo.length) {
      if (codigo[i] === '\\') { i += 2; continue; }
      if (codigo[i] === '$' && codigo[i + 1] === '{') { profundidad += 1; i += 2; continue; }
      if (profundidad > 0) {
        if (codigo[i] === '}') profundidad -= 1;
        i += 1;
        continue;
      }
      if (codigo[i] === '`') break;
      i += 1;
    }

    const bruto = codigo.slice(inicio, i);
    i += 1;
    // Los `--` de SQL, hasta el fin de línea.
    salida.push(bruto.replace(/--[^\n]*/g, ' '));
  }

  return salida;
}

/** Palabras que siguen a `from`/`join`/`update` y NO son tablas. */
const NO_SON_TABLAS = new Set([
  'set', 'skip', 'select', 'lateral', 'unnest', 'values', 'only', 'where',
  'on', 'as', 'using', 'left', 'right', 'inner', 'outer', 'full', 'cross',
]);

/**
 * Las tablas que estas sentencias nombran.
 *
 * ⚠️ El filtro de `NO_SON_TABLAS` no es cosmético. Sin él aparecían dos
 * «tablas» llamadas `set` y `skip`, sacadas de `DO UPDATE SET` y de
 * `FOR UPDATE SKIP LOCKED`. La de `set` era la peligrosa: como la palabra
 * aparece en toda sentencia con `DO UPDATE`, el barrido le atribuía veinte
 * columnas escritas que eran de otras tablas. Un barrido que inventa una
 * tabla también inventa sus conclusiones.
 */
export function tablasDe(sentencias: string[]): Set<string> {
  const tablas = new Set<string>();
  for (const sql of sentencias) {
    for (const m of sql.matchAll(/\b(?:from|join|into|update)\s+([a-z_][a-z0-9_]*)/gi)) {
      const t = m[1].toLowerCase();
      if (!NO_SON_TABLAS.has(t)) tablas.add(t);
    }
  }
  return tablas;
}

/** ¿Esta sentencia ESCRIBE en esa tabla? */
export const escribeEn = (sql: string, tabla: string): boolean =>
  new RegExp(`\\b(?:insert\\s+into|update)\\s+${tabla}\\b`, 'i').test(sql);

/**
 * ¿Esta sentencia LEE esa tabla (la nombra en un FROM o un JOIN)?
 *
 * ⚠️ El `delete from` NO es una lectura, y excluirlo no es un detalle: la
 * primera versión lo contaba y reportaba el `DELETE FROM
 * motor_vehiculos_activos` como una lectura que no podía analizar. Un barrido
 * que se queja de algo correcto se desactiva solo, porque el primer reflejo
 * ante una regla que grita en falso es callarla.
 */
export const leeDe = (sql: string, tabla: string): boolean =>
  new RegExp(`\\b(?:from|join)\\s+${tabla}\\b`, 'i').test(sql) &&
  !new RegExp(`\\bdelete\\s+from\\s+${tabla}\\b`, 'i').test(sql);

/** Lo que puede seguir al nombre de una tabla sin ser un alias. */
const PALABRAS_TRAS_TABLA = new Set([
  'where', 'group', 'order', 'limit', 'returning', 'having', 'union', 'for',
]);

/**
 * Los alias con los que una sentencia nombra a la tabla.
 *
 * `FROM t x`, `JOIN t AS x`, y el caso sin alias —`INSERT INTO t (…)`— que
 * devuelve el propio nombre de la tabla, porque así es como se la referencia.
 */
function aliasDe(sql: string, tabla: string): string[] {
  const alias = new Set<string>([tabla]);
  const patron = new RegExp(
    `\\b(?:from|join|into|update)\\s+${tabla}\\s+(?:as\\s+)?([a-zA-Z_]\\w*)`,
    'gi',
  );
  for (const m of sql.matchAll(patron)) {
    // `FROM t WHERE …` no declara un alias llamado `where`.
    const candidato = m[1].toLowerCase();
    if (NO_SON_TABLAS.has(candidato) || PALABRAS_TRAS_TABLA.has(candidato)) continue;
    alias.add(m[1]);
  }
  return [...alias];
}

/**
 * Columnas que las sentencias LEEN de esa tabla: todo `alias.columna`.
 *
 * ⚠️ Incluye las del `ON` de un JOIN. Es a propósito: una columna que sólo
 * sirve para unir sigue siendo una columna que la consulta necesita que
 * exista y que tenga valor.
 */
export function columnasLeidasDe(sentencias: string[], tabla: string): Set<string> {
  const leidas = new Set<string>();
  for (const sql of sentencias) {
    // Una sentencia que sólo escribe no lee: sus `EXCLUDED.x` no son lecturas
    // de la tabla y sus columnas ya las cuenta `columnasEscritasEn`.
    if (!leeDe(sql, tabla)) continue;

    const alias = aliasDe(sql, tabla).filter((a) => a !== tabla);
    if (alias.length > 0) {
      for (const a of alias) {
        for (const m of sql.matchAll(new RegExp(`\\b${a}\\.(\\w+)`, 'g'))) {
          leidas.add(m[1].toLowerCase());
        }
      }
      continue;
    }

    // Sin alias. Si la sentencia nombra UNA SOLA tabla, un identificador suelto
    // no puede ser de otra: se puede atribuir sin adivinar. Si nombra varias,
    // no se toca — la reporta `lecturasSinAlias`.
    if (tablasDe([sql]).size === 1) {
      for (const col of identificadoresSueltos(sql, tablasDe([sql]))) leidas.add(col);
    }
  }
  return leidas;
}

/** Palabras de SQL que aparecen sueltas y no son columnas. */
const PALABRAS_SQL = new Set([
  'select', 'from', 'where', 'group', 'by', 'order', 'having', 'limit', 'offset',
  'and', 'or', 'not', 'is', 'null', 'as', 'asc', 'desc', 'distinct', 'on', 'in',
  'insert', 'into', 'values', 'update', 'set', 'delete', 'join', 'left', 'right',
  'inner', 'outer', 'full', 'cross', 'lateral', 'union', 'all', 'case', 'when',
  'then', 'else', 'end', 'exists', 'returning', 'conflict', 'do', 'nothing',
  'with', 'using', 'true', 'false', 'between', 'like', 'ilike', 'any', 'array',
  'int', 'text', 'uuid', 'float8', 'boolean', 'interval', 'timestamptz',
  'epoch', 'nulls', 'first', 'last', 'for', 'of', 'skip', 'locked', 'only',
]);

/**
 * Identificadores sueltos de una sentencia de UNA sola tabla.
 *
 * Se descartan: las palabras de SQL, lo que va pegado a un `(` —que es una
 * función y no una columna—, lo que sigue a un `AS` —que es un nombre de
 * salida, no de entrada—, lo que va después de un punto, que ya lo cuenta la
 * rama con alias, y EL NOMBRE DE LA TABLA, que viene justo detrás del `FROM`
 * y que la primera versión devolvía como si fuera una columna de sí misma.
 */
function identificadoresSueltos(sql: string, tablas: Set<string>): string[] {
  const salida: string[] = [];
  const sinCast = sql.replace(/::\s*\w+/g, ' ');
  const patron = /(\bas\s+)?(?<![.\w])([a-zA-Z_]\w*)\s*(\()?/gi;
  for (const m of sinCast.matchAll(patron)) {
    if (m[1] || m[3]) continue;
    const id = m[2].toLowerCase();
    if (PALABRAS_SQL.has(id) || tablas.has(id)) continue;
    salida.push(id);
  }
  return salida;
}

/**
 * Columnas que las sentencias ESCRIBEN en esa tabla.
 *
 * Dos lugares, porque este repositorio hace `upsert` a mano: la lista de
 * columnas del `INSERT` y las asignaciones del `ON CONFLICT … DO UPDATE SET`.
 * Se devuelven unidas: la pregunta que esta primitiva contesta es «¿alguien
 * le pone valor a esta columna alguna vez?».
 */
export function columnasEscritasEn(sentencias: string[], tabla: string): Set<string> {
  const escritas = new Set<string>();

  for (const sql of sentencias) {
    if (!escribeEn(sql, tabla)) continue;

    // 1 · La lista de columnas del INSERT: el primer paréntesis tras la tabla.
    const insert = new RegExp(`insert\\s+into\\s+${tabla}\\s*\\(([^)]*)\\)`, 'i').exec(sql);
    if (insert) {
      for (const col of insert[1].split(',')) {
        const limpio = col.trim().toLowerCase();
        if (/^\w+$/.test(limpio)) escritas.add(limpio);
      }
    }

    // 2 · Las asignaciones del DO UPDATE SET, y las del UPDATE suelto.
    const set = /\bset\b([\s\S]*?)(?:\bwhere\b|\breturning\b|$)/i.exec(sql);
    if (set && (insert || new RegExp(`update\\s+${tabla}\\b`, 'i').test(sql))) {
      for (const m of set[1].matchAll(/(?:^|,)\s*(\w+)\s*=/g)) {
        escritas.add(m[1].toLowerCase());
      }
    }
  }

  return escritas;
}

/**
 * Lecturas de la tabla que este barrido NO puede analizar: las que no le
 * ponen alias, donde `SELECT columna FROM tabla` no se distingue de una
 * columna de otra tabla del mismo `FROM`.
 *
 * ⚠️ Existe para que el barrido diga «no sé» en vez de «está bien». Un
 * escáner que devuelve el conjunto vacío cuando no entendió la entrada es
 * indistinguible de uno que no encontró nada, y ésa es exactamente la forma
 * de error que esta serie viene cazando desde la Tanda 8.
 */
export function lecturasSinAlias(sentencias: string[], tabla: string): string[] {
  return sentencias
    .filter(
      (sql) =>
        leeDe(sql, tabla) &&
        aliasDe(sql, tabla).length === 1 &&
        // Con una sola tabla en juego no hay ambigüedad: `columnasLeidasDe`
        // la resuelve. La ambigüedad aparece cuando hay más de una.
        tablasDe([sql]).size > 1,
    )
    .map((sql) => sql.trim().replace(/\s+/g, ' ').slice(0, 90));
}

/**
 * Las tablas cuyo ÚNICO escritor está dentro de la carpeta del motor.
 *
 * ⚠️ Sin esto, la regla que compara lecturas contra escrituras es falsa. El
 * motor lee `trips` en ocho columnas y sólo escribe dos: no es un defecto, es
 * que `trips` la escribe el módulo de declaración de viajes. Una regla que
 * exija que el motor escriba todo lo que lee sobre una tabla ajena da ocho
 * culpables inocentes en la primera corrida — y una regla que arranca con
 * ocho exenciones enseña a agregar la novena.
 *
 * `archivosDelMotor` y `archivosRestantes` se pasan ya leídos para no releer
 * el árbol dentro de la regla.
 */
export function tablasPropiasDelMotor(
  sentenciasDelMotor: string[],
  sentenciasDelResto: string[],
): string[] {
  const propias: string[] = [];
  for (const tabla of tablasDe(sentenciasDelMotor)) {
    const laEscribeElMotor = sentenciasDelMotor.some((s) => escribeEn(s, tabla));
    if (!laEscribeElMotor) continue;
    const laEscribeOtro = sentenciasDelResto.some((s) => escribeEn(s, tabla));
    if (laEscribeOtro) continue;
    propias.push(tabla);
  }
  return propias.sort();
}

/**
 * ¿El código CREA las filas de esta tabla? (tiene un `INSERT INTO t (…)`)
 *
 * ⚠️ Es la pregunta que define de quién es la tabla, y separa tres cosas que
 * un barrido ingenuo mezcla:
 *
 *   · `motor_tipos_condicion` y los otros tres catálogos del vocabulario: el
 *     código los LEE y no los escribe nunca. Las carga un script de la Etapa 0.
 *     Exigirles un escritor en el código daría veinte culpables inocentes.
 *   · `motor_cola`: medido, no hay un solo `INSERT INTO motor_cola` en
 *     `apps/`. Las filas las pone la base. El código las toma y las marca.
 *   · `motor_estado_vehiculo`, `motor_trabajos`, `motor_vehiculos_activos`:
 *     el código crea las filas. Acá sí, una columna que se lee y nadie
 *     escribe es un defecto y no un reparto de tareas.
 */
export const creaFilasDe = (sentencias: string[], tabla: string): boolean =>
  sentencias.some((s) => new RegExp(`insert\\s+into\\s+${tabla}\\s*\\(`, 'i').test(s));
