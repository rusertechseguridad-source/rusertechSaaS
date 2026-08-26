import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { ColaService } from './cola.service';
import { EstadoVehiculoService } from './estado-vehiculo.service';
import { MotorConfigService } from './motor-config.service';
import { TransicionesService } from './transiciones.service';
import { VehiculosActivosService } from './vehiculos-activos.service';
import { TrabajosService } from './trabajos.service';
import { evaluarGeocercas, evaluarTransicionesDeEstado } from './evaluadores/geocercas.evaluator';
import type { ConfigMotor, Decision, EstadoVehiculo, PuntoEvaluable } from './tipos';

/** Cada cuánto busca trabajo. Con esto la latencia queda muy por debajo del objetivo de 30-60 s. */
const INTERVALO_MS = 5000;

/** Cada cuánto se resincroniza qué vehículos están bajo monitoreo. */
const INTERVALO_SINCRONIZACION_MS = 60000;

/**
 * WORKER DEL MOTOR DE EVENTOS.
 *
 * Es el único que toca la base: carga el estado, llama a los evaluadores
 * —que son funciones puras— y persiste el resultado.
 *
 * ── POR QUÉ SONDEO Y NO BullMQ ─────────────────────────────────────────────
 * BullMQ necesita Redis, y en esta instalación Redis es OPCIONAL: hoy no está
 * configurado. Un motor de seguridad no puede depender de una pieza que puede
 * no existir. El sondeo cada 5 segundos sobre un índice parcial es barato y no
 * depende de nada más que de Postgres.
 *
 * `pg_notify` quedó fuera a propósito: reduciría la latencia de 5 s a
 * instantánea, pero Prisma no expone LISTEN y el objetivo de latencia del
 * diseño es 30-60 s. Cinco segundos ya está diez veces por debajo.
 *
 * ── POR QUÉ NO SE COALESCE POR VEHÍCULO ────────────────────────────────────
 * El diseño contemplaba evaluar sólo el último punto de cada vehículo por
 * lote. Para las geocercas eso está mal: un vehículo que entra y sale de una
 * zona entre dos puntos del lote perdería las dos transiciones, y esa entrada
 * puede ser justamente la que importa.
 *
 * Como la consulta geoespacial cuesta 0,041 ms medidos y se resuelve para todo
 * el lote en UNA sola consulta, procesar punto por punto es barato. Lo que sí
 * se coalesce es la ESCRITURA: una por vehículo por lote, no una por punto.
 */
@Injectable()
export class MotorWorker {
  private readonly logger = new Logger(MotorWorker.name);
  private readonly workerId = `worker-${randomUUID().slice(0, 8)}`;
  private corriendo = false;
  private ultimaSincronizacion = 0;

  constructor(
    private readonly cola: ColaService,
    private readonly estado: EstadoVehiculoService,
    private readonly config: MotorConfigService,
    private readonly transiciones: TransicionesService,
    private readonly activos: VehiculosActivosService,
    private readonly trabajos: TrabajosService,
  ) {}

  @Interval(INTERVALO_MS)
  async vuelta(): Promise<void> {
    // Sin reentrada: si un lote tarda más que el intervalo, no se solapan.
    if (this.corriendo) return;
    this.corriendo = true;
    try {
      await this.sincronizarSiCorresponde();
      await this.cola.recuperarHuerfanas();
      await this.procesarLote();
      // Trabajos de cierre de viaje (resumen + series). Van al final de la
      // vuelta: el cierre no compite con la evaluación en vivo.
      await this.trabajos.procesarPendientes(this.workerId);
    } catch (error) {
      this.logger.error(`Fallo la vuelta del motor: ${(error as Error).message}`);
    } finally {
      this.corriendo = false;
    }
  }

  private async sincronizarSiCorresponde(): Promise<void> {
    const ahora = Date.now();
    if (ahora - this.ultimaSincronizacion < INTERVALO_SINCRONIZACION_MS) return;
    this.ultimaSincronizacion = ahora;
    try {
      await this.activos.sincronizar();
    } catch (error) {
      // Que falle la sincronización no puede frenar el procesamiento de lo que
      // ya está encolado.
      this.logger.warn(`No se pudo sincronizar el monitoreo: ${(error as Error).message}`);
    }
  }

