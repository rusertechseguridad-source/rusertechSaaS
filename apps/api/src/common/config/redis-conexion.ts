/**
 * CONEXIÓN DE BULLMQ — mismo criterio que RedisService.
 *
 * Sin `REDIS_URL`, la aplicación tiene que arrancar y trabajar en silencio:
 * el motor de eventos ya no depende de Redis (usa la cola en Postgres), y las
 * colas de BullMQ quedan como piezas opcionales.
 *
 * Historia del ruido, porque explica el diseño actual:
 *  1. La falta de la variable caía a `redis://localhost:6379` y BullMQ
 *     reintentaba para siempre (ECONNREFUSED cada pocos segundos).
 *  2. Se probó una conexión centinela (127.0.0.1:1) con `retryStrategy: null`.
 *     No alcanzó: BullMQ abre varias conexiones por cola (cliente, suscriptor,
 *     bclient) y no todas heredan esa configuración; el evento `error` sin
 *     manejador además se propaga como excepción no capturada.
 *  3. Solución vigente: sin `REDIS_URL` las colas NO SE REGISTRAN — ver
 *     common/config/bull-opcional.ts. Cero conexiones, cero ruido.
 *
 * Con eso, `conexionBull()` solo se evalúa cuando hay Redis de verdad. La
 * rama centinela se conserva como defensa: si alguien vuelve a registrar
 * BullModule sin condicionar, el fallo será un intento único y no un loop.
 */
export function redisDisponible(): boolean {
  return Boolean(process.env.REDIS_URL && process.env.REDIS_URL.trim() !== '');
}

/**
 * ESQUEMAS QUE `ioredis` ENTIENDE.
 *
 * Upstash muestra en su panel DOS direcciones y son cosas distintas:
 *   · `https://<algo>.upstash.io`  → API REST. Se habla con `fetch` y un token.
 *   · `rediss://default:<token>@<algo>.upstash.io:6379` → protocolo Redis.
 * `ioredis` y BullMQ hablan lo segundo. Copiar la primera es un error fácil de
 * cometer y hasta ahora no lo decía nadie.
 */
const ESQUEMAS_VALIDOS = ['redis://', 'rediss://'];

/**
 * Convierte una URL de API REST de Upstash al esquema del protocolo Redis.
 *
 * Vivía duplicada en `redis-conexion` y en `RedisService`, con el mismo puerto
 * escrito dos veces. Ahora es una sola.
 *
 * Devuelve `null` si no se puede convertir — que es distinto de "convertida a
 * algo que no anda", y por eso quien llama tiene que decidir qué hacer.
 */
export function normalizarUrlRedis(crudo: string): string | null {
  const url = crudo.trim();
  if (ESQUEMAS_VALIDOS.some((e) => url.startsWith(e))) return url;

  if (url.startsWith('https://')) {
    const token = process.env.REDIS_TOKEN?.trim();
    // Sin token la conversión produce `rediss://default:@host:6379`, que se
    // conecta y falla la autenticación en cada comando. Es peor que no
    // convertir: parece configurado.
    if (!token) return null;
    try {
      return `rediss://default:${token}@${new URL(url).host}:6379`;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Problemas de la configuración de Redis, para el chequeo de arranque.
 *
 * ⚠️ POR QUÉ ES UN ERROR Y NO UN AVISO cuando la URL está mal formada.
 *
 * Redis es OPCIONAL: sin `REDIS_URL` la aplicación arranca y opera (las
 * posiciones en vivo salen de Postgres). Pero una `REDIS_URL` PRESENTE Y MAL
 * es otra cosa: el código de abajo la toma por buena, abre el cliente, y cada
 * comando queda encolado esperando una conexión que nunca llega. El pedido
 * HTTP que lo disparó no termina nunca, y mientras tanto retiene su conexión
 * de Prisma. Con suficientes pedidos así, el pool se agota y la API deja de
 * responder entera — medido en producción, sin un solo mensaje que lo
 * explicara.
 *
 * "Configurada mal" es peor que "no configurada". Por eso frena el arranque.
 */
export function problemasDeRedis(): { errores: string[]; avisos: string[] } {
  const crudo = process.env.REDIS_URL?.trim();

  if (!crudo) {
    return {
      errores: [],
      avisos: [
        'REDIS_URL no está definida: Redis queda deshabilitado. La aplicación ' +
          'funciona (las posiciones en vivo salen de Postgres), pero quedan sin ' +
          'servicio las colas de BullMQ: huella de carbono, reenvío de posiciones ' +
          'y el simulador de rutas.',
      ],
    };
  }

  if (normalizarUrlRedis(crudo) !== null) return { errores: [], avisos: [] };

  if (crudo.startsWith('https://')) {
    return {
      errores: [
        'REDIS_URL es la dirección de la API REST de Upstash (https://…) y falta ' +
          'REDIS_TOKEN para poder convertirla. Sin el token, el cliente se conecta ' +
          'y falla la autenticación en cada comando, que es exactamente el caso ' +
          'que cuelga la aplicación. Poné REDIS_TOKEN, o usá directamente la URL ' +
          'rediss:// que Upstash muestra en su panel.',
      ],
      avisos: [],
    };
  }

  return {
    errores: [
      `REDIS_URL tiene un esquema que ioredis no entiende: "${crudo.slice(0, 24)}…". ` +
        'Se espera redis:// o rediss:// (o https:// de Upstash junto con REDIS_TOKEN). ' +
        'Dejarla vacía es una opción válida: Redis es opcional.',
    ],
    avisos: [],
  };
}

/** Opciones de conexión para BullModule.forRoot. */
export function conexionBull(): Record<string, unknown> {
  if (!redisDisponible()) {
    // Rama defensiva: hoy es inalcanzable (el forRoot está condicionado por
    // soloConRedis), pero si esa condición se pierde en un refactor, esto
    // limita el daño a UN intento fallido en vez de reintentos infinitos.
    return {
      // Puerto 1 de loopback: falla inmediato y sin DNS. No es un host mágico;
      // es la forma de que el único intento muera rápido.
      host: '127.0.0.1',
      port: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: null,
      retryStrategy: () => null,        // un intento; sin reintentos, sin spam
      reconnectOnError: () => false,
    };
  }

  // La conversión vive en `normalizarUrlRedis`, en un solo lugar. Si devuelve
  // null la configuración está mal, pero acá no se puede hacer nada útil con
  // eso: el arranque ya la rechazó (`problemasDeRedis`). Se cae a la rama
  // centinela para que el fallo sea rápido en vez de infinito.
  const url = normalizarUrlRedis(process.env.REDIS_URL as string);
  if (url === null) {
    return {
      host: '127.0.0.1',
      port: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: null,
      retryStrategy: () => null,
      reconnectOnError: () => false,
    };
  }

  // ⚠️ `maxRetriesPerRequest: null` = reintentar para siempre. Para un WORKER
  // de BullMQ es lo correcto: si Redis vuelve, el trabajo sigue; nadie está
  // esperando del otro lado. Es en el camino de un pedido HTTP donde esa misma
  // opción cuelga la aplicación — ver `RedisService`, que usa lo contrario.
  return { url, maxRetriesPerRequest: null };
}
