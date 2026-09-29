import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * ¿SE VE? — la pregunta que ninguna prueba de vitest puede contestar
 * ══════════════════════════════════════════════════════════════════════════
 *
 * El defecto que motivó este archivo: la campana vive adentro de un `<nav>`
 * con `backdrop-blur`, y cualquier `backdrop-filter` distinto de `none`
 * convierte al elemento en BLOQUE CONTENEDOR de sus descendientes
 * `position: fixed`. Medido en Chromium, con la misma estructura:
 *
 *   fixed inset-0 dentro de un ancestro con backdrop-filter → 1200 × 64
 *   el mismo, sin backdrop-filter                           → 1200 × 800
 *
 * Sesenta y cuatro píxeles. El modal de atención se dibujaba ahí: apretado
 * contra el encabezado, encima del menú, con el cuerpo desplazado fuera de
 * la vista. Los datos llegaban completos y la ventana no se podía usar.
 *
 * Las 13 pruebas de vitest pasaban, y pasaban con razón: prueban que el clic
 * llegue al backend correcto y que el modal cuelgue de `document.body`. Lo
 * que sigue es lo otro — que además QUEPA y SE VEA.
 */

const ALERTA = 'cccc0001-0000-4000-8000-000000000001';

const CRITICA = {
  fuente: 'condicion',
  id: ALERTA,
  tenant_id: '11111111-1111-1111-1111-111111111111',
  vehicle_id: 'aaaa0001-0000-4000-8000-000000000001',
  trip_id: null,
  tipo: 'SIN_REPORTE',
  titulo: 'Sin reporte',
  nivel_riesgo: 'CRITICO',
  color: '#c0202e',
  interrumpe: true,
  requiere_atencion: true,
  clasificado: true,
  ocurrio_at: '2026-09-22T23:19:51.000Z',
  patente: 'DEMO-001',
  // ⚠️ CON POSICIÓN, Y CON UN NOMBRE DE LUGAR LARGO A PROPÓSITO. El bloque
  // del «dónde» va en el encabezado fijo de la bitácora: cuanto más alto, menos
  // lugar le queda al cuerpo. Las pruebas de abajo —el hilo largo incluido—
  // corren en el peor caso, no en el cómodo.
  latitud: -34.60372,
  longitud: -58.38159,
  ubicacion_at: '2026-09-22T17:05:00.000Z',
  lugar: 'Depósito Norte — Playa de camiones del Mercado Central, acceso por Autopista Riccheri km 12',
  direccion: null,
  disparador: '35 minutos sin reportar (prueba de bitacora)',
};

/** El caso normal hoy en producción: medido, ninguna fila con posición. */
const SIN_POSICION = { ...CRITICA, latitud: null, longitud: null, ubicacion_at: null, lugar: null };

const PROTOCOLO = {
  existe: true,
  cerrada: false,
  tipo_condicion: 'SIN_REPORTE',
  pasos: [
    { id: 'p1', orden: 1, accion: 'Llamar al conductor' },
    { id: 'p2', orden: 2, accion: 'Revisar zona sin cobertura' },
  ],
  resultados: [
    { codigo: 'ZONA_SIN_SENAL', nombre: 'Zona sin señal', orden: 1, habilita_escalada: false },
    { codigo: 'FALLA_GPS', nombre: 'Falla del GPS', orden: 2, habilita_escalada: false },
    { codigo: 'NO_RESPONDE', nombre: 'No responde', orden: 3, habilita_escalada: true },
    { codigo: 'VOLVIO', nombre: 'Volvió a reportar', orden: 4, habilita_escalada: false },
  ],
  propio_del_cliente: false,
  motivo_sin_permiso_critica: null,
  puede_cerrar: false,
  destino_de_escalada: {
    usuario_id: 'uuuu0002-0000-4000-8000-000000000002',
    nombre: 'Owner Demo',
    email: 'owner@rusertech.com',
    role_code: 'account_owner',
    nivel_jerarquico: 90,
  },
};

