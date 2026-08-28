import { randomBytes } from 'crypto';

/**
 * Estas pruebas son sobre la forma de la RESPUESTA y sobre qué se escribe al
 * guardar. Son el complemento del test del módulo de cifrado: allá se prueba
 * que el cifrado funcione; acá, que la credencial no salga por la API y que no
 * se pierda al guardar.
 */
describe('avl-users.credenciales', () => {
  const entornoOriginal = { ...process.env };

  beforeEach(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    delete process.env.CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
  });

  afterAll(() => {
    process.env = entornoOriginal;
  });

  function importar() {
    let modulo!: typeof import('./avl-users.credenciales');
    jest.isolateModules(() => {
      modulo = require('./avl-users.credenciales');
    });
    return modulo;
  }

  /** Una fila como la que devuelve Prisma con CAMPOS_AVL_USER. */
  function fila(extra: Record<string, unknown> = {}) {
    return {
      id: 'avl-1',
      tenant_id: 'tenant-1',
      user_avl_code: 'PROV_01',
      name: 'Flota Norte',
      provider_username: 'usuario_rusertech',
      provider_password: 'Clave$Secreta',
      provider_api_key: 'ak_live_123',
      api_key: 'uuid-de-ingesta',
      is_active: true,
      ...extra,
    };
  }

  describe('aVistaPublica', () => {
    it('no deja salir las credenciales del proveedor', () => {
      const vista = importar().aVistaPublica(fila()) as Record<string, unknown>;

      expect(vista).not.toHaveProperty('provider_password');
      expect(vista).not.toHaveProperty('provider_api_key');
      expect(JSON.stringify(vista)).not.toContain('Clave$Secreta');
      expect(JSON.stringify(vista)).not.toContain('ak_live_123');
    });

    it('dice que hay credencial guardada en vez de dejar el hueco', () => {
      const vista = importar().aVistaPublica(fila());

      expect(vista.tiene_password_proveedor).toBe(true);
      expect(vista.tiene_api_key_proveedor).toBe(true);
    });

    it('distingue "no hay credencial" de "hay una y no te la muestro"', () => {
      const vista = importar().aVistaPublica(
        fila({ provider_password: null, provider_api_key: '' }),
      );

      expect(vista.tiene_password_proveedor).toBe(false);
      expect(vista.tiene_api_key_proveedor).toBe(false);
    });

    it('conserva el resto de los campos que la pantalla usa', () => {
      const vista = importar().aVistaPublica(fila()) as Record<string, unknown>;

      expect(vista.user_avl_code).toBe('PROV_01');
      expect(vista.provider_username).toBe('usuario_rusertech');
      expect(vista.name).toBe('Flota Norte');
    });

    it('tampoco filtra una credencial ya cifrada', () => {
      const m = importar();
      const cifrada = m.aVistaPublica(
        fila({ provider_password: 'v1:AAAA:BBBB:CCCC' }),
      ) as Record<string, unknown>;

      expect(JSON.stringify(cifrada)).not.toContain('v1:');
      expect(cifrada.tiene_password_proveedor).toBe(true);
    });
  });

  describe('credencialParaGuardar', () => {
    it('deja la columna intacta si el campo no viene', () => {
      const m = importar();
      expect(
        m.credencialParaGuardar(undefined, 'ctx', 'provider_password', false),
      ).toBeUndefined();
    });

    it('borra la credencial sólo con null explícito', () => {
      const m = importar();
      expect(m.credencialParaGuardar(null, 'ctx', 'provider_password', false)).toBeNull();
    });

    it('cifra el valor nuevo antes de guardarlo', () => {
      const m = importar();
      const guardado = m.credencialParaGuardar(
        'nueva clave',
        'ctx',
        'provider_password',
        false,
      );

      expect(guardado).toMatch(/^v1:/);
      expect(guardado).not.toContain('nueva clave');
    });

    it('EDICIÓN: una cadena vacía se rechaza en vez de pisar la credencial', () => {
      const m = importar();
      expect(() => m.credencialParaGuardar('', 'ctx', 'provider_password', false)).toThrow(
        /enviá null/,
      );
      expect(() => m.credencialParaGuardar('   ', 'ctx', 'provider_password', false)).toThrow();
    });

    it('ALTA: una cadena vacía es simplemente "sin credencial"', () => {
      const m = importar();
      expect(m.credencialParaGuardar('', 'ctx', 'provider_password', true)).toBeNull();
    });

    it('rechaza un tipo que no sea texto ni null', () => {
      const m = importar();
      expect(() => m.credencialParaGuardar(42, 'ctx', 'provider_password', false)).toThrow(
        /debe ser un texto/,
      );
    });
  });

  describe('descifrarCredenciales', () => {
    it('devuelve el valor original de una credencial cifrada', () => {
      const m = importar();
      const guardada = m.credencialParaGuardar(
        'Clave$Secreta',
        'avl_users.provider_password',
        'provider_password',
        false,
      ) as string;

      const claro = m.descifrarCredenciales({
        provider_username: 'usuario_rusertech',
        provider_password: guardada,
        provider_api_key: null,
      });

      expect(claro.provider_password).toBe('Clave$Secreta');
      expect(claro.hay_texto_plano).toBe(false);
    });

    it('avisa cuando la credencial todavía está en texto plano', () => {
      const claro = importar().descifrarCredenciales({
        provider_username: 'u',
        provider_password: 'ClaveVieja',
        provider_api_key: null,
      });

      expect(claro.provider_password).toBe('ClaveVieja');
      expect(claro.hay_texto_plano).toBe(true);
    });

    it('no inventa nada cuando no hay credenciales', () => {
      const claro = importar().descifrarCredenciales({
        provider_username: null,
        provider_password: null,
        provider_api_key: null,
      });

      expect(claro.provider_password).toBeNull();
      expect(claro.provider_api_key).toBeNull();
      expect(claro.hay_texto_plano).toBe(false);
    });
  });
});
