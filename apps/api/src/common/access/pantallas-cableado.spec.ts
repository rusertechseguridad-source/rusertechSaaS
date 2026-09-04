import { readFileSync } from 'fs';
import { join } from 'path';
import { globSync } from 'glob';

/**
 * CABLEADO DE LAS PANTALLAS — el barrido de la Tanda 6.
 *
 * Mismo patrón que los barridos anteriores: cruza el frontend contra sí mismo
 * para encontrar lo que leer un archivo no ve. Corre desde `apps/api` porque
 * es donde vive jest, y mira `../web` con la ruta normalizada — el separador de
 * Windows ya rompió un barrido en la Tanda 4.
 */
const WEB = join(__dirname, '..', '..', '..', '..', 'web', 'src');
const leer = (f: string) => readFileSync(f, 'utf-8');
const corto = (f: string) => f.replace(WEB, '').replace(/\\/g, '/').replace(/^\//, '');

const existeWeb = (() => { try { return globSync('**/*.tsx', { cwd: WEB }).length > 0; } catch { return false; } })();
const soloSiHayWeb = existeWeb ? describe : describe.skip;

soloSiHayWeb('Pantallas · la regla de los avisos y los estados de borde', () => {
  const fuentes = globSync('**/*.{ts,tsx}', { cwd: WEB, absolute: true })
    .filter((f) => !f.endsWith('.d.ts'));

  it('encuentra el frontend', () => {
    expect(fuentes.length).toBeGreaterThan(20);
  });

  // ── 1 · Nadie muestra el cuerpo crudo de un error ──────────────────────
  it('🔴 ningún store muestra `res.text()` directo al usuario', () => {
    // Es lo que hacía `vehiclesStore`: el operador veía el JSON entero del
    // backend en una ventana del navegador.
    const culpables = fuentes
      .filter((f) => corto(f).startsWith('store/'))
      .filter((f) => {
        const t = leer(f);
        return /alert\([^)]*(res|err|error)\.(text|message)/.test(t)
            || /alert\([^)]*await\s+res\.text\(\)/.test(t);
      })
      .map(corto);
    expect(culpables).toEqual([]);
  });

  it('🔴 ninguna pantalla usa `alert(` para informar el resultado de un guardado', () => {
    // El `alert` del navegador no es un aviso: bloquea, no se puede estilar y
    // no distingue éxito de error. La regla de producto pide confirmación
    // visual, y para eso está el toast.
    const permitidos = new Set<string>([
      // `confirm(` para borrar es otra cosa y se conserva.
    ]);
    const culpables = fuentes
      .filter((f) => /(?<![.\w])alert\(|window\.alert\(/.test(leer(f)))
      .map(corto)
      .filter((f) => !permitidos.has(f));
    expect(culpables).toEqual([]);
  });

  // ── 2 · Los cuatro stores que no distinguían falló de vacío ────────────
  it.each([
    ['trips/TripsPage.tsx', 'viajes'],
    ['vehicles/VehiclesPage.tsx', 'vehículos'],
    ['locations/LocationsPage.tsx', 'ubicaciones'],
    ['routes/RoutesPage.tsx', 'recorridos'],
    ['analytics/AnalyticsDashboard.tsx', 'analítica'],
  ])('%s lee el error y lo muestra', (relativo) => {
    const t = leer(join(WEB, 'pages', relativo));
    // `toContain('EstadoConsulta')` a secas daba verde con `EstadoConsultaX`:
    // es una subcadena. Lo encontró la prueba negativa. Se exige el import y
    // el uso como etiqueta JSX.
    expect(t).toMatch(/import \{[^}]*\bEstadoConsulta\b[^}]*\} from/);
    expect(t).toMatch(/<EstadoConsulta[\s/>]/);
    // Y el error tiene que evaluarse ANTES que `loading`: una consulta que
    // falló devuelve lista vacía, y "no hay datos" sería la mentira.
    const posError = t.indexOf('error ?');
    const posLoading = t.indexOf('loading ?');
    if (posError >= 0 && posLoading >= 0) expect(posError).toBeLessThan(posLoading);
  });

  // ── 3 · El chequeo de administrador es uno solo ───────────────────────
  it('🔴 ningún archivo reimplementa el chequeo de administrador', () => {
    // `SUPERADMIN`, `super_admin` y `admin_master_rusertech` no existen en el
    // seed. Alcanzaba con crear un rol con ese nombre desde la pantalla de
    // roles para tener acceso total.
    const muertos = ['SUPERADMIN', 'super_admin', 'admin_master_rusertech'];
    const culpables: string[] = [];
    for (const f of fuentes) {
      if (corto(f) === 'constants/adminRoles.ts') continue; // ahí se documentan
      const t = leer(f);
      for (const s of muertos) {
        // Sólo cuenta como uso si está en una comparación, no en un comentario.
        if (new RegExp(`(===|!==|includes\\()\\s*['"]${s}['"]`).test(t)) {
          culpables.push(`${corto(f)} → ${s}`);
        }
      }
    }
    expect(culpables).toEqual([]);
  });

  // ── 4 · El modal de sensores manda el campo que el backend lee ────────
  it('🔴 SensorConfigModal manda `scope_id`, no `vehicle_id`', () => {
    // Cadena de frío: con `vehicle_id` el `where` de Prisma quedaba con un
    // `undefined`, que Prisma OMITE, y los umbrales se escribían sobre la
    // configuración de otro vehículo del tenant.
    const t = leer(join(WEB, 'pages/sensors/SensorConfigModal.tsx'));
    expect(t).toContain('scope_id: vehicleId');
    expect(t).not.toMatch(/body: JSON\.stringify\(\{[^}]*vehicle_id:/s);
  });
});