/**
 * ⚠️ UN HILO LARGO A PROPÓSITO.
 *
 * El hilo CRECE con cada entrada, y el defecto que importa no aparece con
 * cero: aparece cuando el formulario más ocho entradas no entran en una
 * pantalla y los botones se van abajo. Probar con el hilo vacío es probar el
 * caso en el que nunca falla.
 */
const HILO = Array.from({ length: 8 }, (_, i) => ({
  id: `e${i}`,
  accion: i === 7 ? 'escalada' : 'registro',
  usuario_nombre: 'Operador Demo',
  paso_accion: 'Llamar al conductor',
  resultado_codigo: 'NO_RESPONDE',
  resultado_nombre: 'No responde',
  nota: `Intento ${i + 1}: llamé al conductor y no atendió. Dejé mensaje.`,
  escalado_a_nombre: i === 7 ? 'Owner Demo' : null,
  created_at: new Date(Date.now() - (8 - i) * 300000).toISOString(),
}));

/** La sesión y la API, de mentira. El backend no hace falta acá. */
async function prepararSesion(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('rusertech_token', 'token-de-prueba');
  });

  await page.route('**/auth/me', (r) =>
    r.fulfill({
      json: {
        id: 'uuuu0001-0000-4000-8000-000000000001',
        email: 'operator@rusertech.com',
        role: 'operator',
        role_code: 'operator',
        tenant_id: '11111111-1111-1111-1111-111111111111',
        permissions: ['view_alerts', 'manage_alerts', 'manage_critical_alerts', 'view_map'],
      },
    }),
  );
  // ⚠️ EL COMODÍN VA PRIMERO, Y ES AL REVÉS DE LO QUE PARECE.
  //
  // Playwright prueba los manejadores en orden INVERSO al de registro: el
  // último que se registra gana. Con el comodín al final —que es donde uno lo
  // pone por costumbre— se comía todas las respuestas y la campana quedaba
  // vacía: la prueba fallaba por la prueba, no por la pantalla. Lo medió el
  // primer intento y se deja escrito para que nadie lo reordene «prolijo».
  await page.route('**/api/v1/**', (r) => r.fulfill({ json: [] }));

  await page.route('**/api/v1/campana/pendientes', (r) => r.fulfill({ json: [CRITICA] }));
  // El flujo en vivo: se deja abierto y sin datos. Cerrarlo hace que el store
  // programe una reconexión, y eso ensucia la medición con reintentos.
  await page.route('**/api/v1/campana/flujo', (r) =>
    r.fulfill({ status: 200, contentType: 'text/event-stream', body: ': abierto\n\n' }),
  );
  await page.route('**/api/v1/bitacora/*/protocolo*', (r) => r.fulfill({ json: PROTOCOLO }));
  await page.route('**/api/v1/bitacora/*/hilo*', (r) => r.fulfill({ json: HILO }));
}

/**
 * Cuánto de un elemento cae DENTRO de la ventana, en porcentaje de su área.
 *
 * ⚠️ Recibe un `Locator` y no un selector de texto: `button:has-text(…)` es
 * sintaxis de Playwright, no CSS, y `querySelector` la rechaza. Lo cobró la
 * primera corrida — la prueba fallaba por el localizador y no por la pantalla,
 * que es la peor forma de fallar porque parece un hallazgo.
 */
async function porcentajeVisible(loc: Locator): Promise<number> {
  return loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return 0;
    const ancho = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    const alto = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    return (ancho * alto) / (r.width * r.height);
  });
}

/**
 * ¿QUIÉN ESTÁ REALMENTE EN ESE PUNTO DE LA PANTALLA?
 *
 * ⚠️ Es la pregunta que ningún entorno sin disposición puede contestar:
 * `document.elementFromPoint` NI SIQUIERA EXISTE en jsdom — lo medí, devuelve
 * `undefined`. Acá sí, y es lo único que distingue «el botón está en el DOM»
 * de «el botón se puede tocar».
 */
async function loQueEstaEn(page: Page, x: number, y: number): Promise<string> {
  return page.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px, py);
    if (!el) return '(nada)';
    return `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`;
  }, [x, y]);
}

test.beforeEach(async ({ page }) => {
  await prepararSesion(page);
  await page.goto('/map');
});

