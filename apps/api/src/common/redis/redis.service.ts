import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

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

    let connectionUrl = configurado;

    // Upstash entrega una URL https://; ioredis necesita rediss://
    if (connectionUrl.startsWith('https://')) {
      const url = new URL(connectionUrl);
      const host = url.host;
      const password = process.env.REDIS_TOKEN || '';
      connectionUrl = `rediss://default:${password}@${host}:6379`;
    }

    this.client = new Redis(connectionUrl, {
      maxRetriesPerRequest: null,
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
