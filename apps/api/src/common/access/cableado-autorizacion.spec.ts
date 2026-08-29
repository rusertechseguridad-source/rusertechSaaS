import { readFileSync } from 'fs';
import { join } from 'path';
import { globSync } from 'glob';
import { PERMISSION_KEYS } from '../constants/permissions';

/**
 * BARRIDO DE CABLEADO — la prueba que encuentra lo que leer un archivo no ve.
 *
 * Dos de los tres hallazgos más caros de la auditoría no eran errores de código
 * sino de conexión: `forwarding` declaraba `@Roles` sin enchufar el guard, y
 * `routes.findAll` importaba `tenantWhere` y no lo usaba. Los dos archivos se
 * leían perfecto y ningún `tsc` ni prueba los veía.
 *
 * Esto cruza el repo contra sí mismo: cada decorador contra el guard que lo
 * hace efectivo, y cada ruta de escritura contra el permiso que debería pedir.
 */
const RAIZ = join(__dirname, '..', '..');
const controladores = globSync('**/*.controller.ts', { cwd: RAIZ, absolute: true })
  .filter((f) => !f.endsWith('.spec.ts'));

const leer = (f: string) => readFileSync(f, 'utf-8');
/**
 * ⚠️ Normalizar el separador NO es cosmético: `path.join` devuelve `\` en
 * Windows, la lista de exenciones de abajo usa `/`, y ninguna coincidía —
 * el barrido fallaba entero en la máquina de Gustavo y pasaba en la mía.
 * Es la tercera vez en esta serie que un verificador da un resultado
 * distinto según el entorno.
 */
const corto = (f: string) => f.replace(RAIZ, '').replace(/\\/g, '/').replace(/^\//, '');

/**
 * ⚠️ Un guard cuenta sólo si está DENTRO de un `@UseGuards(...)`.
 *
 * La primera versión de este barrido preguntaba si el archivo "contenía"
 * `PermissionsGuard` — y el `import` lo contiene. Quitarlo del `@UseGuards`
 * dejaba el decorador inerte y el barrido seguía en verde: el mismo error que
 * viene a detectar, dentro del detector. Lo encontró la prueba negativa.
 */
function guardEnchufado(texto: string, guard: string): boolean {
  return [...texto.matchAll(/@UseGuards\(([^)]*)\)/g)].some((m) => m[1].includes(guard));
}