test('🔴 el aviso crítico cubre LA VENTANA, no la barra de 64 px', async ({ page }) => {
  const aviso = page.getByRole('alertdialog');
  await expect(aviso).toBeVisible();

  const caja = (await aviso.boundingBox())!;
  const ventana = page.viewportSize()!;

  // ⚠️ El número que delata el defecto es la ALTURA. Con el aviso dibujado
  // adentro de la barra, esto daba 64 — y el mapa quedaba nítido detrás de
  // una alerta crítica.
  expect(caja.height).toBeGreaterThan(ventana.height * 0.9);
  expect(caja.width).toBeGreaterThan(ventana.width * 0.9);
});

test('🔴 el modal de atención entra en la pantalla y se puede usar', async ({ page }) => {
  await page.getByRole('button', { name: /Atender esta alerta/i }).click();

  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  // El protocolo llegó y se dibujó. ⚠️ Se apunta al RADIO del formulario y
  // no al texto suelto: «Llamar al conductor» también aparece en cada
  // entrada del hilo, y un localizador ambiguo falla por ambiguo — no por
  // el defecto que se quiere cazar.
  await expect(page.getByRole('radio', { name: /Llamar al conductor/i })).toBeVisible();

  // ⚠️ LO QUE NINGUNA PRUEBA DE jsdom PODÍA VER.
  //
  // Y ojo con la métrica: «qué porcentaje del modal cae dentro de la
  // ventana» daba 100% AUNQUE estuviera mal, porque una superposición de
  // 1440×64 entra entera en la pantalla — chiquita, arriba, y entera. Una
  // medición que da verde con el defecto puesto es peor que ninguna.
  //
  // Lo que delata el defecto es la ALTURA de la superposición: con el modal
  // dibujado adentro de la barra daba 64, medido en la reversión.
  const ventana = page.viewportSize()!;
  const capa = (await modal.boundingBox())!;
  expect(capa.height).toBeGreaterThan(ventana.height * 0.9);

  // Y la tarjeta de adentro, entera en pantalla.
  const tarjeta = modal.locator('> div').first();
  expect(await porcentajeVisible(tarjeta)).toBeGreaterThan(0.95);
});

test('🔴 con el hilo largo, los botones SIGUEN alcanzables', async ({ page }) => {
  // El caso que rompe: ocho entradas más el formulario no entran en una
  // pantalla. Sin desplazamiento propio, «Registrar y atender» se va abajo
  // justo cuando más trabajo se registró.
  await page.getByRole('button', { name: /Atender esta alerta/i }).click();
  await expect(page.getByText(/Intento 8/).first()).toBeVisible();

  const boton = page.getByRole('button', { name: /Registrar y atender/i });
  // `toBeVisible` de Playwright mira el DOM y el CSS, no la posición: se
  // comprueba aparte que se pueda tocar de verdad.
  await expect(boton).toBeVisible();
  await boton.scrollIntoViewIfNeeded();
  expect(await porcentajeVisible(boton)).toBeGreaterThan(0.9);

  // ⚠️ Y que se pueda TOCAR: en el punto medio del botón tiene que estar el
  // botón, no otra cosa encima. Estar en el DOM y estar alcanzable son dos
  // hechos distintos, y el segundo es el que le importa al operador.
  const caja = (await boton.boundingBox())!;
  expect(await loQueEstaEn(page, caja.x + caja.width / 2, caja.y + caja.height / 2))
    .toContain('button');
});

test('🔴 el modal NO tapa lo que hace falta para resolver el bloqueo', async ({ page }) => {
  // ⚠️ EL BLOQUEO CIRCULAR, comprobado donde se ve: minimizada la alerta, el
  // menú de Configuración tiene que ser ALCANZABLE — es por donde se otorga
  // el permiso que la propia alerta exige.
  // Con el aviso abierto, el punto medio de la barra superior lo ocupa la
  // superposición: el menú está tapado y no hay forma de llegar.
  const barra = (await page.locator('nav').first().boundingBox())!;
  const medio: [number, number] = [barra.x + barra.width / 2, barra.y + barra.height / 2];
  const tapado = await loQueEstaEn(page, ...medio);

  await page.getByRole('button', { name: /Minimizar/i }).click();

  // ⚠️ Y ahora NO. Es el bloqueo circular comprobado donde se ve: el
  // administrador tiene que poder llegar al menú para otorgar el permiso que
  // la propia alerta le exige.
  //
  // ⚠️ Se compara contra el ANTES y no contra un texto del menú: la interfaz
  // está traducida y «Configuración» puede decir «Settings». Una prueba que
  // depende del idioma se rompe el día que alguien cambia de idioma, y eso no
  // es el defecto.
  const libre = await loQueEstaEn(page, ...medio);
  expect(libre).not.toBe(tapado);

  // La alerta sigue ahí, sin haberse podido descartar.
  await expect(page.getByRole('status')).toContainText('DEMO-001');
});