  private async procesarLote(): Promise<void> {
    const puntos = await this.cola.tomarLote(this.workerId);
    if (puntos.length === 0) return;

    const porVehiculo = new Map<string, PuntoEvaluable[]>();
    for (const p of puntos) {
      const lista = porVehiculo.get(p.vehicle_id) ?? [];
      lista.push(p);
      porVehiculo.set(p.vehicle_id, lista);
    }

    const estados = await this.estado.cargar([...porVehiculo.keys()]);
    const estadosValidos = await this.transiciones.estadosValidos();

    const tripIds = [...new Set(puntos.map((p) => p.trip_id).filter((t): t is string => !!t))];
    const zonasPorViaje = await this.transiciones.zonasDeViajes(tripIds);
    const estadoDeViaje = await this.transiciones.estadosDeViajes(tripIds);

    const configPorTenant = new Map<string, ConfigMotor>();
    const listos: string[] = [];

    for (const [vehicleId, puntosDelVehiculo] of porVehiculo) {
      try {
        const tenantId = puntosDelVehiculo[0].tenant_id;
        if (!configPorTenant.has(tenantId)) {
          configPorTenant.set(tenantId, await this.config.obtener(tenantId));
        }
        const cfg = configPorTenant.get(tenantId)!;

        const procesados = await this.procesarVehiculo(
          vehicleId,
          tenantId,
          puntosDelVehiculo,
          estados.get(vehicleId),
          cfg,
          zonasPorViaje,
          estadoDeViaje,
          estadosValidos,
        );
        listos.push(...procesados);
      } catch (error) {
        // Un vehículo que falla no arrastra al resto del lote.
        const mensaje = (error as Error).message;
        this.logger.error(`Vehículo ${vehicleId}: ${mensaje}`);
        for (const p of puntosDelVehiculo) {
          await this.cola.marcarFallido(p.cola_id, mensaje);
        }
      }
    }

    await this.cola.marcarListos(listos);
  }

  private async procesarVehiculo(
    vehicleId: string,
    tenantId: string,
    puntos: PuntoEvaluable[],
    estadoPrevio: EstadoVehiculo | undefined,
    cfg: ConfigMotor,
    zonasPorViaje: Map<string, any[]>,
    estadoDeViaje: Map<string, string>,
    estadosValidos: string[],
  ): Promise<string[]> {
    let estado: EstadoVehiculo = estadoPrevio ?? {
      vehicle_id: vehicleId,
      tenant_id: tenantId,
      ultimo_punto_ts: null,
      ultima_velocidad: null,
      ultima_ignicion: null,
      detenido_desde: null,
      geocercas_dentro: [],
    };

    // Una sola consulta geoespacial para todos los puntos del vehículo.
    const geocercasPorIndice = cfg.eval_geocercas
      ? await this.estado.geocercasDelLote(tenantId, puntos)
      : new Map<number, any[]>();

    const decisiones: Decision[] = [];

    for (let i = 0; i < puntos.length; i++) {
      const punto = puntos[i];

      if (cfg.eval_geocercas) {
        const resultado = evaluarGeocercas(estado, geocercasPorIndice.get(i) ?? [], punto);
        decisiones.push(...resultado.decisiones);
        estado = { ...estado, geocercas_dentro: resultado.geocercasDentro };
      }

      estado = {
        ...estado,
        ultimo_punto_ts: punto.timestamp,
        ultima_velocidad: punto.speed_kmh,
        ultima_ignicion: punto.ignition,
        detenido_desde: this.calcularDetenidoDesde(estado, punto, cfg),
      };
    }

    // Transiciones de estado: dependen de las entradas a geocerca del lote.
    if (cfg.eval_protocolos || cfg.eval_geocercas) {
      for (const tripId of new Set(puntos.map((p) => p.trip_id).filter((t): t is string => !!t))) {
        const zonas = zonasPorViaje.get(tripId) ?? [];
        if (zonas.length === 0) continue;
        const estadoActual = estadoDeViaje.get(tripId) ?? '';
        const propuestas = evaluarTransicionesDeEstado(
          decisiones.filter((d) => d.trip_id === tripId),
          zonas,
          estadoActual,
          estadosValidos,
        );
        for (const p of propuestas) {
          if (p.tipo === 'transicion_estado' && p.estado_destino) {
            await this.transiciones.aplicarTransicion(p, estadoActual);
            estadoDeViaje.set(tripId, p.estado_destino);
          } else if (p.causa_id && p.tipo === 'geocerca_entrada') {
            await this.transiciones.marcarZonaAlcanzada(tripId, p.causa_id, p.momento);
          }
        }
        decisiones.push(...propuestas);
      }
    }

    // Una escritura de estado por vehículo por lote.
    const ultimo = puntos[puntos.length - 1];
    await this.estado.guardar(estado, ultimo.timestamp);
    if (cfg.eval_geocercas) {
      await this.estado.guardarGeocercas(
        vehicleId,
        tenantId,
        estado.geocercas_dentro,
        ultimo.timestamp,
      );
    }

    if (decisiones.length > 0) {
      this.logger.debug(
        `Vehículo ${vehicleId}: ${puntos.length} puntos, ${decisiones.length} decisiones.`,
      );
    }

    return puntos.map((p) => p.cola_id);
  }

  /**
   * Desde cuándo el vehículo está detenido.
   *
   * Se mantiene acá aunque el evaluador de paradas sea de la Etapa 3: el dato
   * hay que acumularlo desde ahora, porque no se puede reconstruir hacia atrás
   * sin releer telemetría — que es justamente lo que el estado evita.
   */
  private calcularDetenidoDesde(
    estado: EstadoVehiculo,
    punto: PuntoEvaluable,
    cfg: ConfigMotor,
  ): Date | null {
    const velocidad = punto.speed_kmh ?? 0;
    const enMarcha = velocidad > cfg.parada_velocidad_kmh;
    if (enMarcha) return null;
    return estado.detenido_desde ?? punto.timestamp;
  }
}
