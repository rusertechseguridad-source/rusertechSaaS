/**
 * TIPOS DEL MOTOR DE EVENTOS.
 *
 * Este archivo no importa nada de NestJS ni de Prisma a propósito: los
 * evaluadores son funciones puras y tienen que poder probarse sin levantar
 * la aplicación ni la base.
 */

/** Un punto de telemetría listo para evaluar. */
export interface PuntoEvaluable {
  cola_id: string;
  telemetry_id: string;
  tenant_id: string;
  vehicle_id: string;
  trip_id: string | null;
  timestamp: Date;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  ignition: boolean | null;
  temperature_c: number | null;
  provider_code: string | null;
  origen: 'movil' | 'hub';
}

/** Geocerca que contiene un punto. */
export interface GeocercaDelPunto {
  geofence_id: string;
  nombre: string;
  zone_type: string;
}

/** Zona de control asociada a un viaje (tabla `trip_control_zones`). */
export interface ZonaDeControlDelViaje {
  control_zone_id: string;
  nombre: string;
  /** Geocerca equivalente, para poder cruzarla con las transiciones. */
  geofence_id: string | null;
  sequence_order: number;
  was_triggered: boolean;
  auto_transition: boolean;
  transition_target_status: string | null;
  notify_on_enter: boolean;
  notify_on_exit: boolean;
  notify_if_skipped: boolean;
}

/**
 * Lo que un evaluador decide. Es una descripción de un hecho, no una
 * instrucción de escritura: quien persiste es el worker, no el evaluador.
 */
export type TipoDecision =
  | 'geocerca_entrada'
  | 'geocerca_salida'
  | 'transicion_estado'
  | 'zona_salteada';

export interface Decision {
  tipo: TipoDecision;
  tenant_id: string;
  vehicle_id: string;
  trip_id: string | null;
  momento: Date;
  /** Qué la originó, en texto legible por el operador. */
  detalle: string;
  /** Referencia a la causa concreta: geocerca, zona de control, etc. */
  causa_id?: string;
  /** Solo para `transicion_estado`. */
  estado_destino?: string;
  /** Si el hecho debe notificarse (lo define la configuración de la zona). */
  notificar?: boolean;
  datos?: Record<string, unknown>;
  /**
   * Dónde ocurrió. `event_logs` tiene `latitude`, `longitude` y
   * `provider_code`, y sin ellas la alerta no se puede ubicar en el mapa: el
   * operador vería "entró en una geocerca" sin saber dónde.
   */
  latitude?: number;
  longitude?: number;
  provider_code?: string | null;
}

/**
 * Estado que los evaluadores necesitan entre puntos.
 *
 * `geocercas_dentro` es la lista de geocercas en las que el vehículo estaba
 * en la evaluación anterior. Comparar contra la actual es lo que convierte
 * "está en la zona A" —que no es un evento— en "entró en la zona A", que sí.
 */
export interface EstadoVehiculo {
  vehicle_id: string;
  tenant_id: string;
  ultimo_punto_ts: Date | null;
  ultima_velocidad: number | null;
  ultima_ignicion: boolean | null;
  detenido_desde: Date | null;
  geocercas_dentro: string[];
}

/** Configuración efectiva del motor para un tenant. */
export interface ConfigMotor {
  red_seguridad_minutos: number;
  red_seguridad_activa: boolean;
  parada_minutos: number;
  parada_velocidad_kmh: number;
  eval_geocercas: boolean;
  eval_reglas: boolean;
  eval_desvio: boolean;
  eval_protocolos: boolean;
  eval_riesgo: boolean;
  eval_sensores: boolean;
}

/**
 * Valores por defecto. Espejo de los DEFAULT de `tenant_engine_config`.
 * Un tenant sin fila tiene un motor razonable, no un motor apagado.
 */
export const CONFIG_MOTOR_POR_DEFECTO: ConfigMotor = {
  red_seguridad_minutos: 30,
  red_seguridad_activa: true,
  parada_minutos: 10,
  parada_velocidad_kmh: 5,
  eval_geocercas: true,
  eval_reglas: true,
  eval_desvio: true,
  eval_protocolos: true,
  eval_riesgo: true,
  eval_sensores: true,
};
