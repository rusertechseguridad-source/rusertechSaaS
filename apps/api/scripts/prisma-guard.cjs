/**
 * prisma-guard — Fase D
 *
 * Núcleo de decisión del bloqueo de comandos destructivos de Prisma.
 * No sabe cómo se lo invoca (shim del bin, prisma.config.ts, hook de git):
 * sólo recibe argumentos y responde si el comando está permitido, y arma el
 * mensaje. La política vive acá y en un solo lugar.
 *
 * Por qué existe: prisma/schema.prisma no declara todos los objetos que hay
 * en la base (se crearon con SQL directo). Para Prisma eso es "drift" y
 * `migrate` / `db push` lo resuelven destruyendo lo que no está en el schema.
 */

'use strict';

const VARIABLE_DE_ESCAPE = 'RUSERTECH_DESBLOQUEAR_PRISMA_MIGRATE';
const VALOR_DE_ESCAPE = 'SI_ENTIENDO_QUE_PUEDO_BORRAR_LA_BASE_DE_PRODUCCION';

const CODIGO_DE_SALIDA_BLOQUEADO = 87;

/** Marca interna para no repetir el aviso de escape en el proceso hijo. */
const MARCA_DE_AVISO_YA_IMPRESO = 'RUSERTECH_PRISMA_GUARD_AVISO_IMPRESO';

/** Lo que el schema.prisma no declara y por lo tanto Prisma daría por sobrante. */
const OBJETOS_NO_DECLARADOS = {
  tablas: 18,
  indices: 13,
  vistas: 11,
  triggers: 6,
  funciones: 11,
};

/**
 * Subcomandos de `prisma migrate` que son de sólo lectura y no tocan la base.
 * Todo lo demás bajo `migrate` se bloquea (deny por defecto: si Prisma agrega
 * un subcomando nuevo y destructivo, ya queda cubierto sin tocar este archivo).
 */
const SUBCOMANDOS_MIGRATE_PERMITIDOS = new Set(['status', 'diff']);

/** Subcomandos de `prisma db` que reescriben la base para alinearla al schema. */
const SUBCOMANDOS_DB_BLOQUEADOS = new Set(['push']);

/**
 * Flags de la CLI de Prisma que consumen el token siguiente como valor.
 * Se saltean al buscar los argumentos posicionales, para que
 * `prisma generate --schema ./migrate/schema.prisma` no se confunda con
 * `prisma migrate`.
 */
const FLAGS_CON_VALOR = new Set([
  '--schema', '--config', '--name', '-n', '--url', '--shadow-database-url',
  '--from-url', '--to-url', '--from-schema-datamodel', '--to-schema-datamodel',
  '--from-schema-datasource', '--to-schema-datasource',
  '--from-migrations', '--to-migrations', '--applied', '--rolled-back',
  '--file', '--generator', '--output', '--browser', '--port', '--hostname',
]);

const FLAGS_DE_AYUDA = new Set(['--help', '-h']);

/** Devuelve los primeros argumentos posicionales, ignorando flags y sus valores. */
function extraerPosicionales(argumentos) {
  const posicionales = [];
  for (let i = 0; i < argumentos.length; i += 1) {
    const token = argumentos[i];
    if (!token.startsWith('-')) {
      posicionales.push(token);
      continue;
    }
    if (!token.includes('=') && FLAGS_CON_VALOR.has(token)) i += 1;
  }
  return posicionales;
}

function pidioAyuda(argumentos) {
  return argumentos.some((token) => FLAGS_DE_AYUDA.has(token));
}

/**
 * @returns {{ bloqueado: boolean, comando: string }}
 */
function evaluarComando(argumentos) {
  if (pidioAyuda(argumentos)) return { bloqueado: false, comando: '' };

  const [primero, segundo] = extraerPosicionales(argumentos);
  if (!primero) return { bloqueado: false, comando: '' };

  if (primero === 'migrate') {
    const esLectura = segundo !== undefined && SUBCOMANDOS_MIGRATE_PERMITIDOS.has(segundo);
    if (esLectura) return { bloqueado: false, comando: '' };
    return { bloqueado: true, comando: `prisma migrate${segundo ? ` ${segundo}` : ''}` };
  }

  if (primero === 'db' && segundo !== undefined && SUBCOMANDOS_DB_BLOQUEADOS.has(segundo)) {
    return { bloqueado: true, comando: `prisma db ${segundo}` };
  }

  return { bloqueado: false, comando: '' };
}

