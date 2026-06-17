import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  onModuleInit() {
    let connectionUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    // Si es Upstash (https://...), convertimos a rediss://
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
  }

  onModuleDestroy() {
    this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.set(key, data, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, data);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as any;
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
