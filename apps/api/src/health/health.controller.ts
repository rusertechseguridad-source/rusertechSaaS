import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

/**
 * CHEQUEO DE SALUD.
 *
 * Para qué sirve de verdad: el balanceador o el orquestador (Railway, Render,
 * Fly, un nginx con `upstream`) necesita una URL que diga si esta instancia
 * puede atender. Sin ella, una instancia con la base caída sigue recibiendo
 * tráfico y devolviendo 500 hasta que alguien mira los logs.
 *
 * ── Decisiones ────────────────────────────────────────────────────────────
 *
 * **Sin autenticación, y sin filtrar nada.** Quien chequea salud es una
 * máquina que no tiene credenciales. Por eso la respuesta no incluye versiones,
 * cadenas de conexión ni mensajes de error crudos de la base: sólo si cada
 * pieza responde y cuánto tardó. Un atacante que la consulte aprende que la
 * aplicación existe, que ya sabía.
 *
 * **Redis NO tumba el chequeo.** Es opcional a propósito (las posiciones en
 * vivo salen de Postgres). Si Redis está caído, la instancia sigue siendo
 * útil: se informa `degradado`, con qué queda sin servicio, y se responde 200.
 * Un 503 acá haría que el balanceador sacara de rotación una instancia sana.
 *
 * **La base SÍ lo tumba.** Sin Postgres esta instancia no puede responder
 * nada, y sacarla de rotación es exactamente lo correcto.
 *
 * `GET /health/vivo` es aparte: dice si el PROCESO está vivo, sin tocar la
 * base. Es lo que va en un `livenessProbe`, donde consultar dependencias
 * externas provoca reinicios en cadena cuando la base tiene un mal minuto.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** ¿El proceso está vivo? No toca dependencias. Para `livenessProbe`. */
  @Get('vivo')
  vivo() {
    return { estado: 'vivo', tiempo_encendido_s: Math.round(process.uptime()) };
  }

  /** ¿Puede atender? Toca base y Redis. Para `readinessProbe`. */
  @Get()
  async salud() {
    const base = await this.medir(() => this.prisma.$queryRaw`SELECT 1`);

    const redis = this.redis.isConfigured()
      ? await this.medir(() => this.redis.getClient().ping())
      : { ok: null as boolean | null, ms: null as number | null, detalle: 'no configurado' };

    // El estado global depende SÓLO de la base, por lo dicho arriba.
    const estado = base.ok ? (redis.ok === false ? 'degradado' : 'ok') : 'caido';

    const cuerpo = {
      estado,
      base_de_datos: base,
      redis,
      // Sirve para distinguir una instancia recién reiniciada de una vieja
      // cuando hay varias detrás del balanceador.
      tiempo_encendido_s: Math.round(process.uptime()),
    };

    // El código HTTP es lo que mira el balanceador; el cuerpo, la persona.
    // 503 y no 500: "no puedo atender ahora", que es lo que significa, y es lo
    // que hace que la instancia salga de rotación en vez de quedar recibiendo
    // tráfico que va a fallar.
    if (!base.ok) throw new ServiceUnavailableException(cuerpo);

    return cuerpo;
  }

  /**
   * Corre la comprobación con un tope de tiempo y devuelve si respondió.
   *
   * El tope es la mitad del chequeo: sin él, una base que acepta la conexión
   * pero no responde deja el chequeo colgado y el balanceador lo interpreta
   * como timeout genérico, sin distinguir qué pieza falló.
   */
  private async medir(
    fn: () => Promise<unknown>,
  ): Promise<{ ok: boolean; ms: number | null; detalle?: string }> {
    const inicio = Date.now();
    try {
      await Promise.race([
        fn(),
        new Promise((_, rechazar) =>
          setTimeout(() => rechazar(new Error('sin respuesta en 3 s')), 3000),
        ),
      ]);
      return { ok: true, ms: Date.now() - inicio };
    } catch (error) {
      // El mensaje se acorta: esta ruta es pública y un error crudo de Prisma
      // puede traer la cadena de conexión.
      const detalle = (error as Error).message.slice(0, 120);
      return { ok: false, ms: Date.now() - inicio, detalle };
    }
  }
}