test('🔴 la franja minimizada queda ABAJO, no encima del menú', async ({ page }) => {
  await page.getByRole('button', { name: /Minimizar/i }).click();

  const franja = (await page.getByRole('status').boundingBox())!;
  const ventana = page.viewportSize()!;

  // Declarada `bottom-0`, se dibujaba arriba: el borde inferior de la barra
  // superior. Era la que más engañaba porque parecía funcionar.
  expect(franja.y).toBeGreaterThan(ventana.height / 2);
});

// ══════════════════════════════════════════════════════════════════════════
// LA LISTA DE LA CAMPANA — que entre en el teléfono
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ Colgaba de la campana con `absolute right-0`, y la campana cae donde la
// empuje el menú: con más ítems, más a la izquierda. Medido en 390 px: el
// panel arrancaba en x = -56 con un operador y en x = -108 con un dueño de
// cuenta, y «Atender» quedaba fuera de la pantalla. Se prueba con los DOS
// perfiles porque la posición dependía de cuántos ítems tenía el menú.

const DUENO = {
  id: 'uuuu0003-0000-4000-8000-000000000003',
  email: 'owner@rusertech.com',
  role: 'account_owner',
  role_code: 'account_owner',
  tenant_id: '11111111-1111-1111-1111-111111111111',
  permissions: [
    'view_map', 'view_alerts', 'manage_alerts', 'manage_critical_alerts', 'view_trips',
    'view_vehicles', 'view_drivers', 'view_carriers', 'view_devices', 'view_sensors',
    'view_locations', 'view_analytics', 'view_avl', 'view_settings', 'manage_settings',
    'view_simulator',
  ],
};

for (const perfil of ['operador', 'dueño de cuenta'] as const) {
  test(`🔴 la lista de la campana ENTRA en la pantalla y «Atender» se toca (${perfil})`, async ({ page }) => {
    if (perfil === 'dueño de cuenta') {
      await page.route('**/auth/me', (r) => r.fulfill({ json: DUENO }));
      await page.reload();
    }
    await page.getByRole('button', { name: /Minimizar/i }).click();
    await page.getByRole('button', { name: /Alertas: 1 sin atender/i }).click();

    const lista = page.getByRole('region', { name: 'Alertas sin atender' });
    await expect(lista).toBeVisible();
    const caja = (await lista.boundingBox())!;
    const ventana = page.viewportSize()!;
    // Los dos bordes, no sólo el porcentaje: un panel corrido medio metro a
    // la izquierda puede tener «casi todo» adentro y el botón afuera.
    expect(caja.x).toBeGreaterThanOrEqual(0);
    expect(caja.x + caja.width).toBeLessThanOrEqual(ventana.width);

    const atender = lista.getByRole('button', { name: 'Atender' });
    expect(await porcentajeVisible(atender)).toBeGreaterThan(0.99);
    const b = (await atender.boundingBox())!;
    expect(await loQueEstaEn(page, b.x + b.width / 2, b.y + b.height / 2)).toContain('button');
  });
}

// ══════════════════════════════════════════════════════════════════════════
// EL «DÓNDE» — que se LEA, en los tres lugares, sin tapar nada
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ Lo que vitest no puede contestar: si el bloque entra en la pantalla y si
// empuja los botones fuera de la vista. El hilo ya creció una vez y tapó
// «Registrar y atender»; un encabezado más alto es la otra forma de hacerlo.

const DONDE = { name: 'Dónde estaba' } as const;

