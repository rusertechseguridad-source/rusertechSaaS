import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { normalizarUrlRedis } from '../config/redis-conexion';

/**
 * Acceso a Redis.
 *
 * Cambio respecto de la versión anterior: **si `REDIS_URL` no está definida, no
 * se crea ninguna conexión.** Antes se caía a `redis://localhost:6379` y el
 * cliente reintentaba indefinidamente, llenando los logs de `ENOTFOUND` /
 * `ECONNREFUSED` aunque nada del flujo en uso necesitara Redis. Eso ya pasó en
 * producción cuando la instancia de Upstash fue eliminada.
 *
 * Con Postgres como fuente de verdad de las posiciones en vivo, Redis pasó a
 * ser opcional: la aplicación tiene que poder arrancar y operar sin él.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  onModuleInit() {
    const configurado = process.env.REDIS_URL?.trim();

    if (!configurado) {
      this.logger.log(
        'REDIS_URL no está definida: Redis queda deshabilitado. ' +
          'Las posiciones en vivo se sirven desde Postgres (ver LIVE_POSITIONS_SOURCE). ' +
          'Las funciones que sí dependen de Redis (colas, deduplicación de ingest, ' +
          'caché de geocodificación) fallarán de forma explícita si se usan.',
      );
      return;
    }

    // La conversión https:// → rediss:// vive en `normalizarUrlRedis`, junto
    // con la de BullMQ. Estaban duplicadas, con el puerto escrito dos veces.
    const connectionUrl = normalizarUrlRedis(configurado);

    if (connectionUrl === null) {
      // El arranque ya rechaza este caso (`problemasDeRedis`). Esto es la red
      // de seguridad por si alguien llama al servicio fuera de ese camino: se
      // deja Redis apagado en vez de abrir un cliente que no puede funcionar.
      this.logger.error(
        'REDIS_URL tiene un formato que ioredis no entiende y no se pudo ' +
          'convertir. Redis queda deshabilitado en vez de abrir una conexión ' +
          'que encolaría comandos para siempre.',
      );
      return;
    }

    this.client = new Redis(connectionUrl, {
      // ⚠️ ACÁ ESTABA EL CUELGUE, y no en el esquema de la URL.
      //
      // Antes: `maxRetriesPerRequest: null` (reintentar sin límite) más el
      // `enableOfflineQueue` que viene activado por defecto. Con Redis
      // inalcanzable, cada comando quedaba encolado esperando una conexión que
      // no llegaba: la promesa nunca resolvía, el pedido HTTP que la disparó
      // nunca terminaba, y su conexión de Prisma quedaba retenida. Con
      // suficientes pedidos así el pool se agota y la API deja de responder
      // ENTERA — incluidas las rutas que no tocan Redis.
      //
      // Ahora falla rápido y ruidoso. Un flujo que necesita Redis devuelve un
      // error en segundos; los que no lo necesitan siguen andando.
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      connectTimeout: 5000,
      enableReadyCheck: false,
      tls: connectionUrl.startsWith('rediss://') ? {} : undefined,
    });

    // Sin este handler, un error de conexión se propaga como excepción no
    // capturada del proceso.
    this.client.on('error', (err) => {
      this.logger.warn(`Error de conexión con Redis: ${err.message}`);
    });
  }

  onModuleDestroy() {
    this.client?.quit();
  }

  /** Indica si Redis está configurado y disponible para usarse. */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Cliente de Redis. Lanza si no está configurado, en lugar de devolver un
   * cliente que reintenta contra localhost para siempre: quien lo llame se
   * entera del problema de inmediato y con un mensaje claro.
   *
   * Antes de llamarlo desde un camino que deba tolerar la ausencia de Redis,
   * consultar `isConfigured()`.
   */
  getClient(): Redis {
    if (!this.client) {
      throw new Error(
        'Redis no está configurado (falta REDIS_URL) y este flujo lo requiere. ' +
          'Definí REDIS_URL o usá el camino que no depende de Redis.',
      );
    }
    return this.client;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await this.getClient().set(key, data, 'EX', ttlSeconds);
    } else {
      await this.getClient().set(key, data);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.getClient().get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as any;
    }
  }

  async del(key: string): Promise<void> {
    await this.getClient().del(key);
  }
}
