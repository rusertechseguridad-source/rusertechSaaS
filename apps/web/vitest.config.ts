import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * LAS PRUEBAS DEL FRONTEND — el agujero que dejó pasar el botón desenchufado
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ MEDIDO ANTES DE ESCRIBIR ESTO: `apps/web` no tenía NI UNA prueba. Cero
 * archivos `.spec.` o `.test.`, ningún corredor en `package.json`. Lo único
 * que miraba el frontend era `tsc -b --force` —que comprueba tipos, no
 * comportamiento— y una afirmación de contenido del ZIP, que comprueba que
 * una cadena esté escrita en un archivo.
 *
 * Por eso `Campana.tsx :: CONTIENE :: await abrirBitacora(aviso)` pasó
 * mientras el botón no llamaba a nada: la cadena estaba y el camino no.
 *
 * Es exactamente la falla que las reglas de cableado del backend existen para
 * cazar —un servicio probado que nadie llama— aparecida del otro lado, donde
 * ninguna regla miraba. La lección de la 3A, repetida en el frontend.
 *
 * ⚠️ `environment: 'jsdom'` y no 'node': acá se ejecutan componentes y se
 * hace clic. Una prueba que importa el store y llama a la función a mano
 * NO prueba que el botón la llame — es el mismo error que se está corrigiendo.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/pruebas/preparar.ts'],
    /**
     * ⚠️ LA ZONA HORARIA SE FIJA, no se hereda de la máquina.
     *
     * El error que se está corrigiendo es un error de HORA. Una suite que
     * corre en UTC en el servidor de integración y en Buenos Aires en la
     * notebook de quien programa da resultados distintos, y la prueba que
     * tiene que cazar «20:19 mostrado como 08:19» se vuelve la más frágil
     * de todas. Se fija acá la zona en la que opera el cliente.
     */
    env: { TZ: 'America/Argentina/Buenos_Aires' },
    include: ['src/**/*.spec.{ts,tsx}'],
  },
});
