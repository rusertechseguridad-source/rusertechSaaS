import { test, expect, type Page } from '@playwright/test';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * UN ERROR SE VE COMO ERROR — la pregunta que el color contesta
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Cuatro lugares mostraban un fallo con el aviso VERDE de éxito: el ícono de
 * tilde, el mismo que dice «listo». En custodia eso es peor que un error: es
 * un error que se ve como un acierto. El operador cree que suspendió a un
 * conductor, o que cambió la configuración, y no pasó nada.
 *
 * Lo que distingue a un aviso de otro es el ÍCONO y su color —tilde verde,
 * círculo de alerta rojo—, y eso es lo que se afirma: lo que el operador ve.
 *
 * ⚠️ `AlertsPage.tsx:135` («Debes ingresar una justificación…») también se
 * corrigió, pero NO tiene prueba acá, y a propósito: el botón de confirmar
 * está deshabilitado mientras la nota está vacía, así que desde la pantalla
 * ese aviso no se puede alcanzar. Una prueba que forzara el camino probaría
 * algo que el operador no puede hacer.
 */

/** Un token con forma de JWT: `AlertsPage` lee el rol del token, no de /auth/me. */
function tokenCon(rol: string): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64({ sub: 'u1', role: rol })}.firma`;
}

async function prepararSesion(page: Page, rol: string, permisos: string[]) {
  const token = tokenCon(rol);
  await page.addInitScript((t) => localStorage.setItem('rusertech_token', t), token);
  await page.route('**/api/v1/**', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/v1/campana/flujo', (r) =>
    r.fulfill({ status: 200, contentType: 'text/event-stream', body: ': abierto\n\n' }),
  );
  await page.route('**/auth/me', (r) =>
    r.fulfill({
      json: {
        id: 'u1', email: 'x@rusertech.com', role: rol, role_code: rol,
        tenant_id: '11111111-1111-1111-1111-111111111111', permissions: permisos,
      },
    }),
  );
  // `confirm()` de «¿suspender?»: se acepta, que es lo que haría el operador.
  page.on('dialog', (d) => void d.accept());
}

/** El aviso que dice `texto`, y de qué tipo es por su ícono. */
async function tipoDelAviso(page: Page, texto: string | RegExp): Promise<'error' | 'exito' | 'otro'> {
  const aviso = page.locator('div.pointer-events-auto', { hasText: texto });
  await expect(aviso).toBeVisible();
  if (await aviso.locator('svg.text-statusDanger').count()) return 'error';
  if (await aviso.locator('svg.text-accentGreen').count()) return 'exito';
  return 'otro';
}

test('🔴 un 403 al guardar la configuración de alertas se ve como ERROR', async ({ page }) => {
  // Era `AlertsPage.tsx:171`: el rechazo por permiso, con el tilde verde.
  await prepararSesion(page, 'rusertech_admin', ['view_alerts', 'manage_alerts']);
  await page.route('**/api/v1/alerts/settings', (r) =>
    r.request().method() === 'PUT'
      ? r.fulfill({ status: 403, json: { statusCode: 403, message: 'Necesitás el permiso «Administrar Configuración de Empresa».' } })
      : r.fulfill({ json: {} }),
  );
  await page.goto('/alerts');

  await page.locator('main').getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Guardar Cambios/ }).click();

  expect(await tipoDelAviso(page, /Administrar Configuración de Empresa/)).toBe('error');
});

test('🔴 si copiar la clave FALLA, no dice «copiado»', async ({ page }) => {
  // Era `AdminGlobalUsers.tsx:160`: avisaba «copiado» sin esperar al
  // portapapeles, que falla sin HTTPS o sin permiso del navegador. El
  // administrador pegaba otra cosa creyendo que tenía la clave temporal.
  await prepararSesion(page, 'rusertech_admin', ['admin_global']);
  // El portapapeles de este navegador, rechazando: es el caso a probar.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('permiso denegado')) },
      configurable: true,
    });
  });
  const USUARIO = {
    id: 'u9', email: 'op@demo', full_name: 'Operador Demo', role_code: 'operator',
    role: { name: 'operator' }, status: 'active', tenant: { name: 'Demo', slug: 'demo' },
    granted_permissions: [], revoked_permissions: [],
  };
  await page.route('**/api/v1/admin/users', (r) => r.fulfill({ json: [USUARIO] }));
  await page.route('**/api/v1/admin/roles', (r) => r.fulfill({ json: [{ code: 'operator', name: 'operator', permissions: [] }] }));
  await page.route('**/api/v1/admin/users/u9/reset-password', (r) => r.fulfill({ json: { newPassword: 'Clave-Temporal-1' } }));
  await page.goto('/admin');

  await page.getByRole('button', { name: /Global Users/ }).click();
  await page.getByTitle('Edit Permissions and Role').click();
  await page.getByRole('button', { name: /Regenerate Password/ }).click();
  await page.getByTitle('Copy password').click();

  expect(await tipoDelAviso(page, /No se pudo copiar/)).toBe('error');
  await expect(page.locator('div.pointer-events-auto', { hasText: 'Copied to clipboard' })).toHaveCount(0);
});

for (const [pantalla, ruta, api, fila] of [
  ['transportista', '/carriers', '**/api/v1/carriers', { id: 'c1', name: 'Transportes Demo', tax_id: '30-1', contact_email: 'c@d', status: 'active', _count: { vehicles: 0, drivers: 0 } }],
  ['conductor', '/drivers', '**/api/v1/drivers', { id: 'd1', full_name: 'Conductor Demo', status: 'active' }],
] as const) {
  test(`🔴 si suspender un ${pantalla} FALLA, se ve como ERROR`, async ({ page }) => {
    // Era `CarriersPage.tsx:60` y `DriversPage.tsx:58`: el `catch` avisaba con
    // el tilde verde. El operador creía que lo había suspendido.
    await prepararSesion(page, 'account_owner', [
      'view_carriers', 'manage_carriers', 'view_drivers', 'manage_drivers', 'view_map',
    ]);
    await page.route(`${api}*`, (r) => r.fulfill({ json: [fila] }));
    await page.route(`${api}/*`, (r) =>
      r.request().method() === 'PUT'
        ? r.fulfill({ status: 500, json: { statusCode: 500, message: 'Error interno del servidor.' } })
        : r.fulfill({ json: fila }),
    );
    await page.goto(ruta);

    await page.locator('main').getByRole('button', { name: 'SUSPEND' }).click();

    expect(await tipoDelAviso(page, /Error al actualizar estado/)).toBe('error');
  });
}
