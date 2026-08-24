import { useEffect, useState } from 'react';

/**
 * RELOJ COMPARTIDO PARA TIEMPOS RELATIVOS.
 *
 * Criterio (definido por Gustavo): el tiempo relativo se recalcula en el
 * cliente a partir del timestamp, no queda congelado entre refrescos de
 * datos. "hace 41 s" que sigue diciendo 41 segundos dos minutos después es
 * una afirmación falsa en pantalla.
 *
 * El hook devuelve "ahora" y lo actualiza cada `intervaloMs`. Los componentes
 * que muestran antigüedad derivan el valor de (ahora - timestamp) en cada
 * tick, así el texto envejece solo aunque el dato no se haya vuelto a pedir.
 */
export function useAhora(intervaloMs = 10_000): number {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);

  return ahora;
}