/** Handlers de escritura declarados en un controlador. */
function rutasDeEscritura(texto: string): string[] {
  return texto
    .split('\n')
    .filter((l) => /^\s*@(Post|Put|Patch|Delete)\(/.test(l))
    .map((l) => l.trim());
}

describe('Cableado de autorización', () => {
  it('encuentra los controladores', () => {
    expect(controladores.length).toBeGreaterThan(20);
  });

  // ── 1 · Un decorador sin su guard es decoración ────────────────────────
  it('ningún @RequirePermissions sin PermissionsGuard', () => {
    const inertes = controladores.filter((f) => {
      const t = leer(f);
      return t.includes('@RequirePermissions') && !guardEnchufado(t, 'PermissionsGuard');
    });
    expect(inertes.map(corto)).toEqual([]);
  });

  it('ningún @Roles sin RolesGuard', () => {
    // Éste ya cazó `forwarding` en la Tanda 1, cuando era un `grep` a mano.
    const inertes = controladores.filter((f) => {
      const t = leer(f);
      return /@Roles\(/.test(t) && !guardEnchufado(t, 'RolesGuard');
    });
    expect(inertes.map(corto)).toEqual([]);
  });

  // ── 2 · Toda escritura pide un permiso o un rol ────────────────────────
  it('todo controlador con rutas de escritura declara alguna autorización', () => {
    // Excepciones DECLARADAS, con su motivo. Que estén acá y no en un `filter`
    // suelto es a propósito: agregar una obliga a escribir por qué.
    const exentos: Record<string, string> = {
      'auth/auth.controller.ts': 'POST /auth/login es la puerta de entrada: no puede exigir permisos.',
      'telemetry/telemetry.controller.ts': 'Ingesta del HUB: se autentica con ApiKeyGuard por AVL user, no con JWT.',
      'app.controller.ts': 'POST /upload sólo exige sesión; el permiso por tipo de archivo no existe en el catálogo.',
      'simulator/simulator.controller.ts': 'Detrás de AVL_SIMULATOR_ENABLED; el catálogo tiene use_simulator y su cableado es de otra tanda.',
      'admin/admin.controller.ts': 'Las 17 rutas pasan por checkSuperAdmin(), que es más estricto que cualquier permiso.',
      'settings/settings.controller.ts': 'Usa @Roles con RolesGuard, verificado por la prueba de arriba.',
      'operational-protocols/operational-protocols.controller.ts': 'Usa @Roles con RolesGuard.',
      'security-keys/security-keys.controller.ts': 'Usa @Roles con RolesGuard.',
      'forwarding/forwarding.controller.ts': 'Usa @Roles con RolesGuard (enchufado en la Tanda 1).',
    };

    // ⚠️ Cada clave de `exentos` tiene que corresponder a un archivo REAL.
    // Si `corto()` deja de normalizar el separador —lo que pasaba en Windows—
    // ninguna coincide, todas las exenciones se vuelven letra muerta y el
    // barrido falla entero. Esta comprobación lo caza en cualquier sistema.
    const rutasReales = new Set(controladores.map(corto));
    const exencionesMuertas = Object.keys(exentos).filter((k) => !rutasReales.has(k));
    expect(exencionesMuertas).toEqual([]);

    const desprotegidos = controladores
      .filter((f) => {
        const t = leer(f);
        if (rutasDeEscritura(t).length === 0) return false;
        if (t.includes('@RequirePermissions') || /@Roles\(/.test(t)) return false;
        return !(corto(f) in exentos);
      })
      .map(corto);

    expect(desprotegidos).toEqual([]);
  });

  // ── 3 · Ningún permiso inventado ───────────────────────────────────────
  it('todo permiso exigido existe en el catálogo', () => {
    // Un permiso inventado es peor que ninguno: parece protegido y no lo está,
    // porque `PermissionsGuard` compara strings exactos y nadie lo tiene.
    const inventados: string[] = [];
    for (const f of controladores) {
      for (const m of leer(f).matchAll(/@RequirePermissions\(([^)]*)\)/g)) {
        for (const p of m[1].split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, ''))) {
          if (p && !(PERMISSION_KEYS as string[]).includes(p)) {
            inventados.push(`${corto(f)} → ${p}`);
          }
        }
      }
    }
    expect(inventados).toEqual([]);
  });

  // ── 4 · Las 17 rutas de escritura de esta tanda, una por una ───────────
  describe('las 17 rutas de escritura que la Tanda 4 tenía que cerrar', () => {
    it.each([
      ['notifications', 4, 'manage_settings'],
      ['devices', 3, 'manage_devices'],
      ['drivers', 3, 'manage_drivers'],
      ['carriers', 3, 'manage_carriers'],
      ['sensors', 2, 'manage_sensors'],
    ])('%s: %i rutas con %s', (modulo, cuantas, permiso) => {
      const t = leer(join(RAIZ, modulo, `${modulo}.controller.ts`));
      const ocurrencias = (t.match(new RegExp(`@RequirePermissions\\('${permiso}'\\)`, 'g')) ?? []).length;
      expect(ocurrencias).toBe(cuantas);
      // Y ninguna escritura sin decorador: se compara con el total.
      expect(rutasDeEscritura(t).length).toBe(cuantas);
    });

    it('alerts: 2 rutas, con permisos distintos según lo que tocan', () => {
      const t = leer(join(RAIZ, 'alerts', 'alerts.controller.ts'));
      expect(t).toContain("@RequirePermissions('manage_settings')");
      expect(t).toContain("@RequirePermissions('manage_alerts')");
      expect(rutasDeEscritura(t).length).toBe(2);
    });
  });

  // ── 5 · Las restricciones por entidad llegan a los servicios ───────────
  it('los servicios que las aplican reciben el USUARIO, no sólo el tenant', () => {
    // La restricción no se puede aplicar si el servicio nunca ve quién pregunta.
    // Ése era el diagnóstico: "la firma del servicio ni siquiera recibe al usuario".
    const esperados = [
      'vehicles/vehicles.service.ts',
      'trips/trips.service.ts',
      'locations/locations.service.ts',
      'alerts/alerts.service.ts',
      'sensors/sensors.service.ts',
    ];
    const sinAcceso = esperados.filter((r) => !leer(join(RAIZ, r)).includes('AccesoEntidadesService'));
    expect(sinAcceso).toEqual([]);
  });
});
