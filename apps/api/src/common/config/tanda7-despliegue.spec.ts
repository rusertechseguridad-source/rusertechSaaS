import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { globSync } from 'glob';

/**
 * TANDA 7 — QUE LA APLICACIÓN SE PUEDA DESPLEGAR.
 *
 * Cada bloque prueba el SÍNTOMA que impedía desplegar, no la función que lo
 * causaba. Y cada `it` de barrido se probó al revés antes de confiar en él:
 * se deshizo la corrección y se comprobó que falla. Las reversiones y su
 * resultado están en el reporte.
 *
 * La raíz de `apps/api` se calcula desde `__dirname` y se normaliza el
 * separador: un barrido de la Tanda 4 ya se rompió en Windows por eso.
 */
const API = join(__dirname, '..', '..', '..');
const WEB = join(API, '..', 'web');
const leerApi = (rel: string) => readFileSync(join(API, rel), 'utf-8');
const hayWeb = (() => {
  try {
    return globSync('src/**/*.tsx', { cwd: WEB }).length > 0;
  } catch {
    return false;
  }
})();
const siHayWeb = hayWeb ? describe : describe.skip;

/**
 * Quita comentarios antes de escanear.
 *
 * ⚠️ Sin esto, dos barridos de esta misma suite dieron falso positivo contra
 * los COMENTARIOS que explican la corrección ("era `Math.random()`…",
 * "`fetch('/api/v1/…')` resolvería contra Vite"). Es la tercera vez en esta
 * serie que un barrido se equivoca por leer prosa como si fuera código, así
 * que la limpieza vive en un solo lugar.
 */
function soloCodigo(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, '')   // bloques /* … */ y /** … */
    .replace(/(^|[^:])\/\/.*$/gm, '$1'); // línea // …  (sin comerse http://)
}

const CLAVE = randomBytes(32).toString('base64');
const SECRETO = randomBytes(48).toString('base64');

/** Entorno mínimo con el que la aplicación SÍ arranca. */
function entornoValido(): Record<string, string> {
  return {
    JWT_SECRET: SECRETO,
    JWT_REFRESH_SECRET: randomBytes(48).toString('base64'),
    CREDENTIALS_ENCRYPTION_KEY: CLAVE,
    DATABASE_URL: 'postgresql://u:p@host.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10',
    DIRECT_URL: 'postgresql://u:p@db.host.supabase.co:5432/postgres',
  };
}

/** Corre una función con un entorno controlado y lo restaura después. */
function conEntorno<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const previo = process.env;
  process.env = { ...env } as NodeJS.ProcessEnv;
  try {
    return fn();
  } finally {
    process.env = previo;
  }
}

/** Importa un módulo de configuración con el entorno actual. */
function importar<T>(ruta: string): T {
  let modulo!: T;
  jest.isolateModules(() => {
    modulo = require(ruta) as T;
  });
  return modulo;
}

