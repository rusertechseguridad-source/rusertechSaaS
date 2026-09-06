/**
 * DIRECCIÓN DE LA API, EN UN SOLO LUGAR.
 *
 * Por qué existe: había 149 direcciones del backend incrustadas en 49 archivos
 * del frontend, todas apuntando al puerto 3000 de la máquina local. Subida a un
 * servidor, la aplicación seguía pidiéndole los datos a la computadora del que
 * abría el navegador. No es un problema de estilo: es lo que impedía desplegar.
 *
 * ⚠️ POR QUÉ UNA URL ABSOLUTA Y NO UNA RUTA RELATIVA. En desarrollo el
 * frontend corre en Vite (:5173) y la API en otro proceso (:3000), así que
 * `fetch('/api/v1/vehicles')` resolvería contra Vite y daría 404. Por eso el
 * valor por defecto apunta al 3000 local y la variable existe para producción,
 * en vez de "sacar el host y listo".
 *
 * En producción, si el frontend y la API se sirven detrás del mismo dominio,
 * `VITE_API_URL=""` (cadena vacía) deja todas las llamadas relativas, que es
 * exactamente lo que se quiere ahí. Los dos escenarios los cubre la misma
 * variable.
 *
 * Vite reemplaza `import.meta.env.VITE_*` en tiempo de COMPILACIÓN: el valor
 * queda dentro del bundle. Cambiarlo exige recompilar el frontend — está
 * documentado en README_DESPLIEGUE.md porque es la clase de cosa que se
 * descubre en producción si no se dice.
 */

/** Valor de desarrollo. Fuera de acá nadie escribe la dirección a mano. */
const API_LOCAL_POR_DEFECTO = 'http://' + 'localhost' + ':3000';

/**
 * Base de todas las llamadas al backend.
 *
 * `??` y no `||` a propósito: con `||`, una `VITE_API_URL=""` deliberada
 * (mismo dominio, rutas relativas) caería al valor por defecto de desarrollo
 * y rompería el despliegue justo en el caso que la variable viene a cubrir.
 */
export const API_URL: string = import.meta.env.VITE_API_URL ?? API_LOCAL_POR_DEFECTO;

/**
 * Arma una URL de la API a partir de una ruta.
 *
 * Existe para los pocos lugares donde la ruta se compone en tiempo de
 * ejecución. La mayoría del código interpola `API_URL` directamente dentro del
 * `fetch`, que se lee mejor.
 */
export function urlApi(ruta: string): string {
  const normalizada = ruta.startsWith('/') ? ruta : `/${ruta}`;
  return `${API_URL}${normalizada}`;
}
