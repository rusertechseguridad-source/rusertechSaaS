import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * LÍMITE DE PETICIONES POR ORIGEN.
 *
 * Qué protege: el login (fuerza bruta contra contraseñas) y el ingest de
 * telemetría (una integración en bucle que hunde la base).
 *
 * ── POR QUÉ ESCRITO A MANO Y NO `@nestjs/throttler` ────────────────────────
 *
 * Es una decisión, no pereza, y tiene contrapartida:
 *
 *  + Cero dependencias nuevas. Esta misma tanda saca dos paquetes que nunca se
 *    importaban porque aportaban 28 de las 49 vulnerabilidades del árbol.
 *    Agregar uno en el mismo movimiento pide una justificación que acá no hay:
 *    lo que hace falta son ~70 líneas.
 *  + Se puede probar de verdad, sin levantar Nest entero.
 *
 *  − ⚠️ EL ESTADO ES POR PROCESO. Con varias instancias detrás de un
 *    balanceador, cada una lleva su propia cuenta: el límite efectivo se
 *    multiplica por la cantidad de réplicas. Para una sola instancia —que es
 *    el escenario del primer cliente— es exacto. Cuando haya varias, esto se
 *    reemplaza por un contador en Redis, y está anotado en README_DESPLIEGUE.
 *    Un límite aproximado es muchísimo mejor que ninguno; lo que no se puede
 *    es creer que es exacto cuando no lo es.
 *
 * ── DE QUÉ SE ACUERDA ─────────────────────────────────────────────────────
 *
 * Ventana deslizante por clave: se guardan las marcas de tiempo de los
 * intentos dentro de la ventana y se cuentan. Es más justo que un contador que
 * se reinicia de golpe (con ése, alguien manda el doble del límite a caballo
 * del reinicio).
 *
 * El mapa se poda en cada consulta y además tiene un tope duro de claves: sin
 * eso, un atacante que rota la IP de origen convierte la protección en una
 * fuga de memoria, que es un final peor que el ataque.
 */

/** Configuración de un límite. */
export interface Limite {
  /** Cuántas peticiones se permiten dentro de la ventana. */
  intentos: number;
  /** Tamaño de la ventana, en segundos. */
  ventanaSegundos: number;
  /** Nombre para el log y para separar los contadores entre rutas. */
  nombre: string;
}

export const CLAVE_LIMITE = 'limite_peticiones';

/** Marca una ruta (o un controller entero) con su límite. */
export const LimitarPeticiones = (limite: Limite) => SetMetadata(CLAVE_LIMITE, limite);

/**
 * Tope de claves distintas en memoria.
 *
 * 20.000 entradas de unos pocos números son del orden de unos pocos MB. Al
 * llegar al tope se descarta la mitad más vieja: se pierde precisión bajo
 * ataque distribuido, pero el proceso no se cae, que es lo que importa.
 */
const MAXIMO_CLAVES = 20_000;

@Injectable()
export class LimitePeticionesGuard implements CanActivate {
  private readonly logger = new Logger(LimitePeticionesGuard.name);

  /** clave → marcas de tiempo (ms) de los intentos dentro de la ventana. */
  private readonly intentos = new Map<string, number[]>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const limite = this.reflector.getAllAndOverride<Limite | undefined>(CLAVE_LIMITE, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);

    // Sin decorador no hay límite: este guard es opt-in por ruta.
    if (!limite) return true;

    const peticion = contexto.switchToHttp().getRequest();
    const clave = `${limite.nombre}:${this.origen(peticion)}`;
    const ahora = Date.now();
    const desde = ahora - limite.ventanaSegundos * 1000;

    const previos = (this.intentos.get(clave) ?? []).filter((t) => t > desde);

    if (previos.length >= limite.intentos) {
      // Se registra el intento igual: si no, alguien que sigue golpeando
      // "sale" del bloqueo por el simple paso del tiempo aunque no haya parado.
      previos.push(ahora);
      this.intentos.set(clave, previos);

      const esperar = Math.ceil((previos[0] + limite.ventanaSegundos * 1000 - ahora) / 1000);
      this.logger.warn(
        `Límite alcanzado en ${limite.nombre} desde ${this.origen(peticion)}: ` +
          `${previos.length} intentos en ${limite.ventanaSegundos}s.`,
      );

      // 429 con `Retry-After`: el código que corresponde, y el encabezado que
      // le dice a un cliente honesto cuándo volver.
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Demasiados intentos. Probá de nuevo en ${Math.max(esperar, 1)} segundos.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
        { description: `Retry-After: ${Math.max(esperar, 1)}` },
      );
    }

    previos.push(ahora);
    this.intentos.set(clave, previos);
    this.podar(desde);
    return true;
  }

  /**
   * De dónde viene la petición.
   *
   * ⚠️ `x-forwarded-for` sólo es confiable si hay un proxy DE CONFIANZA
   * delante que lo reescriba; si la API se expone directo, un cliente puede
   * mandar el encabezado que quiera y saltarse el límite. Por eso se toma
   * únicamente cuando `TRUST_PROXY` está activado, que es una decisión de
   * despliegue y está documentada.
   */
  private origen(peticion: any): string {
    if (process.env.TRUST_PROXY === 'true') {
      const reenviado = peticion.headers?.['x-forwarded-for'];
      if (typeof reenviado === 'string' && reenviado.trim() !== '') {
        // El primero de la lista es el cliente original.
        return reenviado.split(',')[0].trim();
      }
    }
    return peticion.ip ?? peticion.socket?.remoteAddress ?? 'desconocido';
  }

  /** Saca las claves vencidas y acota el tamaño del mapa. */
  private podar(desde: number): void {
    if (this.intentos.size < MAXIMO_CLAVES) {
      // Poda barata: sólo lo vencido, sin recorrer todo en cada petición.
      if (this.intentos.size % 64 !== 0) return;
    }

    for (const [clave, marcas] of this.intentos) {
      const vigentes = marcas.filter((t) => t > desde);
      if (vigentes.length === 0) this.intentos.delete(clave);
      else this.intentos.set(clave, vigentes);
    }

    if (this.intentos.size >= MAXIMO_CLAVES) {
      // Bajo ataque distribuido: se sacrifica precisión, no el proceso.
      const sobran = this.intentos.size - Math.floor(MAXIMO_CLAVES / 2);
      let borradas = 0;
      for (const clave of this.intentos.keys()) {
        if (borradas++ >= sobran) break;
        this.intentos.delete(clave);
      }
      this.logger.warn(
        `El registro de límites llegó a ${MAXIMO_CLAVES} orígenes distintos: se ` +
          'descartaron los más viejos. Si esto se repite, el contador tiene que ' +
          'mudarse a Redis.',
      );
    }
  }
}
