import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subject, filter, map, merge, timer } from 'rxjs';
import { CanalDeAviso, MensajeDeCanal } from './tipos-despacho';

/** Lo que sale por el flujo hacia un navegador. */
export interface EventoDeCampana {
  type: string;
  data: string;
}

/** Cada cuánto se manda un latido para que nadie corte la conexión. */
export const LATIDO_MS = 25_000;

/**
 * ══════════════════════════════════════════════════════════════════════════
 * EL CANAL «CAMPANA» — el empujón en vivo hacia el panel
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Mantiene un flujo por CLIENTE. Cada navegador conectado se suscribe al de su
 * cliente y recibe lo que le corresponde ver.
 *
 * ── Por qué SSE y no WebSockets ───────────────────────────────────────────
 *
 * Medido antes de elegir: **no hay ningún gateway de websockets en el
 * repositorio**. No hay `@WebSocketGateway`, ni `socket.io` en las
 * dependencias — sí está `@socket.io/redis-adapter`, que es el adaptador para
 * repartir eventos entre varias instancias, sin el servidor al que adaptar.
 *
 * Así que no hay nada que reutilizar y hay que elegir. SSE gana por tres
 * razones concretas de este proyecto:
 *
 *   1. El encargo dice que **Redis es opcional** y que lo en vivo tiene que
 *      funcionar con una sola instancia. SSE no necesita nada más que HTTP.
 *   2. El tráfico es en UN SOLO SENTIDO: el servidor avisa, el navegador no
 *      manda nada por el mismo canal. Atender una alerta es un PUT común, que
 *      además queda en el registro de acceso como cualquier otra escritura.
 *   3. Se reconecta solo y no agrega una dependencia nueva al despliegue.
 *
 * ⚠️ LO QUE SSE CUESTA, dicho acá y no descubierto en producción:
 *
 *   · Sobre HTTP/1.1 el navegador permite **6 conexiones por origen**, y una
 *     se la queda este flujo. Detrás de HTTP/2 —que es lo normal con un proxy
 *     con TLS— deja de importar. Está en el reporte.
 *   · `EventSource`, el cliente nativo, **no puede mandar el encabezado
 *     Authorization**. Por eso el frontend NO lo usa: lee el flujo con `fetch`,
 *     que sí lo manda. La alternativa era un token en la dirección, que queda
 *     escrito en los registros de cualquier proxy intermedio.
 *
 * ── Qué pasa si se corta ──────────────────────────────────────────────────
 *
 * Nada se pierde, y es por diseño: **este canal no es la fuente de verdad**.
 * Las alertas viven en `trip_conditions` y `event_logs`. El navegador pide la
 * lista completa al conectarse y en cada reconexión; el flujo sólo evita tener
 * que preguntar cada pocos segundos. Si el canal está caído una hora, al
 * volver se ve todo lo de esa hora.
 *
 * ⚠️ Con VARIAS instancias de la API detrás de un balanceador, un aviso sólo
 * llega a los navegadores conectados A ESA instancia. La lista completa sigue
 * bien en todas —sale de la base— pero el empujón no cruza de proceso. Ahí es
 * donde entra el adaptador de Redis que ya está en las dependencias, y es
 * trabajo de otra entrega. Está en «qué no pude verificar».
 */
@Injectable()
export class CanalCampanaService implements CanalDeAviso, OnModuleDestroy {
  readonly nombre = 'campana';

  private readonly logger = new Logger(CanalCampanaService.name);
  private readonly porCliente = new Map<string, Subject<MensajeDeCanal>>();

  entregar(mensaje: MensajeDeCanal): void {
    const tenantId = mensaje.aviso.tenant_id;
    const flujo = this.porCliente.get(tenantId);
    // Sin nadie mirando no hay a quién empujarle nada, y NO es un error: la
    // alerta ya está en la base y aparece cuando alguien entre.
    if (!flujo) return;
    flujo.next(mensaje);
  }

  /**
   * El flujo que ve UN navegador.
   *
   * @param tenantId    el cliente, que separa los flujos.
   * @param vehiculos   `null` = sin restricción; una lista = sólo esos.
   *
   * ⚠️ EL AISLAMIENTO SE APLICA ACÁ, EN LA SALIDA, y no al emitir: dos
   * operadores del mismo cliente pueden tener restricciones distintas, así que
   * el mismo aviso le toca a uno y al otro no. Filtrar al emitir obligaría a
   * saber, en el momento de escribir, quién está mirando.
   */
  flujoPara(tenantId: string, vehiculos: string[] | null): Observable<EventoDeCampana> {
    const permitidos = vehiculos === null ? null : new Set(vehiculos);

    const avisos = this.flujoDe(tenantId).pipe(
      filter((mensaje) => {
        if (permitidos === null) return true;
        // `atendido` y `resuelto` no llevan vehículo: son sobre un aviso que
        // el navegador o bien ya tiene, o bien nunca recibió. Dejarlos pasar
        // no filtra nada —no traen datos del vehículo— y apagar el sonido de
        // algo que no se está mostrando no hace nada.
        if (mensaje.clase !== 'nuevo') return true;
        return permitidos.has(mensaje.aviso.vehicle_id);
      }),
      map((mensaje) => ({ type: mensaje.clase, data: JSON.stringify(mensaje.aviso) })),
    );

    // ⚠️ EL LATIDO. Un proxy sin tráfico corta la conexión a los 30 o 60
    // segundos sin avisar, y el navegador se queda esperando datos de un caño
    // muerto. Un mensaje cada 25 segundos lo mantiene abierto y, cuando de
    // verdad se corta, el cliente lo nota porque dejan de llegar los latidos.
    const latidos = timer(LATIDO_MS, LATIDO_MS).pipe(
      map(() => ({ type: 'latido', data: JSON.stringify({ at: new Date().toISOString() }) })),
    );

    return merge(avisos, latidos);
  }

  /** Cuántos clientes tienen flujo abierto. Para el reporte y las pruebas. */
  clientesConFlujo(): number {
    return this.porCliente.size;
  }

  private flujoDe(tenantId: string): Subject<MensajeDeCanal> {
    let flujo = this.porCliente.get(tenantId);
    if (!flujo) {
      flujo = new Subject<MensajeDeCanal>();
      this.porCliente.set(tenantId, flujo);
      this.logger.log(`Flujo de campana abierto para el cliente ${tenantId}.`);
    }
    return flujo;
  }

  onModuleDestroy(): void {
    for (const flujo of this.porCliente.values()) flujo.complete();
    this.porCliente.clear();
  }
}
