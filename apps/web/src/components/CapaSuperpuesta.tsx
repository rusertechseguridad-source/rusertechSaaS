import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * LA CAPA SUPERPUESTA — todo lo que tiene que taparlo TODO pasa por acá
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ POR QUÉ EXISTE. MEDIDO EN CHROMIUM, NO RECORDADO.
 *
 * La campana vive adentro del `<nav>`, y ese nav tiene `backdrop-blur-md`.
 * Cualquier valor de `backdrop-filter` distinto de `none` convierte al
 * elemento en BLOQUE CONTENEDOR de sus descendientes `position: fixed`. O
 * sea: `fixed inset-0` adentro de esa barra no mide la ventana — mide la
 * barra.
 *
 * Lo medí con un navegador de verdad, con la misma estructura:
 *
 *   dentro de un ancestro con backdrop-filter → 1200 × 64
 *   sin backdrop-filter                       → 1200 × 800  (la ventana)
 *
 * Sesenta y cuatro píxeles de alto. Eso explica las tres cosas que se veían:
 *
 *   · el modal de atención dibujado apretado contra el encabezado, con el
 *     cuerpo desplazado fuera de una caja de 64 px — y por eso «no aparece
 *     nada» aunque la petición hubiera salido y los datos hubieran llegado;
 *   · el fondo oscurecido tapando SÓLO la barra, con el mapa intacto detrás;
 *   · la franja «minimizada», declarada `bottom-0`, apareciendo ARRIBA:
 *     el borde inferior de la barra, no el de la pantalla.
 *
 * ⚠️ NO SE LE SACA EL `backdrop-blur` AL NAV. Está puesto a propósito —es el
 * vidrio esmerilado de la barra— y sacarlo para arreglar esto cambiaría el
 * aspecto de toda la aplicación para resolver un problema de otra capa. Lo
 * que se mueve es la superposición: se dibuja como hija de `document.body`,
 * donde `fixed` vuelve a significar lo que dice.
 *
 * ⚠️ Y ES UN COMPONENTE Y NO UN `createPortal` suelto en cada modal. Son
 * tres hoy y van a ser más; con la llamada repetida, el cuarto se escribe sin
 * portal y el error vuelve sin que nadie lo note hasta abrirlo en el
 * navegador — que es exactamente cómo se descubrió éste.
 */
export function CapaSuperpuesta({ children }: { children: ReactNode }) {
  // ⚠️ `useState` + `useEffect` y no `document.body` directo: durante el
  // primer render del servidor —o de cualquier entorno sin DOM— `document`
  // no existe. Montar en el efecto es lo que lo hace seguro.
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    setMontado(true);
  }, []);

  if (!montado || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
