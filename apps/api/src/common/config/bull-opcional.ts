import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { DynamicModule, Logger, Provider } from '@nestjs/common';
import { redisDisponible } from './redis-conexion';

/**
 * REGISTRO OPCIONAL DE COLAS BULLMQ.
 *
 * El intento anterior (conexión centinela 127.0.0.1:1 + `retryStrategy: null`)
 * no alcanzó: BullMQ abre VARIAS conexiones por cola (cliente, suscriptor,
 * bclient) y no todas heredan la configuración de reintentos; además el evento
 * `error` sin manejador se propaga como excepción no capturada. Resultado:
 * ECONNREFUSED cada pocos segundos aunque nadie usara las colas.
 *
 * Solución de fondo: **sin `REDIS_URL`, las colas directamente no se
 * instancian.** Si nada las va a usar, no hace falta crearlas.
 *
 *  · `colasOpcionales(...)` reemplaza a `BullModule.registerQueue(...)` en los
 *    `imports` de cada módulo: con Redis devuelve el registro real; sin Redis
 *    devuelve `[]` y ninguna Queue (ni sus tres conexiones) llega a existir.
 *  · `proveedoresColasInertes(...)` cubre la inyección de dependencias: los
 *    servicios declaran `@InjectQueue('...')` en el constructor, y Nest exige
 *    que ese token exista. Sin Redis se inyecta una cola inerte que satisface
 *    la firma usada en el código (add / getters) sin abrir conexión alguna.
 *  · `soloConRedis(...)` condiciona los `@Processor`: cada procesador registrado
 *    crea un Worker con conexiones propias, así que sin Redis no se registran.
 *
 * Los guardas `redisDisponible()` que ya existen en los productores siguen
 * vigentes: son la primera línea (y la que explica al usuario por qué no se
 * encola). La cola inerte es la red de seguridad por si un camino nuevo olvida
 * el guarda — avisa UNA sola vez y no hace nada, en lugar de reventar.
 *
 * ⚠️ Estas funciones se evalúan al importar los módulos (los decoradores de
 * Nest corren en tiempo de import, antes de que `ConfigModule` cargue el
 * `.env`). Por eso `main.ts` precarga dotenv en su primera línea: garantiza
 * que `REDIS_URL` ya esté en `process.env` cuando se toma esta decisión.
 */

/**
 * Con Redis: el `BullModule.registerQueue` real. Sin Redis: nada que importar.
 * Se usa con spread: `imports: [...colasOpcionales('carbon')]`.
 */
export function colasOpcionales(...nombres: string[]): DynamicModule[] {
  if (!redisDisponible()) return [];
  return [BullModule.registerQueue(...nombres.map((name) => ({ name })))];
}

/**
 * Con Redis: nada (el token lo aporta el registro real). Sin Redis: un provider
 * por cola con el mismo token que usaría `@InjectQueue`, apuntando a una cola
 * inerte. Se usa con spread en `providers`.
 */
export function proveedoresColasInertes(...nombres: string[]): Provider[] {
  if (redisDisponible()) return [];
  return nombres.map((nombre) => ({
    provide: getQueueToken(nombre),
    useValue: crearColaInerte(nombre),
  }));
}

/**
 * Incluye los elementos solo cuando hay Redis. Dos usos:
 *  · los `@Processor` en providers: `[MiService, ...soloConRedis(MiProcessor)]`
 *  · el `BullModule.forRoot(...)` en los imports del AppModule.
 */
export function soloConRedis<T>(...elementos: T[]): T[] {
  return redisDisponible() ? elementos : [];
}

/**
 * Cola que satisface la superficie usada en el código sin tocar la red.
 * Cubre exactamente los métodos que los servicios invocan hoy: `add`,
 * `getActive`, `getWaiting`, `getDelayed`, `getJob` (más `close` por higiene).
 * Si mañana alguien usa otro método sin guarda, el error será explícito
 * ("no es una función") y este comentario le dirá dónde agregarlo.
 */
function crearColaInerte(nombre: string) {
  const logger = new Logger('ColaInerte');
  let avisado = false;
  const avisarUnaVez = () => {
    if (avisado) return;
    avisado = true;
    logger.warn(
      `Se intentó encolar en '${nombre}' sin REDIS_URL: el trabajo se descarta. ` +
        'Este productor debería consultar redisDisponible() antes de encolar. Única línea al respecto.',
    );
  };
  return {
    name: nombre,
    add: async (..._args: unknown[]) => {
      avisarUnaVez();
      return null;
    },
    addBulk: async (..._args: unknown[]) => {
      avisarUnaVez();
      return [];
    },
    getActive: async () => [],
    getWaiting: async () => [],
    getDelayed: async () => [],
    getJob: async () => null,
    close: async () => undefined,
  };
}
