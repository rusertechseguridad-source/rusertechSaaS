import { resolve } from 'path';

/**
 * DÓNDE VIVEN LOS ARCHIVOS SUBIDOS — un solo lugar que lo decida.
 *
 * ⚠️ Por qué existe: había DOS definiciones distintas de la misma carpeta y no
 * coincidían, así que toda foto subida se guardaba bien y después daba 404:
 *
 *   · multer (app.controller.ts): `destination: './uploads'`
 *     → relativo al CWD del proceso → `apps/api/uploads`   ← acá se escriben
 *   · Nest (main.ts): `useStaticAssets(join(__dirname, '..', 'uploads'))`
 *     → relativo al archivo compilado → `apps/api/dist/uploads`  ← acá se buscan
 *
 * Medido: `dist/uploads` ni siquiera existe. Y el desvío depende de dónde caiga
 * `main.js`, que a su vez depende de si hay archivos `.ts` sueltos en la raíz
 * del paquete (los hay: `check_db.ts`, `clean_trips.ts`, `debug_token.ts`), que
 * corren el `rootDir` un nivel. O sea: **en desarrollo funcionaba y compilado
 * no**, que es la peor forma de tener un error.
 *
 * Es anterior a todas las tandas de corrección: `useStaticAssets` viene del
 * commit y ninguna tanda lo tocó (verificado con `git diff`).
 *
 * Se resuelve contra el CWD y no contra `__dirname` a propósito: es lo que
 * multer ya venía usando, así que los archivos que hoy existen en producción
 * siguen encontrándose sin moverlos ni migrar nada.
 */
export const DIRECTORIO_UPLOADS = resolve(process.cwd(), 'uploads');

/** Prefijo público desde el que se sirven. Debe coincidir con la URL que
 *  devuelve `POST /api/v1/upload`. */
export const PREFIJO_UPLOADS = '/uploads/';