// ════════════════════════════════════════════════════════════════════════════
// 1 · LA APLICACIÓN YA NO ESTÁ ATADA A localhost
// ════════════════════════════════════════════════════════════════════════════
siHayWeb('Tanda 7 · 1 · la dirección de la API sale de una variable', () => {
  const fuentes = globSync('src/**/*.{ts,tsx}', { cwd: WEB, absolute: true });

  it('encuentra el frontend', () => {
    expect(fuentes.length).toBeGreaterThan(20);
  });

  it('🔴 no queda ninguna dirección del backend incrustada en el frontend', () => {
    // Eran 149 en 49 archivos. Subida a un servidor, la aplicación le pedía los
    // datos a la máquina de quien abría el navegador.
    const culpables = fuentes
      .filter((f) => readFileSync(f, 'utf-8').includes('localhost:3000'))
      .map((f) => f.replace(WEB, '').replace(/\\/g, '/'));
    expect(culpables).toEqual([]);
  });

  it('la base sale de VITE_API_URL, con el 3000 local por defecto', () => {
    const t = readFileSync(join(WEB, 'src/services/api.ts'), 'utf-8');
    expect(t).toMatch(/import\.meta\.env\.VITE_API_URL/);
    // `??` y no `||`: con `||`, una VITE_API_URL="" deliberada (mismo dominio,
    // rutas relativas) caería al valor de desarrollo.
    expect(t).toMatch(/VITE_API_URL \?\? /);
    expect(t).not.toMatch(/VITE_API_URL \|\| /);
  });

  it('todos los que llaman al backend importan la constante', () => {
    // Un archivo que llame `fetch` a `/api/v1/...` sin importar `API_URL`
    // volvería a incrustar una dirección, esta vez relativa (404 contra Vite).
    const sinImportar = fuentes
      .filter((f) => /fetch\(\s*[`'"]\/api\/v1/.test(soloCodigo(readFileSync(f, 'utf-8'))))
      .map((f) => f.replace(WEB, '').replace(/\\/g, '/'));
    expect(sinImportar).toEqual([]);
  });

  it('el archivo de ejemplo del frontend documenta la variable', () => {
    const ruta = join(WEB, '.env.example');
    expect(existsSync(ruta)).toBe(true);
    expect(readFileSync(ruta, 'utf-8')).toMatch(/VITE_API_URL/);
  });
});

describe('Tanda 7 · 1b · CORS y la dirección pública salen de variables', () => {
  type Modulo = typeof import('./direccion-publica');

  it('🔴 sin CORS_ORIGIN quedan los de desarrollo; con ella, los que diga', () => {
    conEntorno({}, () => {
      const m = importar<Modulo>('./direccion-publica');
      expect(m.origenesPermitidos()).toEqual([
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ]);
    });

    conEntorno({ CORS_ORIGIN: 'https://app.midominio.com, https://admin.midominio.com' }, () => {
      const m = importar<Modulo>('./direccion-publica');
      expect(m.origenesPermitidos()).toEqual([
        'https://app.midominio.com',
        'https://admin.midominio.com',
      ]);
    });
  });

  it('la barra final se recorta: el navegador compara la cadena exacta', () => {
    conEntorno({ CORS_ORIGIN: 'https://app.midominio.com/' }, () => {
      const m = importar<Modulo>('./direccion-publica');
      expect(m.origenesPermitidos()).toEqual(['https://app.midominio.com']);
    });
  });

  it('🔴 "*" se rechaza en vez de aceptarse en silencio', () => {
    // Con `credentials: true` el navegador descarta la respuesta ante un
    // comodín, así que aceptarlo sería prometer algo que no ocurre.
    conEntorno({ CORS_ORIGIN: '*' }, () => {
      const m = importar<Modulo>('./direccion-publica');
      expect(m.problemasDeCors().join(' ')).toMatch(/"\*"/);
    });
  });

  it('una entrada con ruta se rechaza nombrándola', () => {
    conEntorno({ CORS_ORIGIN: 'https://app.midominio.com/panel' }, () => {
      const m = importar<Modulo>('./direccion-publica');
      expect(m.problemasDeCors().join(' ')).toMatch(/app\.midominio\.com\/panel/);
    });
  });

  it('la URL de los archivos subidos sigue siendo absoluta, pero configurable', () => {
    conEntorno({ PUBLIC_API_URL: 'https://api.midominio.com/' }, () => {
      const m = importar<Modulo>('./direccion-publica');
      expect(m.direccionPublica()).toBe('https://api.midominio.com');
    });
    // El controller la usa; una ruta relativa daría 404 contra Vite.
    const t = leerApi('src/app.controller.ts');
    expect(t).toMatch(/\$\{direccionPublica\(\)\}\$\{PREFIJO_UPLOADS\}/);
    expect(t).not.toMatch(/http:\/\/localhost:3000/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2 · npm run start:prod
// ════════════════════════════════════════════════════════════════════════════
describe('Tanda 7 · 2 · el binario compilado arranca desde dist/main', () => {
  it('🔴 la compilación de producción sólo incluye src', () => {
    // Sin `include`, los 14 scripts sueltos de la raíz y los 7 de prisma/
    // entraban en la compilación y corrían el rootDir un nivel arriba: la
    // salida quedaba en dist/src/main.js mientras start:prod pedía dist/main.
    const t = leerApi('tsconfig.build.json');
    expect(t).toMatch(/"include":\s*\[\s*"src\/\*\*\/\*"\s*\]/);
  });

  it('start:prod apunta a donde el build deja main', () => {
    const pkg = JSON.parse(leerApi('package.json'));
    expect(pkg.scripts['start:prod']).toBe('node dist/main');
  });

  it('🔴 el script destructivo ya no está en el repositorio', () => {
    // `clean_trips.ts` hacía `deleteMany` de todos los viajes en BORRADOR o
    // in_progress SIN filtro de tenant, y se empaquetaba en dist/. Se verificó
    // en la historia de git: nunca había sido borrado, así que no era "otra
    // copia" — era la original.
    expect(existsSync(join(API, 'clean_trips.ts'))).toBe(false);
  });

  it('los scripts de diagnóstico que sí sirven se conservan', () => {
    // Chesterton: `check_db.ts` y `debug_token.ts` sólo LEEN. Sacarlos de la
    // compilación alcanzaba; borrarlos habría sido pérdida sin motivo.
    expect(existsSync(join(API, 'check_db.ts'))).toBe(true);
    expect(existsSync(join(API, 'debug_token.ts'))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3 · EL CORREO
// ════════════════════════════════════════════════════════════════════════════
describe('Tanda 7 · 3 · el fallo de envío deja de pasar por bueno', () => {
  const { MailService } = require('../../mail/mail.service');

  const armar = (respuesta: unknown) => {
    const servicio = new MailService();
    (servicio as any).resend = { emails: { send: jest.fn().mockResolvedValue(respuesta) } };
    (servicio as any).logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
    return servicio;
  };

  const params = {
    to: 'nuevo@cliente.com',
    fullName: 'Nuevo',
    tempPassword: 'x',
    tenantName: 'Cliente',
  };

  beforeEach(() => {
    process.env.RESEND_API_KEY = 'clave-de-prueba';
  });

  it('🔴 un rechazo de la API se detecta aunque la promesa RESUELVA', async () => {
    // ÉSTE es el hallazgo. El SDK de Resend no lanza: devuelve
    // `{ data: null, error }` con la promesa resuelta. El try/catch que
    // envolvía la llamada nunca corría y `emailSent` valía true.
    const servicio = armar({
      data: null,
      error: {
        name: 'validation_error',
        message:
          'You can only send testing emails to your own email address ' +
          '(rusertechseguridad@gmail.com). To send emails to other recipients, ' +
          'please verify a domain at resend.com/domains',
      },
    });

    const r = await servicio.sendInvitation(params);

    expect(r.enviado).toBe(false);
    // Y el motivo dice QUÉ HACER, no sólo qué pasó.
    expect(r.motivo).toMatch(/modo de prueba/i);
    expect(r.motivo).toMatch(/resend\.com\/domains/);
  });

  it('un envío correcto devuelve enviado: true', async () => {
    const servicio = armar({ data: { id: 'abc-123' }, error: null });
    const r = await servicio.sendInvitation(params);
    expect(r).toEqual({ enviado: true, id: 'abc-123' });
  });

  it('un fallo de red tampoco lanza: devuelve el motivo', async () => {
    const servicio = new MailService();
    (servicio as any).resend = {
      emails: { send: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) },
    };
    (servicio as any).logger = { log: jest.fn(), error: jest.fn() };
    const r = await servicio.sendInvitation(params);
    expect(r.enviado).toBe(false);
    expect(r.motivo).toMatch(/ECONNREFUSED/);
  });

  it('🔴 sin RESEND_API_KEY el servicio se CONSTRUYE igual', () => {
    // Encontrado por esta prueba, no leyendo el código: el constructor hacía
    // `new Resend(process.env.RESEND_API_KEY)` y el SDK LANZA con `undefined`.
    // Como Nest instancia el servicio al levantar el módulo, sin la variable
    // NO ARRANCABA LA API ENTERA, con el mensaje "Missing API key" — que no
    // menciona ni una variable de entorno ni el correo. El correo es opcional:
    // que falte tiene que dejar la aplicación sin correo, no sin aplicación.
    delete process.env.RESEND_API_KEY;
    expect(() => new MailService()).not.toThrow();
  });

  it('sin RESEND_API_KEY no se intenta enviar, y se dice por qué', async () => {
    delete process.env.RESEND_API_KEY;
    const servicio = new MailService();
    (servicio as any).logger = { log: jest.fn(), error: jest.fn() };
    const r = await servicio.sendInvitation(params);
    expect(r.enviado).toBe(false);
    expect(r.motivo).toMatch(/RESEND_API_KEY/);
  });

  it('🔴 el remitente sale de MAIL_FROM, no de una constante del código', () => {
    const t = leerApi('src/mail/mail.service.ts');
    expect(t).toMatch(/process\.env\.MAIL_FROM/);
    // Los dos remitentes escritos a mano ya no están.
    expect(t).not.toMatch(/from: 'Rusertech <onboarding@resend\.dev>'/);
    expect(t).not.toMatch(/from: 'Rusertech <alertas@resend\.dev>'/);
  });

  it('🔴 quien invita MIRA el resultado en vez de deducirlo de una excepción', () => {
    // Lo que importa es que el resultado se INSPECCIONE. La forma exacta de la
    // llamada no: los dos llamadores la envuelven en un `try/catch` defensivo
    // —corren después de que la transacción confirmó— y esta prueba se rompió
    // sola cuando lo agregué, por afirmar la forma en vez del comportamiento.
    const settings = leerApi('src/settings/settings.service.ts');
    expect(settings).toMatch(/this\.mailService\.sendInvitation\(/);
    expect(settings).toMatch(/if \(!envio\.enviado\)/);
    expect(settings).toMatch(/emailSent: false/);

    const admin = leerApi('src/admin/admin.service.ts');
    expect(admin).toMatch(/this\.mailService\.sendInvitation\(/);
    expect(admin).toMatch(/envio\.enviado/);

    // Y la garantía de fondo: NINGUNO de los dos decide el resultado sólo por
    // la ausencia de una excepción. Si alguien vuelve a `return true` sin mirar
    // `envio`, esto lo tiene que ver.
    for (const fuente of [settings, admin]) {
      expect(soloCodigo(fuente)).not.toMatch(/emailSent: true,?\s*\}?\s*;?\s*\}\s*catch/);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4 · REDIS
// ════════════════════════════════════════════════════════════════════════════
describe('Tanda 7 · 4 · una REDIS_URL mal formada se detecta al arrancar', () => {
  type Modulo = typeof import('./redis-conexion');

  it('🔴 la URL de la API REST sin token es ERROR, no aviso', () => {
    // Con la URL mal, el cliente abría igual y cada comando quedaba encolado:
    // el pedido HTTP no terminaba y retenía su conexión de Prisma hasta agotar
    // el pool. "Configurada mal" es peor que "no configurada".
    conEntorno({ REDIS_URL: 'https://living-sailfish-114759.upstash.io' }, () => {
      const m = importar<Modulo>('./redis-conexion');
      const { errores } = m.problemasDeRedis();
      expect(errores).toHaveLength(1);
      expect(errores[0]).toMatch(/REDIS_TOKEN/);
    });
  });

  it('con el token, la https:// se convierte y no hay problema', () => {
    conEntorno({ REDIS_URL: 'https://algo.upstash.io', REDIS_TOKEN: 'tok' }, () => {
      const m = importar<Modulo>('./redis-conexion');
      expect(m.problemasDeRedis().errores).toEqual([]);
      expect(m.normalizarUrlRedis('https://algo.upstash.io')).toBe(
        'rediss://default:tok@algo.upstash.io:6379',
      );
    });
  });

  it('un esquema que ioredis no entiende se rechaza nombrándolo', () => {
    conEntorno({ REDIS_URL: 'http://algo.upstash.io' }, () => {
      const m = importar<Modulo>('./redis-conexion');
      expect(m.problemasDeRedis().errores.join(' ')).toMatch(/redis:\/\/ o rediss:\/\//);
    });
  });

  it('AUSENTE es válido: Redis es opcional y sólo avisa qué queda sin servicio', () => {
    conEntorno({}, () => {
      const m = importar<Modulo>('./redis-conexion');
      const { errores, avisos } = m.problemasDeRedis();
      expect(errores).toEqual([]);
      expect(avisos.join(' ')).toMatch(/colas de BullMQ/);
    });
  });

  it('🔴 el cliente ya no encola comandos para siempre', () => {
    // Ésa era la causa real del cuelgue, no el esquema de la URL.
    const t = leerApi('src/common/redis/redis.service.ts');
    expect(t).toMatch(/maxRetriesPerRequest: 2/);
    expect(t).toMatch(/enableOfflineQueue: false/);
    expect(t).toMatch(/connectTimeout: \d+/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5 · CREDENCIALES
// ════════════════════════════════════════════════════════════════════════════
describe('Tanda 7 · 5 · las credenciales no viajan al navegador', () => {
  it('🔴 GET /alerts/settings exige permiso', () => {
    const t = leerApi('src/alerts/alerts.controller.ts');
    // El decorador tiene que estar SOBRE el getSettings, no sólo en el archivo.
    expect(t).toMatch(
      /@RequirePermissions\('manage_settings'\)\s*\n\s*@Get\('settings'\)/,
    );
  });

  it('🔴 y además la respuesta va enmascarada: el permiso solo no alcanza', () => {
    // Un `manager` legítimo tampoco necesita ver la contraseña SMTP.
    const t = leerApi('src/alerts/alerts.service.ts');
    expect(t).toMatch(/enmascararSettingsJson\(tenant\?\.settings_json\)/);
    expect(t).not.toMatch(/return tenant\?\.settings_json \|\| \{\}/);
  });

  it('la contraseña SMTP se cifra al guardar y vuelve como marcador', () => {
    conEntorno({ CREDENTIALS_ENCRYPTION_KEY: CLAVE }, () => {
      const m = importar<typeof import('../crypto/credenciales-notificaciones')>(
        '../crypto/credenciales-notificaciones',
      );
      const guardado = m.cifrarCredencialesNotificaciones(
        { host: 'smtp.midominio.com', port: 587, password: 'la-contraseña-real' },
        undefined,
      );
      expect(guardado!.password).toMatch(/^v1:/);
      expect(guardado!.host).toBe('smtp.midominio.com');

      const visto = m.enmascararCredencialesNotificaciones(guardado);
      expect(visto!.password).toBe(m.MARCADOR);
      expect(visto!.host).toBe('smtp.midominio.com');
    });
  });

  it('🔴 reenviar el marcador CONSERVA la contraseña en vez de pisarla', () => {
    // El formulario devuelve lo que recibió. Sin este control, cambiar el host
    // sobreescribía la contraseña real con la cadena "__guardado__" y el SMTP
    // quedaba roto sin que nadie hubiera tocado la contraseña.
    conEntorno({ CREDENTIALS_ENCRYPTION_KEY: CLAVE }, () => {
      const m = importar<typeof import('../crypto/credenciales-notificaciones')>(
        '../crypto/credenciales-notificaciones',
      );
      const previo = m.cifrarCredencialesNotificaciones(
        { host: 'viejo', password: 'la-real' },
        undefined,
      );
      const nuevo = m.cifrarCredencialesNotificaciones(
        { host: 'nuevo', password: m.MARCADOR },
        previo,
      );
      expect(nuevo!.password).toBe(previo!.password);
      expect(nuevo!.host).toBe('nuevo');
      expect(m.descifrarPasswordSmtp(nuevo!.password)).toBe('la-real');
    });
  });

  it('la credencial del reenviador se cifra dentro del JSON, sin cambiar el esquema', () => {
    conEntorno({ CREDENTIALS_ENCRYPTION_KEY: CLAVE }, () => {
      const m = importar<typeof import('../crypto/secretos-cifrados')>(
        '../crypto/secretos-cifrados',
      );
      const cifrado = m.cifrarJson({ token: 'bearer-del-cliente' }, m.CONTEXTO.forwarderAuthCredentials);
      expect(cifrado![m.CLAVE_JSON_CIFRADO]).toMatch(/^v1:/);
      expect(JSON.stringify(cifrado)).not.toContain('bearer-del-cliente');

      const { valor, esLegado } = m.descifrarJson<{ token: string }>(
        cifrado,
        m.CONTEXTO.forwarderAuthCredentials,
      );
      expect(valor).toEqual({ token: 'bearer-del-cliente' });
      expect(esLegado).toBe(false);
    });
  });

  it('el dato en texto plano anterior sigue funcionando, marcado como legado', () => {
    // Convivencia: cifrar sin obligar a una migración previa.
    conEntorno({ CREDENTIALS_ENCRYPTION_KEY: CLAVE }, () => {
      const m = importar<typeof import('../crypto/secretos-cifrados')>(
        '../crypto/secretos-cifrados',
      );
      const { valor, esLegado } = m.descifrarJson<{ token: string }>(
        { token: 'viejo-en-claro' },
        m.CONTEXTO.forwarderAuthCredentials,
      );
      expect(valor).toEqual({ token: 'viejo-en-claro' });
      expect(esLegado).toBe(true);
    });
  });

  it('🔴 la API del reenvío no devuelve la credencial, ni cifrada', () => {
    const t = leerApi('src/forwarding/forwarding.service.ts');
    expect(t).toMatch(/tiene_credencial/);
    expect(t).toMatch(/return filas\.map\(sinCredencial\)/);
  });

  it('la clave de Climatiq se cifra y no sale en la lectura', () => {
    const servicio = leerApi('src/carbon/carbon.service.ts');
    expect(servicio).toMatch(/cifrarSecreto\(data\.climatiq_api_key, CONTEXTO\.climatiqApiKey\)/);
    expect(servicio).toMatch(/tiene_climatiq_api_key/);
    // Y se descifra en el único punto que la consume.
    const proc = leerApi('src/carbon/carbon.processor.ts');
    expect(proc).toMatch(/Bearer \$\{claveClimatiq\}/);
    expect(proc).not.toMatch(/Bearer \$\{settings\.climatiq_api_key\}/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6 · MÍNIMOS DE SEGURIDAD
// ════════════════════════════════════════════════════════════════════════════
describe('Tanda 7 · 6 · lo mínimo antes de un cliente', () => {
  it('🔴 las contraseñas temporales son criptográficamente aleatorias', () => {
    const { generarClaveTemporal } = require('../crypto/clave-temporal');
    const muestras = new Set<string>();
    for (let i = 0; i < 500; i++) muestras.add(generarClaveTemporal());
    expect(muestras.size).toBe(500);
    // 16 bytes en base64url = 22 caracteres, más el sufijo de composición.
    const una = generarClaveTemporal();
    expect(una.length).toBeGreaterThanOrEqual(26);
  });

  it('🔴 nadie genera contraseñas con Math.random()', () => {
    // Era `Temp-${Math.random()...}` en `inviteUser`. V8 usa xorshift128+: de
    // unas pocas salidas se reconstruye el estado y se predice el resto.
    for (const archivo of [
      'src/settings/settings.service.ts',
      'src/admin/admin.service.ts',
      // El generador compartido: es DONDE se generan ahora, así que es el
      // primer lugar donde `Math.random()` podría volver a entrar.
      'src/common/crypto/clave-temporal.ts',
      // El nombre del archivo subido tampoco: `/uploads` se sirve sin
      // autenticación, así que un nombre predecible = fotos legibles.
      'src/app.controller.ts',
    ]) {
      expect(soloCodigo(leerApi(archivo))).not.toMatch(/Math\.random\(\)/);
    }
  });

  it('🔴 las dos rutas de escritura de viajes que faltaban tienen permiso', () => {
    const t = leerApi('src/trips/trips.controller.ts');
    expect(t).toMatch(/@Post\(':id\/logs'\)\s*\n\s*@RequirePermissions\('manage_trips'\)/);
    expect(t).toMatch(
      /@Post\(':id\/driver-contact-response'\)\s*\n\s*@RequirePermissions\('manage_trips'\)/,
    );
  });

  it('ninguna ruta de ESCRITURA de viajes queda sin permiso', () => {
    // Barrido, no lista: una ruta nueva sin permiso tiene que fallar acá.
    const lineas = leerApi('src/trips/trips.controller.ts').split('\n');
    const sinPermiso: string[] = [];
    for (let i = 0; i < lineas.length; i++) {
      if (!/^\s*@(Post|Put|Patch|Delete)\(/.test(lineas[i])) continue;
      const siguientes = lineas.slice(i + 1, i + 3).join('\n');
      if (!/@RequirePermissions\(/.test(siguientes)) sinPermiso.push(lineas[i].trim());
    }
    expect(sinPermiso).toEqual([]);
  });

  it('🔴 el login y el ingest tienen límite de peticiones, ANTES del guard caro', () => {
    const auth = leerApi('src/auth/auth.controller.ts');
    // El orden importa: si el límite fuera después, cada intento bloqueado
    // igual habría ejecutado la consulta y el bcrypt.compare.
    expect(auth).toMatch(/@UseGuards\(LimitePeticionesGuard, LocalAuthGuard\)/);
    expect(auth).toMatch(/@LimitarPeticiones\(\{ nombre: 'login'/);

    const tel = leerApi('src/telemetry/telemetry.controller.ts');
    expect(tel).toMatch(/@UseGuards\(LimitePeticionesGuard, ApiKeyGuard\)/);
    expect(tel).toMatch(/@LimitarPeticiones\(\{ nombre: 'ingest'/);
  });

  it('el límite deja pasar hasta el tope y corta con 429 y Retry-After', () => {
    const { LimitePeticionesGuard } = require('../guards/limite-peticiones.guard');
    const limite = { nombre: 'prueba', intentos: 3, ventanaSegundos: 60 };
    const reflector = { getAllAndOverride: () => limite } as any;
    const guard = new LimitePeticionesGuard(reflector);
    const contexto = {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ ip: '10.0.0.1', headers: {} }) }),
    } as any;

    expect(guard.canActivate(contexto)).toBe(true);
    expect(guard.canActivate(contexto)).toBe(true);
    expect(guard.canActivate(contexto)).toBe(true);

    let capturado: any;
    try {
      guard.canActivate(contexto);
    } catch (e) {
      capturado = e;
    }
    expect(capturado?.getStatus()).toBe(429);
    expect(JSON.stringify(capturado?.getResponse())).toMatch(/Demasiados intentos/);
  });

  it('orígenes distintos no comparten el contador', () => {
    const { LimitePeticionesGuard } = require('../guards/limite-peticiones.guard');
    const reflector = {
      getAllAndOverride: () => ({ nombre: 'p2', intentos: 1, ventanaSegundos: 60 }),
    } as any;
    const guard = new LimitePeticionesGuard(reflector);
    const desde = (ip: string) =>
      ({
        getHandler: () => null,
        getClass: () => null,
        switchToHttp: () => ({ getRequest: () => ({ ip, headers: {} }) }),
      }) as any;

    expect(guard.canActivate(desde('10.0.0.1'))).toBe(true);
    expect(guard.canActivate(desde('10.0.0.2'))).toBe(true);
    expect(() => guard.canActivate(desde('10.0.0.1'))).toThrow();
  });

  it('x-forwarded-for sólo se cree con TRUST_PROXY: si no, cualquiera lo falsifica', () => {
    const { LimitePeticionesGuard } = require('../guards/limite-peticiones.guard');
    const reflector = {
      getAllAndOverride: () => ({ nombre: 'p3', intentos: 1, ventanaSegundos: 60 }),
    } as any;
    const guard = new LimitePeticionesGuard(reflector);
    const conCabecera = (falsa: string) =>
      ({
        getHandler: () => null,
        getClass: () => null,
        switchToHttp: () => ({
          getRequest: () => ({ ip: '10.0.0.9', headers: { 'x-forwarded-for': falsa } }),
        }),
      }) as any;

    delete process.env.TRUST_PROXY;
    expect(guard.canActivate(conCabecera('1.1.1.1'))).toBe(true);
    // Rotar la cabecera NO sirve para saltarse el límite si no confiamos en ella.
    expect(() => guard.canActivate(conCabecera('2.2.2.2'))).toThrow();
  });

  it('🔴 los paquetes que el código nunca importa no están en package.json', () => {
    const pkg = JSON.parse(leerApi('package.json'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const nombre of [
      '@opentelemetry/sdk-node',
      '@nestjs/platform-fastify',
      '@nestjs/bull',
      'bull',
    ]) {
      expect(deps[nombre]).toBeUndefined();
    }
    // Y los que sí se usan siguen estando.
    expect(deps['@nestjs/bullmq']).toBeDefined();
    expect(deps['bullmq']).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7 · EL ARRANQUE FALLA SI FALTA ALGO CRÍTICO
// ════════════════════════════════════════════════════════════════════════════
describe('Tanda 7 · 7 · configuración incompleta impide arrancar', () => {
  type Modulo = typeof import('./verificar-configuracion');

  it('con el entorno mínimo válido, arranca', () => {
    conEntorno(entornoValido(), () => {
      const m = importar<Modulo>('./verificar-configuracion');
      expect(() => m.verificarConfiguracion()).not.toThrow();
    });
  });

  it.each([
    ['JWT_SECRET', /JWT_SECRET/],
    ['CREDENTIALS_ENCRYPTION_KEY', /CREDENTIALS_ENCRYPTION_KEY/],
    ['DATABASE_URL', /DATABASE_URL/],
  ])('🔴 sin %s no arranca, y el mensaje la nombra', (variable, patron) => {
    const env = entornoValido();
    delete env[variable];
    conEntorno(env, () => {
      const m = importar<Modulo>('./verificar-configuracion');
      expect(() => m.verificarConfiguracion()).toThrow(patron);
    });
  });

  it('los problemas se informan TODOS juntos, no de a uno', () => {
    // Descubrirlos de a uno, reiniciando entre cada uno, es su propia forma de
    // castigo.
    conEntorno({}, () => {
      const m = importar<Modulo>('./verificar-configuracion');
      let mensaje = '';
      try {
        m.verificarConfiguracion();
      } catch (e) {
        mensaje = (e as Error).message;
      }
      expect(mensaje).toMatch(/JWT_SECRET/);
      expect(mensaje).toMatch(/CREDENTIALS_ENCRYPTION_KEY/);
      expect(mensaje).toMatch(/DATABASE_URL/);
      expect(mensaje).toMatch(/README_DESPLIEGUE\.md/);
    });
  });

  it('un placeholder del repositorio se rechaza igual que una variable ausente', () => {
    const env = entornoValido();
    env.JWT_SECRET = 'changeme_random_64_chars_secret';
    conEntorno(env, () => {
      const m = importar<Modulo>('./verificar-configuracion');
      expect(() => m.verificarConfiguracion()).toThrow(/placeholder/i);
    });
  });

  it('🔴 en producción, quedarse con los valores de desarrollo es ERROR', () => {
    const env = { ...entornoValido(), NODE_ENV: 'production' };
    conEntorno(env, () => {
      const m = importar<Modulo>('./verificar-configuracion');
      let mensaje = '';
      try {
        m.verificarConfiguracion();
      } catch (e) {
        mensaje = (e as Error).message;
      }
      expect(mensaje).toMatch(/CORS_ORIGIN/);
      expect(mensaje).toMatch(/PUBLIC_API_URL/);
    });
  });

  it('el puerto del pooler es AVISO, no error: cambiarlo a ciegas deja sin sistema', () => {
    const env = entornoValido();
    env.DATABASE_URL = 'postgresql://u:p@host.pooler.supabase.com:5432/postgres?pgbouncer=true';
    conEntorno(env, () => {
      const m = importar<Modulo>('./verificar-configuracion');
      const avisos = m.verificarConfiguracion();
      expect(avisos.join(' ')).toMatch(/6543/);
      expect(avisos.join(' ')).toMatch(/README_DESPLIEGUE/);
    });
  });

  it('el modo de prueba de Resend se avisa antes de descubrirlo con un cliente', () => {
    const env = { ...entornoValido(), RESEND_API_KEY: 're_x', MAIL_FROM: 'a@resend.dev' };
    conEntorno(env, () => {
      const m = importar<Modulo>('./verificar-configuracion');
      expect(m.verificarConfiguracion().join(' ')).toMatch(/dominio de prueba/i);
    });
  });

  it('main.ts usa la verificación completa, no sólo los secretos de JWT', () => {
    const t = leerApi('src/main.ts');
    expect(t).toMatch(/verificarConfiguracion\(\)/);
    expect(t).toMatch(/origenesPermitidos\(\)/);
    expect(t).not.toMatch(/origin: \['http:\/\/localhost:5173'/);
  });

  it('🔴 existe el chequeo de salud y la base lo puede tumbar', () => {
    const t = leerApi('src/health/health.controller.ts');
    expect(t).toMatch(/@Get\('vivo'\)/);
    expect(t).toMatch(/ServiceUnavailableException/);
    // Redis NO lo tumba: es opcional y sacar de rotación una instancia sana
    // por eso sería peor que el problema.
    expect(t).toMatch(/estado = base\.ok \? \(redis\.ok === false \? 'degradado' : 'ok'\) : 'caido'/);
    // ⚠️ NO alcanza con buscar el nombre en el archivo: el `import` lo contiene
    // y el módulo puede estar importado sin estar REGISTRADO. Ya pasó en la
    // Tanda 4 con `PermissionsGuard`. Se busca dentro del array `imports`.
    const modulo = leerApi('src/app.module.ts');
    const bloqueImports = modulo.slice(modulo.indexOf('imports: ['), modulo.indexOf('controllers:'));
    expect(bloqueImports).toMatch(/^\s*HealthModule,\s*$/m);
  });

  it('🔴 el diagnóstico de /health sobrevive al filtro global de excepciones', () => {
    // Encontrado ARRANCANDO EL BINARIO, no leyendo el código: con la base
    // caída, `GET /health` devolvía el 503 correcto pero con el cuerpo
    // genérico del filtro ("Service Unavailable Exception"). O sea que el
    // diagnóstico se perdía exactamente cuando hace falta.
    const filtro = leerApi('src/common/filters/excepciones.filter.ts');
    expect(filtro).toMatch(/esCuerpoPropio/);
    expect(filtro).toMatch(/\.\.\.cuerpoPropio/);
  });

  it('el filtro distingue el cuerpo propio del genérico de Nest', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { FiltroDeExcepciones } = require('../filters/excepciones.filter');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ServiceUnavailableException, NotFoundException } = require('@nestjs/common');

    const enviados: any[] = [];
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({
          status: () => ({ json: (c: any) => enviados.push(c) }),
        }),
        getRequest: () => ({ method: 'GET', url: '/health', headers: {} }),
      }),
    } as any;

    const filtro = new FiltroDeExcepciones();
    (filtro as any).logger = { warn: jest.fn(), error: jest.fn() };

    // Cuerpo propio: se conserva entero.
    filtro.catch(
      new ServiceUnavailableException({ estado: 'caido', base_de_datos: { ok: false, ms: 3 } }),
      host,
    );
    expect(enviados[0]).toMatchObject({
      statusCode: 503,
      estado: 'caido',
      base_de_datos: { ok: false, ms: 3 },
    });

    // Cuerpo genérico de Nest: se aplana como siempre, con `path` y `timestamp`.
    filtro.catch(new NotFoundException('Vehículo no encontrado'), host);
    expect(enviados[1]).toMatchObject({ statusCode: 404, message: 'Vehículo no encontrado' });
    expect(enviados[1].path).toBe('/health');
    expect(enviados[1].timestamp).toEqual(expect.any(String));
  });

  it('🔴 el README de despliegue existe y documenta cada variable', () => {
    const ruta = join(API, '..', '..', 'README_DESPLIEGUE.md');
    expect(existsSync(ruta)).toBe(true);
    const t = readFileSync(ruta, 'utf-8');
    for (const variable of [
      'DATABASE_URL',
      'DIRECT_URL',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'CREDENTIALS_ENCRYPTION_KEY',
      'CORS_ORIGIN',
      'PUBLIC_API_URL',
      'VITE_API_URL',
      'RESEND_API_KEY',
      'MAIL_FROM',
      'REDIS_URL',
      'REDIS_TOKEN',
      'TRUST_PROXY',
    ]) {
      expect(t).toContain(variable);
    }
  });
});
