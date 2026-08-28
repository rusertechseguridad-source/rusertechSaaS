/**
 * verificar-prisma-guard — Fase D
 *
 * Autotest del bloqueo. Se corre desde apps/api:
 *     node scripts/verificar-prisma-guard.cjs
 *
 * Comprueba las tres capas y la clasificación de comandos. La prueba en vivo
 * usa `--schema` apuntando a una ruta inexistente: si el bloqueo está puesto
 * corta antes de mirar el schema (código 87); si NO está puesto, Prisma falla
 * por schema no encontrado sin llegar a conectarse a la base. En ninguno de
 * los dos casos se toca la base.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RAIZ = path.resolve(__dirname, '..');
const guard = require('./prisma-guard.cjs');

let fallas = 0;

function comprobar(descripcion, condicion, detalle) {
  const marca = condicion ? 'OK  ' : 'FALLA';
  process.stdout.write(`  [${marca}] ${descripcion}${detalle ? ` — ${detalle}` : ''}\n`);
  if (!condicion) fallas += 1;
}

process.stdout.write('\nCapa 1 — shim en node_modules/.bin/prisma\n');
const rutaDelBin = path.join(RAIZ, 'node_modules', '.bin', 'prisma');
const existeBin = fs.existsSync(rutaDelBin);
const esShim = existeBin && !fs.lstatSync(rutaDelBin).isSymbolicLink()
  && fs.readFileSync(rutaDelBin, 'utf8').includes('prisma-guard');
comprobar('node_modules/.bin/prisma es el shim (no el symlink original)', esShim,
  esShim ? '' : 'corré `npm install` o `node scripts/instalar-prisma-guard.cjs`');

process.stdout.write('\nCapa 2 — prisma.config.ts\n');
const rutaDelConfig = path.join(RAIZ, 'prisma.config.ts');
const configOk = fs.existsSync(rutaDelConfig)
  && fs.readFileSync(rutaDelConfig, 'utf8').includes('abortarSiEstaBloqueado');
comprobar('prisma.config.ts invoca al guard', configOk);
comprobar('prisma.config.ts repone la carga de .env (dotenv)', configOk
  && fs.readFileSync(rutaDelConfig, 'utf8').includes('dotenv/config'));

process.stdout.write('\nCapa 3 — hooks de git\n');
const hooksPath = spawnSync('git', ['config', '--get', 'core.hooksPath'],
  { cwd: RAIZ, encoding: 'utf8' }).stdout.trim();
comprobar('core.hooksPath apunta a .githooks', hooksPath === '.githooks',
  hooksPath ? `valor actual: ${hooksPath}` : 'sin configurar');

process.stdout.write('\nClasificación de comandos\n');
const CASOS_BLOQUEADOS = [
  ['migrate', 'dev', '--name', 'x'], ['migrate', 'deploy'], ['migrate', 'reset'],
  ['migrate', 'resolve', '--applied', '001'], ['migrate'],
  ['db', 'push'], ['db', 'push', '--accept-data-loss'],
];
const CASOS_PERMITIDOS = [
  ['generate'], ['db', 'pull'], ['db', 'seed'], ['validate'], ['format'], ['studio'],
  ['migrate', 'status'], ['migrate', 'diff', '--from-url', 'a', '--to-url', 'b'],
  ['generate', '--schema', './migrate/schema.prisma'],
];
for (const caso of CASOS_BLOQUEADOS) {
  comprobar(`bloquea  prisma ${caso.join(' ')}`, guard.evaluarComando(caso).bloqueado);
}
for (const caso of CASOS_PERMITIDOS) {
  comprobar(`permite  prisma ${caso.join(' ')}`, !guard.evaluarComando(caso).bloqueado);
}

process.stdout.write('\nPrueba en vivo (no toca la base)\n');
const schemaInexistente = path.join(RAIZ, 'no-existe-verificacion-guard.prisma');
const vivo = spawnSync('npx', ['prisma', 'migrate', 'dev', '--name', 'verificacion', '--schema', schemaInexistente],
  { cwd: RAIZ, encoding: 'utf8' });
comprobar(`\`npx prisma migrate dev\` corta con código ${guard.CODIGO_DE_SALIDA_BLOQUEADO}`,
  vivo.status === guard.CODIGO_DE_SALIDA_BLOQUEADO, `código obtenido: ${vivo.status}`);

process.stdout.write(fallas === 0
  ? '\nTodo en orden: el bloqueo está activo.\n\n'
  : `\n${fallas} verificación(es) fallaron. El bloqueo NO está completo.\n\n`);
process.exit(fallas === 0 ? 0 : 1);
