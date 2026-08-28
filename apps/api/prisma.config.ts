/**
 * prisma.config.ts — Fase D
 *
 * Segunda capa del bloqueo de comandos destructivos de Prisma.
 *
 * La CLI de Prisma 6.x carga este archivo ANTES de resolver el subcomando, y
 * lo hace mirando el directorio actual, no dónde está instalada la CLI. Por
 * eso esta capa:
 *   - sobrevive a `npm ci`, a `rm -rf node_modules` y a `npm install
 *     --ignore-scripts`, donde el shim de node_modules/.bin/prisma todavía no
 *     está reinstalado;
 *   - atrapa también a una CLI ajena (`npx --yes prisma@6.19.3 db push`)
 *     mientras se ejecute parado en apps/api.
 *
 * Además reemplaza a `package.json#prisma`, que la CLI 6.19 marca como
 * deprecado y va a dejar de leer en Prisma 7.
 *
 * OJO: la sola presencia de este archivo hace que Prisma deje de cargar .env
 * por su cuenta ("Prisma config detected, skipping environment variable
 * loading"). El require de dotenv de abajo repone ese comportamiento; si se
 * saca, `db pull`, `generate` y `studio` dejan de encontrar DATABASE_URL.
 */

import { createRequire } from 'node:module';

const requerir = createRequire(import.meta.url);

// Prisma ya no carga .env solo cuando existe este archivo. Se hace por require
// y no por import estático porque durante `npm install` este config se evalúa
// (lo dispara el postinstall de @prisma/client) en un momento en el que las
// dependencias pueden no estar instaladas todavía: si falta dotenv preferimos
// seguir sin .env antes que romper la instalación.
try {
  requerir('dotenv/config');
} catch {
  // Sin dotenv: las variables tienen que venir del entorno.
}

// El guard sí es obligatorio: vive versionado al lado de este archivo. Si no
// está, la CLI tiene que fallar ruidosamente en lugar de quedar desprotegida.
const guard = requerir('./scripts/prisma-guard.cjs');
guard.abortarSiEstaBloqueado(process.argv.slice(2), 'prisma.config.ts');

export default {
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
};
