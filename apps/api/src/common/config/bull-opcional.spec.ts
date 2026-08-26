import { getQueueToken } from '@nestjs/bullmq';
import {
  colasOpcionales,
  proveedoresColasInertes,
  soloConRedis,
} from './bull-opcional';

/**
 * Estas funciones deciden en tiempo de import si BullMQ existe o no en la
 * aplicación. El test cubre las dos ramas manipulando REDIS_URL, y la
 * superficie de la cola inerte (los métodos que el código realmente usa).
 * No se instancia ninguna conexión: registerQueue solo construye el módulo
 * dinámico; las conexiones nacerían recién al resolver la inyección.
 */
describe('bull-opcional', () => {
  const redisUrlOriginal = process.env.REDIS_URL;

  afterEach(() => {
    if (redisUrlOriginal === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = redisUrlOriginal;
    }
  });

  describe('sin REDIS_URL', () => {
    beforeEach(() => {
      delete process.env.REDIS_URL;
    });

    it('no registra ningún módulo de cola', () => {
      expect(colasOpcionales('carbon', 'forwarding.send')).toEqual([]);
    });

    it('no incluye los procesadores', () => {
      class ProcesadorFalso {}
      expect(soloConRedis(ProcesadorFalso)).toEqual([]);
    });

    it('provee una cola inerte por cada token de @InjectQueue', () => {
      const providers = proveedoresColasInertes('carbon', 'simulator.route');
      expect(providers).toHaveLength(2);
      expect(providers.map((p: any) => p.provide)).toEqual([
        getQueueToken('carbon'),
        getQueueToken('simulator.route'),
      ]);
    });

    it('la cola inerte cubre la superficie usada en el código sin romper', async () => {
      const [provider] = proveedoresColasInertes('carbon') as any[];
      const cola = provider.useValue;

      await expect(cola.add('trabajo', {})).resolves.toBeNull();
      await expect(cola.getActive()).resolves.toEqual([]);
      await expect(cola.getWaiting()).resolves.toEqual([]);
      await expect(cola.getDelayed()).resolves.toEqual([]);
      await expect(cola.getJob('id')).resolves.toBeNull();
      await expect(cola.close()).resolves.toBeUndefined();
    });
  });

  describe('con REDIS_URL', () => {
    beforeEach(() => {
      process.env.REDIS_URL = 'redis://ejemplo:6379';
    });

    it('registra las colas reales y no inyecta inertes', () => {
      expect(colasOpcionales('carbon')).toHaveLength(1);
      expect(proveedoresColasInertes('carbon')).toEqual([]);
    });

    it('incluye los procesadores', () => {
      class ProcesadorFalso {}
      expect(soloConRedis(ProcesadorFalso)).toEqual([ProcesadorFalso]);
    });
  });

  it('una REDIS_URL en blanco cuenta como ausente', () => {
    process.env.REDIS_URL = '   ';
    expect(colasOpcionales('carbon')).toEqual([]);
    expect(proveedoresColasInertes('carbon')).toHaveLength(1);
  });
});
