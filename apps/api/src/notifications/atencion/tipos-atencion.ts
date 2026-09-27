/**
 * EL VOCABULARIO DE LA ATENCIÓN.
 *
 * ⚠️ Sin NestJS ni Prisma: las reglas de qué se puede hacer son funciones
 * puras y se prueban sin levantar la base, igual que los evaluadores del
 * motor y que `tipos-despacho.ts`.
 *
 * ⚠️ Y sin vocabulario inventado: los pasos, los resultados y la jerarquía
 * viven en tablas. Acá sólo están las tres palabras que describen QUÉ CLASE
 * de entrada es —registrar, escalar, cerrar—, que son la forma del hilo y no
 * doctrina del cliente.
 */

import type { FuenteAviso } from '../despacho/tipos-despacho';

/** Qué clase de entrada es. La forma del hilo, no su contenido. */
export type AccionBitacora = 'registro' | 'escalada' | 'cierre';

/** Un paso del protocolo, tal como sale del catálogo. */
export interface PasoProtocolo {
  id: string;
  orden: number;
  accion: string;
}

/** Una opción de resultado, tal como sale del catálogo. */
export interface ResultadoAtencion {
  codigo: string;
  nombre: string;
  orden: number;
  /** ⚠️ Sale de la columna. Hoy es «No responde» en las cinco alertas. */
  habilita_escalada: boolean;
}

/** Lo que la pantalla necesita para armar el formulario de atención. */
export interface ProtocoloDeAtencion {
  tipo_condicion: string;
  pasos: PasoProtocolo[];
  resultados: ResultadoAtencion[];
  /** `true` si la doctrina vino de una fila del cliente y no de la global. */
  propio_del_cliente: boolean;
}

/** Una entrada del hilo, ya lista para mostrar. */
export interface EntradaBitacora {
  id: string;
  fuente: FuenteAviso;
  alerta_id: string;
  accion: AccionBitacora;
  usuario_id: string;
  usuario_nombre: string | null;
  paso_id: string | null;
  paso_accion: string | null;
  resultado_codigo: string | null;
  resultado_nombre: string | null;
  nota: string | null;
  escalado_a: string | null;
  escalado_a_nombre: string | null;
  created_at: Date;
}

/** A quién le toca recibir una escalada. */
export interface DestinoDeEscalada {
  usuario_id: string;
  nombre: string | null;
  email: string;
  role_code: string;
  nivel_jerarquico: number;
}

/**
 * ¿Esta entrada DICE ALGO?
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ «REGISTRAR ES OBLIGATORIO» — la regla, en una función
 * ══════════════════════════════════════════════════════════════════════════
 *
 * No se puede silenciar una alerta sin decir qué se hizo. Valen las dos vías
 * —una opción del catálogo o texto libre— pero alguna hay que elegir.
 *
 * ⚠️ `trim()` y no `length > 0`: un espacio es una forma de no decir nada que
 * pasa cualquier validación escrita sin cuidado, y deja la bitácora con una
 * fila que parece un registro y no lo es. Es lo peor de los dos mundos,
 * porque además tapa el hueco.
 *
 * Esta regla está TAMBIÉN como CHECK en la tabla. No es redundancia: una
 * regla de negocio que sólo vive en el código se saltea con un INSERT a mano,
 * y esta tabla es lo que el producto le muestra al cliente cuando pregunta
 * por qué nadie hizo nada durante cuarenta minutos.
 */
export function registroDiceAlgo(entrada: {
  resultado_codigo?: string | null;
  nota?: string | null;
}): boolean {
  if (entrada.resultado_codigo && entrada.resultado_codigo.trim().length > 0) return true;
  return typeof entrada.nota === 'string' && entrada.nota.trim().length > 0;
}

/**
 * ¿Este resultado deja escalar?
 *
 * ⚠️ Recibe la FILA del catálogo, no un código. Con un código habría que
 * compararlo contra `'NO_RESPONDE'` en el código, y entonces el día que el
 * cliente decida que «Falla del GPS» también habilita escalar habría que
 * desplegar. La columna `habilita_escalada` existe para que sea un UPDATE.
 */
export function habilitaEscalada(resultado: { habilita_escalada: boolean } | null): boolean {
  return resultado?.habilita_escalada === true;
}

/**
 * ¿Este rol puede CERRAR sin recorrer el protocolo?
 *
 * ⚠️ Sale de `roles.puede_cerrar_alertas` y NO de un umbral sobre
 * `nivel_jerarquico`. Son dos preguntas distintas:
 *
 *   · el nivel contesta A QUIÉN se escala — necesita un orden;
 *   · la facultad de cerrar es una política — un rol podría estar alto y no
 *     tenerla, o al revés.
 *
 * Unirlas obligaría a escribir `nivel >= 60` en algún lado, que es el número
 * mágico que esta serie viene sacando del código desde la campana.
 */
export function puedeCerrar(rol: { puede_cerrar_alertas: boolean } | null): boolean {
  return rol?.puede_cerrar_alertas === true;
}

/**
 * El motivo por el que alguien NO puede atender una alerta crítica.
 *
 * ⚠️ Devuelve el motivo y no un booleano, y es deliberado: la pantalla tiene
 * que mostrar el botón DESHABILITADO CON EL MOTIVO, nunca esconderlo. Un
 * botón ausente es indistinguible de una función que no existe, y el operador
 * que no entiende por qué no puede hacer algo llama por teléfono a preguntar.
 *
 * `null` significa que sí puede.
 */
export function motivoParaNoAtenderCritica(usuario: {
  permisos?: readonly string[];
  esAdmin?: boolean;
}): string | null {
  if (usuario.esAdmin) return null;
  const permisos = usuario.permisos ?? [];
  if (permisos.includes('*') || permisos.includes('manage_critical_alerts')) return null;
  return 'Necesitás el permiso «Atender Alertas Críticas». Pedíselo a un supervisor.';
}
