import { useToastStore } from '../store/toastStore';

/**
 * LA REGLA DE LOS AVISOS, EN UN SOLO LUGAR.
 *
 * Regla de producto, textual: **toda creación, edición y eliminación, en toda
 * pantalla, debe confirmar visualmente el resultado. Y si falla, mostrar el
 * motivo. Sin excepciones.**
 *
 * Antes cada store lo resolvía por su cuenta, así que funcionaba en algunas
 * pantallas y en otras no: guardar un vehículo, un transportista o un
 * dispositivo no avisaba nada, y la tolerancia del motor sí. Con esto se
 * arregla una vez y vale para todas.
 *
 * ⚠️ Y el aviso de error tiene que ser LEGIBLE. Desde la Tanda 3 el backend
 * devuelve JSON en todos los errores, y `vehiclesStore` hacía `res.text()` y lo
 * mostraba crudo: el operador veía
 * `{"statusCode":400,"message":["tenant_id should not exist"],...}` en una
 * ventana. `mensajeDeError` es la función que convierte eso en una frase.
 */

/** Lo que devuelve una operación de escritura. */
export interface Resultado<T = unknown> {
  ok: boolean;
  datos?: T;
  /** Mensaje ya legible, listo para mostrar. */
  error?: string;
}

const MENSAJES_POR_CODIGO: Record<number, string> = {
  400: 'Los datos enviados no son válidos.',
  401: 'Tu sesión expiró. Volvé a iniciar sesión.',
  403: 'No tenés permiso para hacer esto.',
  404: 'El registro no existe o fue eliminado.',
  409: 'La operación entra en conflicto con datos existentes.',
  413: 'El archivo es demasiado grande.',
  500: 'Hubo un error en el servidor. Volvé a intentar en unos minutos.',
};

/**
 * Convierte la respuesta de error del backend en una frase para el operador.
 *
 * Contempla las formas que el backend produce hoy:
 *   · `{ "message": "texto" }`            → excepciones de los servicios
 *   · `{ "message": ["a", "b"] }`         → ValidationPipe (una por campo)
 *   · `{ "message": { ... } }`            → el 409 de trips.remove con inventario
 *   · texto plano, HTML, o cuerpo vacío   → se cae al mensaje por código
 *
 * Es una función pura a propósito: se puede probar sin navegador ni backend.
 */
export function mensajeDeError(estado: number, cuerpo: unknown): string {
  const porCodigo = MENSAJES_POR_CODIGO[estado] ?? 'No se pudo completar la operación.';

  if (typeof cuerpo === 'string') {
    const texto = cuerpo.trim();
    // Un cuerpo HTML (una página de error de un proxy, por ejemplo) no se
    // muestra: sería otra forma de escupir algo ilegible en pantalla.
    if (!texto || texto.startsWith('<')) return porCodigo;
    // Un JSON que llegó como texto —`res.text()` en vez de `res.json()`— se
    // intenta interpretar antes de rendirse.
    if (texto.startsWith('{') || texto.startsWith('[')) {
      try {
        return mensajeDeError(estado, JSON.parse(texto));
      } catch {
        return porCodigo;
      }
    }
    return texto;
  }

  if (cuerpo && typeof cuerpo === 'object') {
    const mensaje = (cuerpo as Record<string, unknown>).message;

    if (typeof mensaje === 'string' && mensaje.trim()) return mensaje.trim();

    if (Array.isArray(mensaje) && mensaje.length > 0) {
      // El ValidationPipe manda un renglón por campo. Se muestran hasta tres:
      // más que eso deja de ser un mensaje y pasa a ser un volcado.
      const renglones = mensaje.filter((m) => typeof m === 'string');
      if (renglones.length === 0) return porCodigo;
      const visibles = renglones.slice(0, 3).join(' · ');
      return renglones.length > 3
        ? `${visibles} · y ${renglones.length - 3} problema(s) más`
        : visibles;
    }

    // El 409 de `trips.remove()` manda un objeto con el inventario de lo que
    // bloquea el borrado. Se conserva su texto, que costó una tanda entera.
    if (mensaje && typeof mensaje === 'object') {
      const anidado = (mensaje as Record<string, unknown>).message;
      if (typeof anidado === 'string' && anidado.trim()) return anidado.trim();
    }
  }

  return porCodigo;
}

/** Lee el cuerpo sin romperse si no es JSON. */
async function leerCuerpo(res: Response): Promise<unknown> {
  const texto = await res.text().catch(() => '');
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

export const avisar = {
  exito: (mensaje: string) => useToastStore.getState().addToast(mensaje, 'success'),
  error: (mensaje: string) => useToastStore.getState().addToast(mensaje, 'error'),
  info: (mensaje: string) => useToastStore.getState().addToast(mensaje, 'info'),
};

/**
 * Ejecuta una escritura y avisa el resultado. **Nunca lanza**: devuelve
 * `Resultado`, para que el llamador pueda decidir si cierra el modal.
 *
 * @param exito  Qué decir cuando sale bien. `null` para no avisar nada — útil
 *               cuando la pantalla ya muestra el cambio de forma evidente.
 */
export async function escribir<T = unknown>(
  peticion: () => Promise<Response>,
  exito: string | null,
): Promise<Resultado<T>> {
  let res: Response;
  try {
    res = await peticion();
  } catch (e) {
    // Falla de red: el backend ni siquiera contestó. Es distinto de un 500 y
    // el operador tiene que poder distinguirlo.
    const detalle = e instanceof Error ? e.message : String(e);
    const mensaje = 'No se pudo conectar con el servidor. Revisá tu conexión.';
    // eslint-disable-next-line no-console
    console.error('[escribir] fallo de red:', detalle);
    avisar.error(mensaje);
    return { ok: false, error: mensaje };
  }

  const cuerpo = await leerCuerpo(res);

  if (!res.ok) {
    const mensaje = mensajeDeError(res.status, cuerpo);
    avisar.error(mensaje);
    return { ok: false, error: mensaje };
  }

  if (exito) avisar.exito(exito);
  return { ok: true, datos: cuerpo as T };
}
