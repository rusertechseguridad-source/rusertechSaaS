/**
 * instalar-prisma-guard — Fase D
 *
 * Se ejecuta como `postinstall` de apps/api. Reescribe el binario
 * node_modules/.bin/prisma con un shim que consulta prisma-guard.cjs antes de
 * delegar en la CLI real.
 *
 * Por qué hace falta: `npm ci`, un `rm -rf node_modules` o un cambio de
 * versión de prisma reemplazan node_modules/.bin/prisma por el symlink
 * original y se llevan el shim puesto. npm corre postinstall después de
 * enlazar los bin, así que este script lo vuelve a poner en cada instalación.
 *
 * Regla dura: NUNCA puede hacer fallar un `npm install`. Todo error se
 * reporta por stderr y se sale con código 0.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const RAIZ_DEL_PAQUETE = path.resolve(__dirname, '..');
const DIRECTORIO_BIN = path.join(RAIZ_DEL_PAQUETE, 'node_modules', '.bin');
const RUTA_DEL_GUARD = path.join(__dirname, 'prisma-guard.cjs');
const NOMBRE_DEL_HOOK_PATH = '.githooks';

function avisar(mensaje) {
  process.stderr.write(`[prisma-guard] ${mensaje}\n`);
}

function rutaRelativaPosix(desde, hasta) {
  return path.relative(desde, hasta).split(path.sep).join('/');
}

function contenidoDelShim() {
  const guardRelativo = rutaRelativaPosix(DIRECTORIO_BIN, RUTA_DEL_GUARD);
  const raizRelativa = rutaRelativaPosix(DIRECTORIO_BIN, RAIZ_DEL_PAQUETE);
  return `#!/usr/bin/env node
// GENERADO POR apps/api/scripts/instalar-prisma-guard.cjs — NO EDITAR A MANO.
// Reemplaza el symlink de node_modules/.bin/prisma para interceptar los
// comandos destructivos antes de que la CLI real arranque.
'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const argumentos = process.argv.slice(2);
const rutaDelGuard = path.join(__dirname, ${JSON.stringify(guardRelativo)});
const raizDelPaquete = path.join(__dirname, ${JSON.stringify(raizRelativa)});

try {
  require(rutaDelGuard).abortarSiEstaBloqueado(argumentos, 'node_modules/.bin/prisma');
} catch (error) {
  if (error && error.code === 'MODULE_NOT_FOUND') {
    process.stderr.write('[prisma-guard] No se encontró prisma-guard.cjs; se ejecuta Prisma sin protección.\\n');
  } else {
    throw error;
  }
}

const cliReal = require.resolve('prisma/build/index.js', { paths: [raizDelPaquete] });
const resultado = spawnSync(process.execPath, [cliReal, ...argumentos], { stdio: 'inherit' });
if (resultado.error) throw resultado.error;
if (resultado.signal) process.kill(process.pid, resultado.signal);
process.exit(resultado.status === null ? 1 : resultado.status);
`;
}

function contenidoDelCmdDeWindows() {
  return '@ECHO off\r\nnode "%~dp0\\prisma" %*\r\n';
}

function contenidoDelPs1DeWindows() {
  return '#!/usr/bin/env pwsh\nnode "$PSScriptRoot/prisma" $args\nexit $LASTEXITCODE\n';
}

function escribirShim() {
  if (!fs.existsSync(DIRECTORIO_BIN)) {
    avisar(`No existe ${DIRECTORIO_BIN}; nada que proteger todavía.`);
    return false;
  }
  if (!fs.existsSync(RUTA_DEL_GUARD)) {
    avisar(`Falta ${RUTA_DEL_GUARD}; no se instala el shim.`);
    return false;
  }

  const destino = path.join(DIRECTORIO_BIN, 'prisma');
  fs.rmSync(destino, { force: true });
  fs.writeFileSync(destino, contenidoDelShim(), { mode: 0o755 });
  fs.chmodSync(destino, 0o755);

  for (const [nombre, contenido] of [
    ['prisma.cmd', contenidoDelCmdDeWindows()],
    ['prisma.ps1', contenidoDelPs1DeWindows()],
  ]) {
    const rutaWindows = path.join(DIRECTORIO_BIN, nombre);
    fs.rmSync(rutaWindows, { force: true });
    fs.writeFileSync(rutaWindows, contenido, { mode: 0o755 });
  }

  return true;
}

/** Ubica la raíz del repo, o null si no estamos dentro de un clon de git. */
function buscarRaizDelRepo() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: RAIZ_DEL_PAQUETE,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/** Deja los hooks versionados de .githooks/ activos en este clon. */
function activarHooksVersionados() {
  const raizDelRepo = buscarRaizDelRepo();
  if (!raizDelRepo) return false;
  if (!fs.existsSync(path.join(raizDelRepo, NOMBRE_DEL_HOOK_PATH))) return false;

  execFileSync('git', ['config', 'core.hooksPath', NOMBRE_DEL_HOOK_PATH], {
    cwd: raizDelRepo,
    stdio: 'ignore',
  });

  for (const hook of ['pre-commit', 'pre-push']) {
    const rutaDelHook = path.join(raizDelRepo, NOMBRE_DEL_HOOK_PATH, hook);
    if (fs.existsSync(rutaDelHook)) fs.chmodSync(rutaDelHook, 0o755);
  }
  return true;
}

function main() {
  let shimOk = false;
  try {
    shimOk = escribirShim();
  } catch (error) {
    avisar(`No se pudo instalar el shim: ${error.message}`);
  }

  let hooksOk = false;
  try {
    hooksOk = activarHooksVersionados();
  } catch (error) {
    avisar(`No se pudo configurar core.hooksPath: ${error.message}`);
  }

  if (shimOk) avisar('Bloqueo de prisma migrate / db push instalado en node_modules/.bin/prisma.');
  if (hooksOk) avisar(`Hooks de git activados (core.hooksPath=${NOMBRE_DEL_HOOK_PATH}).`);
}

main();
process.exit(0);
