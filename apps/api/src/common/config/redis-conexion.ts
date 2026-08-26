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

  let url = process.env.REDIS_URL as string;
  if (url.startsWith('https://')) {
    // Upstash entrega la URL https; BullMQ necesita el esquema rediss.
    const parsed = new URL(url);
    const password = process.env.REDIS_TOKEN || '';
    url = `rediss://default:${password}@${parsed.host}:6379`;
  }
  return { url, maxRetriesPerRequest: null };
}