test('📍 el dónde se lee en el aviso crítico, entero en pantalla', async ({ page }) => {
  const bloque = page.getByRole('alertdialog').getByRole('group', DONDE);
  await expect(bloque).toBeVisible();
  await expect(bloque).toContainText('Depósito Norte');
  // Dónde ESTABA y CUÁNDO: la hora de la posición viaja con ella.
  await expect(bloque).toContainText('Posición del');
  expect(await porcentajeVisible(bloque)).toBeGreaterThan(0.99);

  // Y el nombre largo no empuja la acción: «Atender» sigue entero y tocable.
  const atender = page.getByRole('button', { name: /Atender esta alerta/i });
  await atender.scrollIntoViewIfNeeded();
  expect(await porcentajeVisible(atender)).toBeGreaterThan(0.9);
  const caja = (await atender.boundingBox())!;
  expect(await loQueEstaEn(page, caja.x + caja.width / 2, caja.y + caja.height / 2)).toContain('button');
});

test('📍 en la bitácora el dónde queda a la vista, y «Registrar» sigue alcanzable', async ({ page }) => {
  await page.getByRole('button', { name: /Atender esta alerta/i }).click();
  const modal = page.getByRole('dialog');
  await expect(page.getByText(/Intento 8/).first()).toBeVisible();

  // En el encabezado fijo: se ve sin desplazar nada.
  const bloque = modal.getByRole('group', DONDE);
  await expect(bloque).toContainText('Depósito Norte');
  expect(await porcentajeVisible(bloque)).toBeGreaterThan(0.99);

  // ⚠️ El caso que importa: encabezado alto + hilo de ocho entradas. El
  // botón tiene que poder alcanzarse y TOCARSE, no sólo estar en el DOM.
  const boton = page.getByRole('button', { name: /Registrar y atender/i });
  await boton.scrollIntoViewIfNeeded();
  expect(await porcentajeVisible(boton)).toBeGreaterThan(0.9);
  const caja = (await boton.boundingBox())!;
  expect(await loQueEstaEn(page, caja.x + caja.width / 2, caja.y + caja.height / 2)).toContain('button');

  // Y desplazar el cuerpo NO se lleva el dónde: sigue en pantalla.
  expect(await porcentajeVisible(bloque)).toBeGreaterThan(0.99);
});

test('📍 en la lista de la campana, el dónde se lee', async ({ page }) => {
  await page.getByRole('button', { name: /Minimizar/i }).click();
  await page.getByRole('button', { name: /Alertas: 1 sin atender/i }).click();

  const lista = page.getByRole('region', { name: 'Alertas sin atender' });
  const bloque = lista.getByRole('group', DONDE);
  await expect(bloque).toContainText('Depósito Norte');
  await bloque.scrollIntoViewIfNeeded();

  // El bloque ENTERO, ícono incluido. Hasta que el panel se posicionó contra
  // la ventana, en 390 px arrancaba en x = -56 y esta prueba sólo podía
  // prometer el texto, línea por línea. Ya no hace falta la concesión.
  expect(await porcentajeVisible(bloque)).toBeGreaterThan(0.99);
  // El enlace al mapa también es algo que el operador tiene que poder tocar.
  const enlace = bloque.getByRole('link', { name: /Abrir en Google Maps/i });
  const caja = (await enlace.boundingBox())!;
  expect(await loQueEstaEn(page, caja.x + caja.width / 2, caja.y + caja.height / 2)).toMatch(/^(a|svg|path)/);
});

test('📍 sin posición, el aviso LO DICE — y se lee', async ({ page }) => {
  // El caso normal hoy en producción. Un hueco sería indistinguible de una
  // pantalla rota; el texto tiene que estar y tiene que verse.
  await page.route('**/api/v1/campana/pendientes', (r) => r.fulfill({ json: [SIN_POSICION] }));
  await page.reload();

  const bloque = page.getByRole('alertdialog').getByRole('group', DONDE);
  await expect(bloque).toContainText('Sin posición');
  expect(await porcentajeVisible(bloque)).toBeGreaterThan(0.99);
  await expect(bloque.getByRole('link')).toHaveCount(0);
});
