/**
 * TIPOS DE LAS CONDICIONES — y la clave que impide el ruido.
 *
 * ⚠️ Este archivo no importa nada de NestJS ni de Prisma, igual que
 * `motor/tipos.ts`: los evaluadores son funciones puras y tienen que poder
 * probarse sin levantar la base.
 *
 * Los CÓDIGOS del catálogo sí se nombran acá, y es la diferencia con
 * `seguimiento/tipos-seguimiento.ts`. Allá el estado se DERIVA comparando
 * gravedades y por eso no podía conocer un nombre; acá cada evaluador abre una
 * condición concreta y tiene que decir cuál. Los cuatro existen en
 * `motor_tipos_condicion` desde la Etapa 0 — no se inventa vocabulario.
 */

/** Los cuatro códigos que esta etapa abre. Todos ya en el catálogo. */
export const CONDICIONES_3B = {
  PARADA_NO_AUTORIZADA: 'PARADA_NO_AUTORIZADA',
  PARADA_PROLONGADA: 'PARADA_PROLONGADA',
  DESVIO_DE_RUTA: 'DESVIO_DE_RUTA',
  SIN_REPORTE: 'SIN_REPORTE',
} as const;

export type CodigoCondicion = (typeof CONDICIONES_3B)[keyof typeof CONDICIONES_3B];

/** Abrir o cerrar: lo único que un evaluador puede decidir sobre una condición. */
export interface DecisionCondicion {
  accion: 'abrir' | 'cerrar';
  tipo: CodigoCondicion;
  tenant_id: string;
  vehicle_id: string;
  /** `trip_conditions.trip_id` es NULLABLE: hay condiciones sin viaje declarado. */
  trip_id: string | null;
  /**
   * CUÁNDO EMPEZÓ EL HECHO — no cuándo se detectó.
   *
   * ⚠️ Es lo que hace estable la clave de identidad. Un camión parado veinte
   * minutos genera 240 puntos; los 240 ven el mismo `detenido_desde`, así que
   * los 240 producen la misma clave y sólo el primero inserta.
   */
  inicio: Date;
  /** Sólo al cerrar: cuándo terminó. */
  fin?: Date;
  /** Qué lo disparó, en texto para el operador. */
  disparador: string;
  /** El detalle medible: metros de desvío, minutos detenido, umbral aplicado. */
  datos: Record<string, unknown>;
}

/**
 * LA CLAVE DE IDENTIDAD.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUÉ ESTA FORMA
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `(tenant, vehículo, tipo, INICIO DEL HECHO)`.
 *
 * Lo que la hace funcionar es el cuarto componente, y es contraintuitivo: **no
 * lleva el momento de la detección ni el id del punto**. Lleva el momento en
 * que el hecho EMPEZÓ.
 *
 *   · Un camión parado 20 min emite 240 puntos. Los 240 se evalúan con el
 *     mismo `detenido_desde`, así que los 240 dan la misma clave. Sin esto el
 *     operador recibe 240 alertas del mismo camión quieto.
 *   · Reprocesar la cola después de una caída del worker vuelve a evaluar los
 *     mismos puntos y produce las mismas claves: el reproceso es seguro, que
 *     es lo que el diseño §3 promete.
 *   · Si el camión arranca y vuelve a parar, `detenido_desde` cambia: es OTRO
 *     hecho y le corresponde OTRA condición. La clave lo distingue solo.
 *
 * ⚠️ El inicio se trunca al MINUTO. Sin truncar, dos evaluaciones del mismo
 * hecho separadas por milisegundos —un reproceso, dos workers— darían claves
 * distintas y la protección se caería justo cuando más se la necesita. El
 * minuto es la granularidad más fina en la que ningún umbral de este motor
 * está expresado, así que no pierde nada.
 *
 * ⚠️ Lleva el TENANT aunque `trip_conditions` ya tenga `tenant_id`: la clave
 * viaja a un índice único, y sin el tenant dos clientes con el mismo vehículo
 * migrado —que pasa— colisionarían.
 */
export function claveDeIdentidad(d: {
  tenant_id: string;
  vehicle_id: string;
  tipo: string;
  inicio: Date;
}): string {
  const alMinuto = new Date(d.inicio);
  alMinuto.setUTCSeconds(0, 0);
  return `${d.tenant_id}:${d.vehicle_id}:${d.tipo}:${alMinuto.toISOString()}`;
}

/** Minutos entre dos momentos. Positivo si `hasta` es posterior. */
export const minutosEntre = (desde: Date, hasta: Date): number =>
  (hasta.getTime() - desde.getTime()) / 60000;
