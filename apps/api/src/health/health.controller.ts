import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { umbralesSalud } from '../common/config/umbrales-salud';

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
 * **TRES estados, no dos.** Ésta es la corrección de la Tanda 7 bis y el
 * porqué está en `common/config/umbrales-salud.ts`, con la medición que la
 * produjo. En resumen: la versión anterior tenía un tope de 3 s escrito a mano
 * y declaraba `caido` todo lo que lo pasara. Contra la base real —remota, con
 * el pooler en el medio— eso daba un falso negativo con la base funcionando.
 *
 *     ok         respondió rápido                              HTTP 200
 *     degradado  respondió, pero tarde · o Redis caído          HTTP 200
 *     caido      no respondió antes del tope                    HTTP 503
 *
 * **Sólo `caido` saca la instancia de rotación.** Una base lenta sigue
 * sirviendo, y sacar instancias por lentitud concentra el mismo tráfico en
 * menos procesos contra la misma base lenta: empeora exactamente lo que quiere
 * arreglar.
 *
 * **Redis nunca lo tumba.** Es opcional a propósito (las posiciones en vivo
 * salen de Postgres). Si está caído, la instancia sigue siendo útil.
 *
 * **La base sí lo tumba, pero sólo si NO RESPONDE.** Sin Postgres esta
 * instancia no puede responder nada, y sacarla de rotación es lo correcto.
 *
 * `GET /health/vivo` es aparte: dice si el PROCESO está vivo, sin tocar la
 * base. Es lo que va en un `livenessProbe`, donde consultar dependencias
 * externas provoca reinicios en cadena cuando la base tiene un mal minuto.
 */

/** Lo que se sabe de una dependencia después de consultarla. */
interface EstadoDependencia {
  /** `true` respondió · `false` no respondió · `null` no está configurada. */
  ok: boolean | null;
  /** Cuánto tardó. `null` si no se la consultó. */
  ms: number | null;
  /** Respondió, pero por encima del umbral de lentitud. */
  lenta?: boolean;
  detalle?: string;
}

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
    const umbrales = umbralesSalud();

    const base = await this.medir(() => this.prisma.$queryRaw`SELECT 1`);

    const redis: EstadoDependencia = this.redis.isConfigured()
      ? await this.medir(() => this.redis.getClient().ping())
      : { ok: null, ms: null, detalle: 'no configurado' };

    // ⚠️ El orden de las preguntas ES la corrección.
    //
    // Primero: ¿respondió la base? Si no, `caido` — es lo único que justifica
    // sacar la instancia de rotación.
    // Después: ¿algo anda mal pero sirve? `degradado`, y sigue en rotación.
    //
    // Antes esto era `base.ok ? … : 'caido'` con `base.ok` puesto en false por
    // el mero paso del tiempo, así que "lenta" y "caída" eran indistinguibles.
    let estado: 'ok' | 'degradado' | 'caido';
    if (base.ok === false) estado = 'caido';
    else if (base.lenta || redis.ok === false) estado = 'degradado';
    else estado = 'ok';

    const cuerpo = {
      estado,
      base_de_datos: base,
      redis,
      // Los umbrales viajan en la respuesta: sin ellos, un `ms: 1400` no dice
      // si es normal o no, y quien mira el chequeo tendría que ir al `.env`
      // del servidor para interpretarlo.
      umbrales_ms: umbrales,
      // Sirve para distinguir una instancia recién reiniciada de una vieja
      // cuando hay varias detrás del balanceador.
      tiempo_encendido_s: Math.round(process.uptime()),
    };

    // El código HTTP es lo que mira el balanceador; el cuerpo, la persona.
    // 503 y no 500: "no puedo atender ahora", que es lo que significa.
    if (estado === 'caido') throw new ServiceUnavailableException(cuerpo);

    return cuerpo;
  }

  /**
   * Consulta una dependencia con un tope de tiempo y clasifica el resultado.
   *
   * El tope sigue siendo necesario: sin él, una base que acepta la conexión
   * pero no responde deja el chequeo colgado y el balanceador lo interpreta
   * como timeout genérico, sin distinguir qué pieza falló. Lo que cambió es
   * que el tope ya no es lo mismo que "está caída": entre responder rápido y
   * no responder hay un tercer caso, y es el que se estaba perdiendo.
   *
   * ⚠️ El `setTimeout` se cancela SIEMPRE. Sin el `clearTimeout`, cada llamada
   * dejaba un temporizador de 10 s vivo; con una sonda cada 5 s son dos
   * temporizadores permanentes por dependencia, y en Node un timer pendiente
   * también retrasa el cierre limpio del proceso.
   */
  private async medir(fn: () => Promise<unknown>): Promise<EstadoDependencia> {
    const { timeoutMs, degradadoMs } = umbralesSalud();
    const inicio = Date.now();
    let temporizador: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        fn(),
        new Promise((_, rechazar) => {
          temporizador = setTimeout(
            () => rechazar(new Error(`sin respuesta en ${Math.round(timeoutMs / 1000)} s`)),
            timeoutMs,
          );
        }),
      ]);

      const ms = Date.now() - inicio;
      if (ms <= degradadoMs) return { ok: true, ms, lenta: false };

      return {
        ok: true,
        ms,
        lenta: true,
        // El detalle dice el número Y el umbral contra el que se lo comparó:
        // "tardó 1400 ms" a secas obliga a adivinar si eso está bien.
        detalle:
          `respondió en ${ms} ms, por encima del umbral de ${degradadoMs} ms ` +
          '(HEALTH_DEGRADADO_MS). La instancia sigue sirviendo.',
      };
    } catch (error) {
      // El mensaje se acorta: esta ruta es pública y un error crudo de Prisma
      // puede traer la cadena de conexión.
      const detalle = (error as Error).message.slice(0, 120);
      return { ok: false, ms: Date.now() - inicio, detalle };
    } finally {
      if (temporizador) clearTimeout(temporizador);
    }
  }
}
