/**
 * CODIFICADOR DE POLILÍNEAS (algoritmo de Google, el que aceptan los mapas
 * estáticos de MapTiler como `enc:`).
 *
 * Implementado acá y no como dependencia: son ~25 líneas estables desde hace
 * quince años, y el informe no puede sumar paquetes por algo así.
 *
 * Verificado contra el vector de prueba oficial del algoritmo:
 *   [(38.5,-120.2), (40.7,-120.95), (43.252,-126.453)]
 *   → "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
 */
export function codificarPolyline(coordenadas: [number, number][]): string {
  let salida = '';
  let latPrev = 0;
  let lngPrev = 0;

  const codificarValor = (valor: number): string => {
    let v = valor < 0 ? ~(valor << 1) : valor << 1;
    let chunk = '';
    while (v >= 0x20) {
      chunk += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    chunk += String.fromCharCode(v + 63);
    return chunk;
  };

  for (const [lat, lng] of coordenadas) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lng * 1e5);
    salida += codificarValor(latE5 - latPrev) + codificarValor(lngE5 - lngPrev);
    latPrev = latE5;
    lngPrev = lngE5;
  }
  return salida;
}

/**
 * Reduce la cantidad de vértices para que la URL del mapa estático no explote.
 * Muestreo uniforme conservando SIEMPRE el primero y el último: para el fondo
 * cartográfico alcanza; la geometría exacta vive en trip_summary.recorrido.
 */
export function simplificarParaUrl(
  coordenadas: [number, number][],
  maximo = 300,
): [number, number][] {
  if (coordenadas.length <= maximo) return coordenadas;
  const paso = (coordenadas.length - 1) / (maximo - 1);
  const salida: [number, number][] = [];
  for (let i = 0; i < maximo; i++) {
    salida.push(coordenadas[Math.round(i * paso)]);
  }
  return salida;
}
