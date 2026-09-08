/**
 * TIPOS DEL ESTADO DE SEGUIMIENTO.
 *
 * ⚠️ Este archivo no importa NADA — ni NestJS, ni Prisma, ni el catálogo. Es la
 * misma regla que `motor/tipos.ts`: la lógica es ciega, y lo que se puede
 * probar sin levantar la base es lo que se prueba de verdad.
 *
 * Y hay una segunda razón, específica de esta etapa: acá NO se escribe ningún
 * código de catálogo. Ni `SOS`, ni `panorama_normal`, ni `EN_CURSO`. Todo
 * entra por parámetro.
 *
 * Por qué importa: el catálogo de riesgo acepta niveles propios por tenant
 * —`motor_niveles_riesgo.tenant_id` es nullable a propósito—, así que un
 * cliente puede agregar mañana un nivel con orden 50. Una regla que dijera
 * «si el código es SOS, gana» se rompería en silencio ese día. Las reglas de
 * acá comparan `orden` y `resolucionManual`, que es lo que el catálogo
 * garantiza, y no conocen un solo nombre.
 *
 * ── LAS DOS DIMENSIONES ────────────────────────────────────────────────────
 *
 *   ETAPA        ¿en qué parte del proceso va?   `trips.status`
 *   SEGUIMIENTO  ¿hay alguna novedad?            este archivo
 *
 * Un viaje puede estar `EN_CURSO` y `SIN_REPORTE` al mismo tiempo. La etapa la
 * mueve la operación; el seguimiento sale de las condiciones abiertas.
 */

/**
 * Una condición abierta sobre el viaje — una fila de `trip_conditions` con
 * `fin` en null, ya cruzada con su tipo y su nivel de riesgo.
 */
export interface CondicionAbierta {
  /** `trip_conditions.id`. */
  id: string;
  /** `motor_tipos_condicion.codigo`. */
  tipo: string;
  /** `motor_niveles_riesgo.codigo`. */
  riesgo: string;
  /**
   * `motor_niveles_riesgo.orden`.
   *
   * ⚠️ El comentario de esa tabla dice para qué existe: «permite comparar
   * gravedad sin que el código conozca los nombres». Esto es cobrar ese pago.
   */
  ordenRiesgo: number;
  /**
   * El motor NO puede cerrar esta condición solo: la cierra una persona.
   *
   * ⚠️ Sale de `motor_tipos_condicion.resolucion`, cuyo vocabulario REAL es
   * `automatico` / `operador` — verificado contra la base el 2026-09-08. La
   * primera versión comparaba contra la palabra `manual`, que no existe en ese
   * catálogo: daba siempre false y dejaba la regla muerta sin que nada fallara.
   * Por eso la consulta pregunta al revés (pegajosa salvo `automatico`).
   *
   * ⚠️ ES LA REGLA DE «PANICO GANA SIEMPRE», ESCRITA SIN NOMBRAR AL PÁNICO.
   * Una condición que sólo cierra un operador no puede dejar de ser el estado
   * porque haya llegado un punto nuevo — si pudiera, un vehículo con el SOS
   * abierto volvería a verde solo con reanudar la marcha.
   */
  resolucionManual: boolean;
  inicio: Date;
}

/** Lo que un operador declaró a mano y sigue vigente. */
export interface DeclaracionManual {
  /** `motor_tipos_condicion.codigo`, de los que tienen `declarable_por_operador`. */
  tipo: string;
  riesgo: string;
  ordenRiesgo: number;
  /** `users.id` — quién la declaró. Un estado manual sin autor no se audita. */
  declaradoPor: string;
  desde: Date;
  nota?: string | null;
}

/** El tramo del ciclo de vida: `trips.status` con lo que hace falta de su catálogo. */
export interface EtapaCicloVida {
  /** `trips.status`, que es también `motor_estados_viaje.codigo`. */
  codigo: string;
  /** `motor_estados_viaje.es_terminal`. */
  esTerminal: boolean;
  /**
   * Desde cuándo el viaje está en esta etapa.
   *
   * ⚠️ Está acá porque la primera versión no la tenía y el caso «no hay
   * ninguna condición abierta» se quedaba sin fecha de vigencia: puse un
   * `new Date(0)` de relleno, que es 1970 — una fecha falsa escrita en el
   * historial del operador. El dato existe (la última transición de ciclo de
   * vida, o `trips.updated_at`); lo que faltaba era pedirlo.
   */
  desde: Date;
}

/**
 * El nivel de riesgo que corresponde cuando NO pasa nada.
 *
 * Entra por parámetro y no como constante: es el de menor `orden` del catálogo
 * global, y leerlo es una consulta, no una suposición.
 */
export interface RiesgoNeutro {
  codigo: string;
  orden: number;
}

/** Todo lo que hace falta para saber en qué estado de seguimiento está un viaje. */
export interface EntradaSeguimiento {
  etapa: EtapaCicloVida;
  condicionesAbiertas: CondicionAbierta[];
  declaracion: DeclaracionManual | null;
  riesgoNeutro: RiesgoNeutro;
}

/** El estado de seguimiento resuelto. */
export interface EstadoSeguimiento {
  /** El código. Vive en uno de los dos catálogos; `estadoOrigen` dice en cuál. */
  estado: string;
  estadoOrigen: 'condicion' | 'ciclo_vida';
  /** De acá sale el COLOR. No se guarda el color: se guarda de dónde sacarlo. */
  riesgo: string;
  ordenRiesgo: number;
  /** Quién manda: el motor o una persona. */
  origen: 'deducido' | 'manual';
  /** La condición que sostiene el estado, si es que hay una. */
  condicionId: string | null;
  vigenteDesde: Date;
  /**
   * Por qué éste y no otro, en texto para el operador. Va a
   * `trip_state_history.causa_detalle`.
   *
   * No es decoración: un estado sin explicación obliga al operador a
   * reconstruir el razonamiento del motor, y en la práctica deja de mirarlo.
   */
  motivo: string;
}

/** El resultado de preguntarle a la máquina si una transición se puede hacer. */
export interface Veredicto {
  valida: boolean;
  /**
   * Obligatorio cuando `valida` es false.
   *
   * ⚠️ El CHECK `trip_state_history_rechazo_check` lo exige también del lado
   * de la base: un rechazo sin motivo no se puede escribir. La regla no
   * depende de que el código se acuerde.
   */
  motivo?: string;
}
