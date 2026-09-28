import { defineConfig, devices } from '@playwright/test';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * LAS PRUEBAS DE NAVEGADOR — lo único que puede ver dónde están las cosas
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ POR QUÉ HAY UN SEGUNDO CORREDOR, Y NO SE MEZCLA CON VITEST.
 *
 * jsdom no tiene motor de disposición. Medido en este repositorio, con un
 * `div` de 500×300 declarado a mano:
 *
 *   getBoundingClientRect() → { w: 0, h: 0, top: 0, left: 0 }
 *   offsetWidth / offsetHeight → 0 / 0
 *   document.elementFromPoint → undefined (ni existe)
 *
 * O sea: ninguna prueba de vitest puede comprobar que algo se vea, que entre
 * en la pantalla, ni que no esté tapado. `getByText` encuentra un elemento
 * dibujado a tres mil píxeles de distancia. Por eso las 13 pruebas de vitest
 * pasaban mientras el modal de atención era inusable en Chrome.
 *
 * Esto corre el navegador de verdad, contra el BUNDLE DE VERDAD, con el CSS
 * de verdad. Es la única capa que puede contestar «¿se ve?».
 *
 * ── Por qué NO está dentro de `npm run verificar` ─────────────────────────
 *
 * Necesita `npm run build` y levantar un servidor: tarda decenas de segundos
 * contra los pocos que tarda el resto. Un verificador que tarda se saltea, y
 * uno que se saltea no protege nada — la lección de la caché de lectura de
 * las reglas de cableado. Se corre con `npm run verificar:navegador`, antes
 * de entregar una tanda que toque pantalla.
 *
 * ── El backend no hace falta ──────────────────────────────────────────────
 *
 * Todas las llamadas a la API se interceptan y se responden con datos fijos.
 * Lo que se prueba acá es la PANTALLA, no a dónde va el clic. Eso está en
 * vitest (`campana.cableado.spec.tsx`): abrir pide el protocolo y el hilo, y
 * registrar, escalar y cerrar salen con su URL y su verbo. Que esa ruta
 * exista con ese verbo, en la regla R20. Lo que NINGUNA de las tres capas
 * prueba es un backend de verdad respondiendo: acá se intercepta todo.
 */
export default defineConfig({
  testDir: './pruebas-navegador',
  timeout: 30_000,
  // Un reintento: una prueba de navegador que falla dos veces seguidas es un
  // defecto; una que falla una es, casi siempre, una carrera del arranque.
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    /**
     * ⚠️ DE DÓNDE SALE EL NAVEGADOR, y por qué es una variable.
     *
     * En una máquina común se corre `npx playwright install chromium` una vez
     * y Playwright lo encuentra solo: no hace falta tocar nada.
     *
     * En un entorno donde el navegador ya viene instalado en otra ruta —o con
     * otra revisión que la que este Playwright espera— se exporta
     * `CHROMIUM_PATH` y se usa ese. Sin la variable, el comportamiento es el
     * de siempre. Es el mismo criterio que `VITE_API_URL`: una variable
     * cubre los dos escenarios en vez de «sacar el valor y listo».
     */
    launchOptions: process.env.CHROMIUM_PATH
      ? {
          executablePath: process.env.CHROMIUM_PATH,
          // ⚠️ `--no-sandbox` SÓLO en ese caso, y a propósito: Chromium se
          // niega a arrancar como root sin esta bandera, que es la situación
          // de un contenedor de integración. Ponerla siempre bajaría una
          // defensa real del navegador en la máquina de una persona, para
          // resolver un problema que ahí no existe. Va atada a la variable
          // que ya dice «esto no es una máquina común».
          args: ['--no-sandbox'],
        }
      : {},
    // Captura sólo al fallar: sirve para ver QUÉ se dibujó mal, que es
    // justamente lo que un mensaje de error no puede contar.
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'escritorio',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // ⚠️ El operador de guardia mira esto desde el teléfono más veces de las
      // que nadie admite. Una alerta crítica que no entra en 390 px no es una
      // alerta.
      //
      // ⚠️ ES UNA VENTANA CHICA, NO UN TELÉFONO EMULADO, y la diferencia hay
      // que decirla. `devices['iPhone 13']` activa `isMobile`, que exige un
      // Chromium completo con dbus — en un contenedor de integración no
      // arranca. Con el tamaño solo se comprueba lo que esta capa vino a
      // comprobar: que la alerta ENTRE. Lo que NO se comprueba así es el
      // toque, el teclado virtual y el área segura del teléfono; eso necesita
      // un dispositivo o un entorno con escritorio, y está en el reporte.
      name: 'ventana-chica',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    // ⚠️ `preview` y no `dev`: se prueba lo que se despliega. El bundle real,
    // con el CSS real y la minificación real.
    command: 'npm run build && npx vite preview --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
