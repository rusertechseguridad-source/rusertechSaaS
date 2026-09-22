/**
 * EL VOCABULARIO DEL DESPACHO.
 *
 * ⚠️ Este archivo no importa nada de NestJS ni de Prisma: lo que decide si un
 * aviso interrumpe o no es una función pura y tiene que poder probarse sin
 * levantar la base, igual que los evaluadores del motor.
 */

/**
 * De dónde salió el aviso.
 *
 * ⚠️ SON DOS FUENTES Y NO UNA, y es un hallazgo de esta tanda: la campana
 * tiene que mostrar las dos.
 *
 *   · `condicion` → `trip_conditions`, lo que abre el motor desde la 3B
 *     (sin reporte, desvío, paradas). Gravedad en `nivel_riesgo`, vocabulario
 *     de `motor_niveles_riesgo`.
 *   · `evento`    → `event_logs`, las alertas de geocerca y pánico de la
 *     Tanda 5. Gravedad en `severity`, que es un `varchar` SIN restricción.
 *
 * No se unifican en una tabla nueva: se unen en la LECTURA. Copiar filas de
 * una a otra sería crear un tercer lugar donde el estado puede desincronizarse,
 * y las dos ya tienen su propio ciclo de atención (`atendida_por` de un lado,
 * `acknowledged_by` del otro).
 */
export type FuenteAviso = 'condicion' | 'evento';

/**
 * Lo que un canal recibe. Es independiente del canal: la campana lo pinta, y
 * el Telegram de la entrega 2 va a mandar estos mismos campos como texto.
 */
export interface AvisoDespacho {
  fuente: FuenteAviso;
  id: string;
  tenant_id: string;
  vehicle_id: string;
  trip_id: string | null;
  /** El código: `SIN_REPORTE`, `panic_button`. Vocabulario de cada fuente. */
  tipo: string;
  /** El nombre legible que ya está en el catálogo. Nunca se inventa acá. */
  titulo: string;
  /**
   * El código de `motor_niveles_riesgo`, o `null` si no se pudo clasificar.
   *
   * ⚠️ `null` NO significa «sin importancia»: significa «no sé». Ver
   * `clasificado`.
   */
  nivel_riesgo: string | null;
  /** Del catálogo. El código no elige colores. */
  color: string;
  /** ¿Corta la pantalla? Sale de `motor_niveles_riesgo.interrumpe_al_operador`. */
  interrumpe: boolean;
  /** ¿Entra a la cuenta de la campana? De `requiere_atencion_operador`. */
  requiere_atencion: boolean;
  /**
   * ⚠️ FALSO CUANDO LA GRAVEDAD NO SE PUDO TRADUCIR.
   *
   * `event_logs.severity` no tiene CHECK: hoy el único valor que existe es
   * `critical`, pero mañana puede aparecer otro. Un aviso sin clasificar
   * **entra igual a la campana** —la regla dice que no se pierde ninguna— pero
   * **no interrumpe**.
   *
   * Es el fallo seguro que corresponde acá, y la dirección importa. Hacerlo
   * desaparecer rompería la regla dura de la tanda; hacerlo gritar enseñaría a
   * silenciar la campana, que es la manera de perder las que sí importan.
   * Aparece marcado como «sin clasificar» para que no sea invisible a la vista.
   */
  clasificado: boolean;
  /** Cuándo pasó el hecho, no cuándo se despachó. */
  ocurrio_at: Date;
  patente: string | null;
  latitud: number | null;
  longitud: number | null;
  direccion: string | null;
  /** El texto que el motor dejó escrito. */
  disparador: string | null;
}

/** Que alguien lo atendió: lo que apaga el sonido en las demás pantallas. */
export interface AvisoAtendido {
  fuente: FuenteAviso;
  id: string;
  tenant_id: string;
  atendida_por: string;
  atendida_por_nombre: string | null;
  atendida_at: Date;
  nota: string | null;
}

/** Que la condición se cerró sola: deja de sonar, queda en el historial. */
export interface AvisoResuelto {
  fuente: FuenteAviso;
  id: string;
  tenant_id: string;
  resuelta_at: Date;
  motivo: string | null;
}

/** Todo lo que puede viajar por un canal. */
export type MensajeDeCanal =
  | { clase: 'nuevo'; aviso: AvisoDespacho }
  | { clase: 'atendido'; aviso: AvisoAtendido }
  | { clase: 'resuelto'; aviso: AvisoResuelto };

/**
 * UN CANAL DE ENTREGA.
 *
 * Hoy hay uno: la campana. La entrega 2 agrega Telegram y la 3 el correo,
 * **sin tocar el motor**: se implementa esta interfaz y se registra en el
 * proveedor `CANALES_DE_AVISO`. Ése es todo el punto de que el despacho sea
 * un solo lugar.
 *
 * ⚠️ `entregar` NO puede tumbar al motor. El aviso ya está durable en la base
 * antes de llegar acá —la condición se escribió— así que un canal que falla
 * pierde el empujón en vivo, no la alerta: la campana se reconstruye leyendo.
 * Por eso `DespachoService` atrapa por canal, registra el error y sigue con
 * el siguiente. No es silenciar un error: es no dejar que la falla de un
 * mensajero deshaga el hecho que lo originó.
 */
export interface CanalDeAviso {
  readonly nombre: string;
  entregar(mensaje: MensajeDeCanal): Promise<void> | void;
}

/** Token de inyección: todos los canales registrados. */
export const CANALES_DE_AVISO = 'CANALES_DE_AVISO';

/**
 * ¿Este nivel de riesgo interrumpe al operador?
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ POR QUÉ ESTO RECIBE LA FILA DEL CATÁLOGO Y NO UN NÚMERO
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Porque `if (orden >= 30)` es exactamente lo que el encargo prohíbe, y con
 * razón: el día que se agregue un nivel entre medio, o que un cliente quiera
 * que una anomalía lo despierte, habría que tocar código y desplegar.
 *
 * ⚠️ Y porque `requiere_atencion_operador` NO ALCANZA. Medido en el catálogo
 * real: es `true` en TRES de los cuatro niveles —anomalía, riesgo crítico y
 * activación policial— y sólo `panorama_normal` lo tiene en `false`. Sirve
 * para la pregunta «¿esto entra a la campana?», que es otra: si fuera la línea
 * entre crítica y menor, una parada no autorizada —anomalía— dispararía el
 * aviso rojo con sirena. Son dos preguntas distintas y necesitan dos columnas.
 */
export function interrumpe(nivel: { interrumpe_al_operador: boolean } | null): boolean {
  return nivel?.interrumpe_al_operador === true;
}

/**
 * ¿Entra a la cuenta de la campana?
 *
 * Un aviso sin clasificar entra igual: es el fallo seguro descrito arriba.
 */
export function entraALaCampana(
  nivel: { requiere_atencion_operador: boolean } | null,
): boolean {
  return nivel === null || nivel.requiere_atencion_operador === true;
}
