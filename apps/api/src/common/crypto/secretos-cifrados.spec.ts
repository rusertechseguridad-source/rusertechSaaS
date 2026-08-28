import { randomBytes } from 'crypto';

/**
 * El módulo lee la clave de `process.env` en cada llamada, así que cada bloque
 * que necesita otra clave la cambia y vuelve a importar con `jest.isolateModules`.
 * No se mockea `crypto`: la gracia del test es que el cifrado real ida y vuelta
 * funcione, y sobre todo que los caminos de error fallen de verdad.
 */
const CLAVE_A = randomBytes(32).toString('base64');
const CLAVE_B = randomBytes(32).toString('base64');

type Modulo = typeof import('./secretos-cifrados');

/** Importa el módulo con el entorno que esté puesto en este momento. */
function importarModulo(): Modulo {
  let modulo!: Modulo;
  jest.isolateModules(() => {
    modulo = require('./secretos-cifrados') as Modulo;
  });
  return modulo;
}

describe('secretos-cifrados', () => {
  const entornoOriginal = { ...process.env };

  beforeEach(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = CLAVE_A;
    delete process.env.CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
  });

  afterAll(() => {
    process.env = entornoOriginal;
  });

  describe('ida y vuelta', () => {
    it('devuelve el mismo valor que se cifró', () => {
      const m = importarModulo();
      const ctx = m.CONTEXTO.avlProviderPassword;
      const cifrado = m.cifrarSecreto('Pa$$w0rd del proveedor', ctx);

      expect(cifrado).toMatch(/^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
      expect(m.descifrarSecreto(cifrado, ctx)).toEqual({
        valor: 'Pa$$w0rd del proveedor',
        esLegado: false,
      });
    });

    it('no deja el texto plano visible en el valor guardado', () => {
      const m = importarModulo();
      const cifrado = m.cifrarSecreto('SECRETO_BUSCABLE', m.CONTEXTO.avlProviderPassword);
      expect(cifrado).not.toContain('SECRETO_BUSCABLE');
    });

    it('produce criptogramas distintos para el mismo valor (IV aleatorio)', () => {
      const m = importarModulo();
      const ctx = m.CONTEXTO.avlProviderPassword;
      expect(m.cifrarSecreto('misma', ctx)).not.toEqual(m.cifrarSecreto('misma', ctx));
    });

    it('conserva acentos, unicode y comillas', () => {
      const m = importarModulo();
      const ctx = m.CONTEXTO.avlProviderPassword;
      const valor = 'contraseña ñÑ áéí 中文 🔐 "comillas" \\barra';
      expect(m.descifrarSecreto(m.cifrarSecreto(valor, ctx), ctx).valor).toBe(valor);
    });
  });

  describe('valores en texto plano ya guardados (legado)', () => {
    it('los devuelve tal cual, marcados como legado', () => {
      const m = importarModulo();
      expect(m.descifrarSecreto('claveVieja123', m.CONTEXTO.avlProviderPassword)).toEqual({
        valor: 'claveVieja123',
        esLegado: true,
      });
    });

    it('no confunde con cifrado un legado que contiene dos puntos', () => {
      const m = importarModulo();
      const r = m.descifrarSecreto('usuario:clave:2024', m.CONTEXTO.avlProviderPassword);
      expect(r.esLegado).toBe(true);
      expect(r.valor).toBe('usuario:clave:2024');
    });

    it('no confunde con cifrado un legado que empieza con "v"', () => {
      const m = importarModulo();
      expect(m.estaCifrado('vpn-clave')).toBe(false);
      expect(m.estaCifrado('version1:algo')).toBe(false);
    });

    it('lee un legado aunque no haya clave configurada', () => {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
      const m = importarModulo();
      expect(m.descifrarSecreto('plano', m.CONTEXTO.avlProviderPassword)).toEqual({
        valor: 'plano',
        esLegado: true,
      });
    });
  });

  describe('idempotencia — la migración puede correr dos veces', () => {
    it('cifrar un valor ya cifrado lo deja intacto', () => {
      const m = importarModulo();
      const ctx = m.CONTEXTO.avlProviderPassword;
      const unaVez = m.cifrarSecreto('clave', ctx);

      expect(m.cifrarSecreto(unaVez, ctx)).toBe(unaVez);
      expect(m.descifrarSecreto(m.cifrarSecreto(unaVez, ctx), ctx).valor).toBe('clave');
    });
  });

  describe('null, undefined y cadena vacía', () => {
    it('no cifra la ausencia de credencial', () => {
      const m = importarModulo();
      const ctx = m.CONTEXTO.avlProviderPassword;
      expect(m.cifrarSecreto(null, ctx)).toBeNull();
      expect(m.cifrarSecreto(undefined, ctx)).toBeNull();
      expect(m.cifrarSecreto('', ctx)).toBeNull();
    });

    it('descifrar la ausencia no lanza y no inventa un valor', () => {
      const m = importarModulo();
      const ctx = m.CONTEXTO.avlProviderPassword;
      for (const vacio of [null, undefined, '']) {
        expect(m.descifrarSecreto(vacio, ctx)).toEqual({ valor: null, esLegado: false });
      }
    });

    it('no cifra un valor de sólo espacios (coherente con hayCredencial)', () => {
      const m = importarModulo();
      expect(m.cifrarSecreto('   ', m.CONTEXTO.avlProviderPassword)).toBeNull();
    });

    it('no recorta una contraseña que legítimamente tiene espacios al borde', () => {
      const m = importarModulo();
      const ctx = m.CONTEXTO.avlProviderPassword;
      const valor = '  clave con bordes  ';
      expect(m.descifrarSecreto(m.cifrarSecreto(valor, ctx), ctx).valor).toBe(valor);
    });

    it('hayCredencial sólo es true con contenido real', () => {
      const m = importarModulo();
      expect(m.hayCredencial(null)).toBe(false);
      expect(m.hayCredencial('')).toBe(false);
      expect(m.hayCredencial('   ')).toBe(false);
      expect(m.hayCredencial('algo')).toBe(true);
    });
  });

  describe('valor corrupto — lanza en vez de devolver basura', () => {
    /** Cifra y desarma el resultado para poder alterar una parte. */
    function piezas(m: Modulo) {
      const ctx = m.CONTEXTO.avlProviderPassword;
      const cifrado = m.cifrarSecreto('contraseña real', ctx);
      // Con un valor no vacío nunca es null; el assert lo deja explícito para
      // que un cambio futuro en cifrarSecreto rompa acá y no en el `.split`.
      expect(cifrado).not.toBeNull();
      const [, iv, tag, texto] = (cifrado as string).split(':');
      return { ctx, iv, tag, texto };
    }

    function alterarPrimerByte(b64: string): string {
      const bytes = Buffer.from(b64, 'base64');
      bytes[0] ^= 0x01;
      return bytes.toString('base64');
    }

    it('rechaza un ciphertext alterado', () => {
      const m = importarModulo();
      const { ctx, iv, tag, texto } = piezas(m);
      expect(() =>
        m.descifrarSecreto(`v1:${iv}:${tag}:${alterarPrimerByte(texto)}`, ctx),
      ).toThrow(m.SecretoIndescifrableError);
    });

    it('rechaza un tag alterado', () => {
      const m = importarModulo();
      const { ctx, iv, tag, texto } = piezas(m);
      expect(() =>
        m.descifrarSecreto(`v1:${iv}:${alterarPrimerByte(tag)}:${texto}`, ctx),
      ).toThrow(m.SecretoIndescifrableError);
    });

    it('rechaza un IV alterado', () => {
      const m = importarModulo();
      const { ctx, iv, tag, texto } = piezas(m);
      expect(() =>
        m.descifrarSecreto(`v1:${alterarPrimerByte(iv)}:${tag}:${texto}`, ctx),
      ).toThrow(m.SecretoIndescifrableError);
    });

    it('rechaza un valor con estructura incompleta', () => {
      const m = importarModulo();
      const { ctx } = piezas(m);
      expect(() => m.descifrarSecreto('v1:solounaparte', ctx)).toThrow(/corrupto/);
    });

    it('avisa que hay que actualizar la aplicación ante una versión futura', () => {
      const m = importarModulo();
      const { ctx, iv, tag, texto } = piezas(m);
      expect(() => m.descifrarSecreto(`v2:${iv}:${tag}:${texto}`, ctx)).toThrow(
        /sólo entiende v1/,
      );
    });
  });

  describe('clave equivocada', () => {
    it('falla en lugar de devolver un valor inventado', () => {
      const cifradoConA = importarModulo().cifrarSecreto(
        'contraseña del proveedor',
        'avl_users.provider_password',
      );

      process.env.CREDENTIALS_ENCRYPTION_KEY = CLAVE_B;
      const m = importarModulo();

      expect(() =>
        m.descifrarSecreto(cifradoConA, 'avl_users.provider_password'),
      ).toThrow(m.SecretoIndescifrableError);
    });

    it('no degrada a "es legado" cuando la clave no autentica', () => {
      const cifrado = importarModulo().cifrarSecreto('x', 'avl_users.provider_password');

      process.env.CREDENTIALS_ENCRYPTION_KEY = CLAVE_B;
      const m = importarModulo();

      let resultado: unknown = 'no lanzó';
      try {
        resultado = m.descifrarSecreto(cifrado, 'avl_users.provider_password');
      } catch (error) {
        resultado = error;
      }
      expect(resultado).toBeInstanceOf(m.SecretoIndescifrableError);
    });
  });

  describe('contexto (AAD)', () => {
    it('un criptograma de una columna no se puede leer como el de otra', () => {
      const m = importarModulo();
      const cifrado = m.cifrarSecreto('clave', m.CONTEXTO.avlProviderPassword);

      expect(() => m.descifrarSecreto(cifrado, m.CONTEXTO.avlProviderApiKey)).toThrow(
        m.SecretoIndescifrableError,
      );
    });
  });

  describe('rotación de clave', () => {
    it('lee lo cifrado con la clave anterior mientras dure la rotación', () => {
      const viejo = importarModulo().cifrarSecreto(
        'credencial vieja',
        'avl_users.provider_password',
      );

      process.env.CREDENTIALS_ENCRYPTION_KEY = CLAVE_B;
      process.env.CREDENTIALS_ENCRYPTION_KEY_PREVIOUS = CLAVE_A;
      const m = importarModulo();

      expect(m.descifrarSecreto(viejo, 'avl_users.provider_password').valor).toBe(
        'credencial vieja',
      );
      // Lo nuevo se cifra con la clave activa.
      const nuevo = m.cifrarSecreto('credencial nueva', 'avl_users.provider_password');
      expect(m.descifrarSecreto(nuevo, 'avl_users.provider_password').valor).toBe(
        'credencial nueva',
      );
    });

    it('tras re-cifrar y quitar la clave anterior, lo viejo ya no se lee', () => {
      const ctx = 'avl_users.provider_password';
      const viejo = importarModulo().cifrarSecreto('rotame', ctx);

      process.env.CREDENTIALS_ENCRYPTION_KEY = CLAVE_B;
      process.env.CREDENTIALS_ENCRYPTION_KEY_PREVIOUS = CLAVE_A;
      const enRotacion = importarModulo();
      const recifrado = enRotacion.cifrarSecreto(
        enRotacion.descifrarSecreto(viejo, ctx).valor,
        ctx,
      );

      delete process.env.CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
      const despues = importarModulo();

      expect(despues.descifrarSecreto(recifrado, ctx).valor).toBe('rotame');
      expect(() => despues.descifrarSecreto(viejo, ctx)).toThrow(
        despues.SecretoIndescifrableError,
      );
    });
  });

  describe('configuración de la clave — falla temprano y explícito', () => {
    it('sin la variable de entorno, no arranca', () => {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
      const m = importarModulo();

      expect(() => m.assertClaveDeCifrado()).toThrow(m.ClaveDeCifradoInvalidaError);
      expect(() => m.assertClaveDeCifrado()).toThrow(/openssl rand -base64 32/);
    });

    it('rechaza una clave de largo incorrecto diciendo cuántos bytes tiene', () => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(16).toString('base64');
      const m = importarModulo();

      expect(() => m.assertClaveDeCifrado()).toThrow(/16 bytes/);
    });

    it('acepta una clave de 32 bytes en base64', () => {
      const m = importarModulo();
      expect(() => m.assertClaveDeCifrado()).not.toThrow();
    });

    it('sin clave no guarda en texto plano: cifrar lanza', () => {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY;
      const m = importarModulo();

      expect(() => m.cifrarSecreto('x', m.CONTEXTO.avlProviderPassword)).toThrow(
        m.ClaveDeCifradoInvalidaError,
      );
    });
  });
});
