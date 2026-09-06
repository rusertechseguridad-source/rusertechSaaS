/// <reference types="vite/client" />

/**
 * Variables de entorno del frontend, tipadas.
 *
 * Sin esto, `import.meta.env.VITE_API_URL` es `any` y un error de tipeo en el
 * nombre de la variable pasa la compilación y falla recién en producción, con
 * `undefined` como dirección de la API.
 *
 * ⚠️ Sólo las que empiezan con `VITE_` llegan al navegador. Es una decisión de
 * Vite y conviene tenerla presente: cualquier valor que se ponga acá queda
 * dentro del bundle y es público. Nunca una clave secreta.
 */
interface ImportMetaEnv {
  /**
   * Dirección base del backend, sin barra final.
   *   · desarrollo → se omite y vale el puerto 3000 local
   *   · producción con dominio propio para la API → `https://api.midominio.com`
   *   · producción detrás del mismo dominio → `""` (cadena vacía: rutas relativas)
   */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