function escapeActivo() {
  return process.env[VARIABLE_DE_ESCAPE] === VALOR_DE_ESCAPE;
}

function construirMensajeDeBloqueo(comando, origen) {
  const o = OBJETOS_NO_DECLARADOS;
  const linea = '═'.repeat(74);
  return `
${linea}
  BLOQUEADO: \`${comando}\` no se ejecuta en este repositorio
${linea}

POR QUÉ
  prisma/schema.prisma NO declara todo lo que existe en la base. Hay objetos
  creados con SQL directo que Prisma desconoce por completo:

      ${o.tablas} tablas       ${o.indices} índices      ${o.vistas} vistas
       ${o.triggers} triggers     ${o.funciones} funciones

  Para Prisma eso es "drift". \`migrate dev\` lo lee como base desincronizada
  y ofrece (o aplica) un reset. \`db push\` alinea la base al schema borrando
  todo lo que sobra. Ninguno de los dos te va a preguntar por cada objeto.

QUÉ SE LLEVA PUESTO SI IGNORÁS ESTO
  Las ${o.tablas} tablas, los ${o.indices} índices, las ${o.vistas} vistas, los ${o.triggers} triggers y las ${o.funciones}
  funciones que el schema no declara. Esa base la comparten TRES productos
  en producción: el daño no queda dentro de este proyecto.

QUÉ HACER EN SU LUGAR
  1. Escribí el cambio como SQL directo y versionalo en el repo.
  2. Aplicalo con psql o el runner de SQL del proyecto.
  3. Reflejalo en el schema:    npx prisma db pull
  4. Regenerá el cliente:       npx prisma generate

ESTOS COMANDOS SIGUEN HABILITADOS
  prisma generate · prisma db pull · prisma db seed · prisma validate
  prisma format · prisma studio · prisma migrate status · prisma migrate diff

SI DE VERDAD HAY QUE CORRERLO (con backup hecho y alguien mirando)
  ${VARIABLE_DE_ESCAPE}=${VALOR_DE_ESCAPE} \\
    npx ${comando}

  El nombre y el valor deben coincidir exactos. No hay forma de activarlo
  por accidente ni por un comando mal tipeado.

  Guarda: apps/api/scripts/prisma-guard.cjs  ·  vía: ${origen}
${linea}
`;
}

function construirAvisoDeEscape(comando, origen) {
  const linea = '─'.repeat(74);
  return `
${linea}
  ⚠  ESCAPE ACTIVO: se permite \`${comando}\` porque ${VARIABLE_DE_ESCAPE}
     está seteada con el valor exacto de confirmación.
     Estás por dejar que Prisma reescriba una base compartida por tres
     productos en producción. Si no hiciste backup, cortá con Ctrl-C ahora.
     (vía: ${origen})
${linea}
`;
}

/**
 * Punto de entrada de los interceptores. Corta el proceso si corresponde.
 * @param {string[]} argumentos  process.argv.slice(2)
 * @param {string} origen        etiqueta de quién invoca (para el mensaje)
 */
function abortarSiEstaBloqueado(argumentos, origen) {
  const { bloqueado, comando } = evaluarComando(argumentos);
  if (!bloqueado) return;

  if (escapeActivo()) {
    // El shim delega en un proceso hijo que vuelve a evaluar vía prisma.config.ts.
    // Esta marca evita imprimir el aviso dos veces.
    if (process.env[MARCA_DE_AVISO_YA_IMPRESO] !== '1') {
      process.stderr.write(construirAvisoDeEscape(comando, origen));
      process.env[MARCA_DE_AVISO_YA_IMPRESO] = '1';
    }
    return;
  }

  process.stderr.write(construirMensajeDeBloqueo(comando, origen));
  process.exit(CODIGO_DE_SALIDA_BLOQUEADO);
}

module.exports = {
  VARIABLE_DE_ESCAPE,
  VALOR_DE_ESCAPE,
  CODIGO_DE_SALIDA_BLOQUEADO,
  OBJETOS_NO_DECLARADOS,
  evaluarComando,
  escapeActivo,
  construirMensajeDeBloqueo,
  abortarSiEstaBloqueado,
};
