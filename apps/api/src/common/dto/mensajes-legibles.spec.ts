/**
 * EL AVISO DE ERROR TIENE QUE SER LEGIBLE.
 *
 * Esta suite vive en `apps/api` a propósito: prueba que **lo que el backend
 * devuelve** se puede convertir en una frase para el operador. La función que
 * lo hace es `apps/web/src/services/avisos.ts::mensajeDeError`, y su lógica se
 * replica acá contra las formas REALES que produce este backend.
 *
 * ⚠️ Por qué importa: desde la Tanda 3 el `ValidationPipe` devuelve JSON en
 * todos los errores, y `vehiclesStore` hacía `res.text()` y lo mostraba crudo.
 * El operador veía
 * `{"statusCode":400,"message":["tenant_id should not exist"],...}`
 * en una ventana del navegador.
 */

// Copia literal de la función del frontend. Si divergen, esta suite deja de
// probar lo que corre — por eso hay una afirmación de contenido en el ZIP que
// compara las dos.
const MENSAJES_POR_CODIGO: Record<number, string> = {
  400: 'Los datos enviados no son válidos.',
  401: 'Tu sesión expiró. Volvé a iniciar sesión.',
  403: 'No tenés permiso para hacer esto.',
  404: 'El registro no existe o fue eliminado.',
  409: 'La operación entra en conflicto con datos existentes.',
  413: 'El archivo es demasiado grande.',
  500: 'Hubo un error en el servidor. Volvé a intentar en unos minutos.',
};

function mensajeDeError(estado: number, cuerpo: unknown): string {
  const porCodigo = MENSAJES_POR_CODIGO[estado] ?? 'No se pudo completar la operación.';
  if (typeof cuerpo === 'string') {
    const texto = cuerpo.trim();
    if (!texto || texto.startsWith('<')) return porCodigo;
    if (texto.startsWith('{') || texto.startsWith('[')) {
      try { return mensajeDeError(estado, JSON.parse(texto)); } catch { return porCodigo; }
    }
    return texto;
  }
  if (cuerpo && typeof cuerpo === 'object') {
    const mensaje = (cuerpo as Record<string, unknown>).message;
    if (typeof mensaje === 'string' && mensaje.trim()) return mensaje.trim();
    if (Array.isArray(mensaje) && mensaje.length > 0) {
      const renglones = mensaje.filter((m) => typeof m === 'string');
      if (renglones.length === 0) return porCodigo;
      const visibles = renglones.slice(0, 3).join(' · ');
      return renglones.length > 3
        ? `${visibles} · y ${renglones.length - 3} problema(s) más`
        : visibles;
    }
    if (mensaje && typeof mensaje === 'object') {
      const anidado = (mensaje as Record<string, unknown>).message;
      if (typeof anidado === 'string' && anidado.trim()) return anidado.trim();
    }
  }
  return porCodigo;
}

describe('mensajeDeError · lo que el operador ve cuando algo falla', () => {
  it('🔴 el JSON del ValidationPipe se convierte en una frase, no se muestra crudo', () => {
    // Ésta es la respuesta EXACTA que devuelve el pipe de la Tanda 3.
    const respuesta = {
      statusCode: 400,
      message: ['property tenant_id should not exist'],
      path: '/api/v1/vehicles/x',
      timestamp: '2026-08-29T12:00:00.000Z',
    };
    const texto = mensajeDeError(400, respuesta);
    expect(texto).toBe('property tenant_id should not exist');
    expect(texto).not.toContain('statusCode');
    expect(texto).not.toContain('{');
  });

  it('varios campos inválidos se muestran juntos, hasta tres', () => {
    const texto = mensajeDeError(400, { message: ['campo a', 'campo b', 'campo c'] });
    expect(texto).toBe('campo a · campo b · campo c');
  });

  it('más de tres no se convierten en un volcado', () => {
    const texto = mensajeDeError(400, { message: ['a', 'b', 'c', 'd', 'e'] });
    expect(texto).toBe('a · b · c · y 2 problema(s) más');
  });

  it('el 409 con inventario de dependencias conserva su texto', () => {
    // `trips.remove()` devuelve un objeto anidado. Ese mensaje costó una tanda
    // entera y no se puede perder.
    const texto = mensajeDeError(409, {
      message: { message: 'El viaje tiene 3 eventos asociados.', bloqueos: 3 },
    });
    expect(texto).toBe('El viaje tiene 3 eventos asociados.');
  });

  it.each([
    [401, 'Tu sesión expiró. Volvé a iniciar sesión.'],
    [403, 'No tenés permiso para hacer esto.'],
    [404, 'El registro no existe o fue eliminado.'],
    [500, 'Hubo un error en el servidor. Volvé a intentar en unos minutos.'],
  ])('un %i sin cuerpo tiene su propia frase', (estado, esperado) => {
    expect(mensajeDeError(estado, null)).toBe(esperado);
  });

  it('una página HTML de un proxy NO se escupe en pantalla', () => {
    const texto = mensajeDeError(502, '<html><body>502 Bad Gateway</body></html>');
    expect(texto).not.toContain('<');
    expect(texto).toBe('No se pudo completar la operación.');
  });

  it('un JSON que llegó como texto —`res.text()`— igual se interpreta', () => {
    // Es exactamente lo que hacía `vehiclesStore`.
    const crudo = JSON.stringify({ statusCode: 403, message: 'No tenés permiso.' });
    expect(mensajeDeError(403, crudo)).toBe('No tenés permiso.');
  });

  it('un cuerpo vacío cae al mensaje por código, nunca a un string vacío', () => {
    expect(mensajeDeError(400, '')).toBe('Los datos enviados no son válidos.');
    expect(mensajeDeError(400, {})).toBe('Los datos enviados no son válidos.');
  });
});
