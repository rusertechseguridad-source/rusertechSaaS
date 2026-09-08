import type {
  CondicionAbierta,
  EntradaSeguimiento,
  EstadoSeguimiento,
  Veredicto,
} from './tipos-seguimiento';

/**
 * DERIVAR EL ESTADO DE SEGUIMIENTO, Y LA MÁQUINA QUE GOBIERNA LO MANUAL.
 *
 * Función pura: no lee la base, no escribe, y NO LEE EL RELOJ DEL SISTEMA. El
 * «ahora» que necesite entra por parámetro — es el requisito que el documento
 * de diseño fijó en §8.2, con el motivo: un evaluador que consulta la hora por
 * dentro es un evaluador que no se puede probar, porque una trayectoria de dos
 * horas tiene que poder evaluarse en segundos con tiempos coherentes.
 *
 * (La función de reloj no se nombra ni acá: una afirmación del ZIP comprueba
 * que no aparezca en este archivo, y la prosa que la nombrara la haría fallar.
 * Es la sexta vez en la serie que el comentario que explica una corrección
 * rompe la comprobación de esa misma corrección.)
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUÉ EL ESTADO SE DERIVA EN VEZ DE GUARDARSE COMO UN VALOR PROPIO
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Un camión puede estar **desviado**, **sin reportar** y **con la temperatura
 * fuera de rango** al mismo tiempo. Con un estado único hay que elegir cuál
 * mostrar, y se pierden los otros dos.
 *
 * Las condiciones coexisten; el estado es **la más grave de las que están
 * abiertas**. El operador ve la urgencia de un vistazo y el sistema no tira
 * información.
 *
 * Y hay un pago concreto: la precedencia se CONSULTA en vez de programarse.
 * Agregar una condición al catálogo no obliga a tocar una línea de este
 * archivo.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * EL ORDEN DE PRECEDENCIA, Y DE DÓNDE SALE CADA ESCALÓN
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   1 · Condiciones PEGAJOSAS (las que sólo cierra una persona)
 *       → «PANICO gana siempre. Ningún otro estado lo pisa. Solo sale de ahí
 *          por decisión del operador.»
 *
 *   2 · La declaración manual del operador
 *       → «El estado manual tiene prioridad sobre el deducido…»
 *
 *   3 · …salvo que haya una condición ESTRICTAMENTE más grave
 *       → «…hasta que el operador lo levante o hasta que el motor detecte algo
 *          más grave.»  Empate = gana la persona: tuvo el contexto a la vista.
 *
 *   4 · Si no hay nada abierto, el estado es el tramo del ciclo de vida
 *       → un viaje sin novedades no está «sin estado»: está en recorrido, o
 *          en zona de origen, o esperando su hora.
 */

/**
 * ⚠️ POR QUÉ «PEGAJOSA» Y NO «SI EL CÓDIGO ES SOS».
 *
 * La regla obvia era comparar el tipo contra el código del pánico. Se rompe de
 * dos maneras, las dos silenciosas:
 *
 * (El código no se escribe ni acá: una afirmación del ZIP comprueba que no
 * aparezca en este archivo, y la prosa que lo nombrara la haría fallar. Es la
 * quinta vez en la serie que un comentario explicando la corrección hace fallar
 * la comprobación de la corrección.)
 *
 *  · `motor_niveles_riesgo.tenant_id` es NULLABLE a propósito — un cliente
 *    puede agregar un nivel con orden 50 y dejar al SOS (orden 40) segundo.
 *    Con una regla por orden a secas, un pánico quedaría tapado.
 *  · Mañana hay otra condición que sólo cierra una persona, y nadie se acuerda
 *    de sumarla al `if`.
 *
 * `resolucionManual` sale del catálogo y responde a la pregunta correcta: «¿el
 * motor puede cerrar esto solo?». Si no puede, tampoco puede dejar de
 * mostrarlo.
 */
const esPegajosa = (c: CondicionAbierta): boolean => c.resolucionManual;

/**
 * La más grave de una lista. Empate de gravedad → la que empezó ANTES.
 *
 * El desempate no es un capricho: sin él, dos condiciones del mismo riesgo se
 * alternarían según el orden en que la consulta las devuelva, y cada vuelta
 * del worker escribiría una transición falsa. El historial se llenaría de
 * cambios que no ocurrieron.
 */
function laMasGrave(condiciones: CondicionAbierta[]): CondicionAbierta | null {
  let elegida: CondicionAbierta | null = null;
  for (const c of condiciones) {
    if (elegida === null) { elegida = c; continue; }
    if (c.ordenRiesgo > elegida.ordenRiesgo) { elegida = c; continue; }
    if (c.ordenRiesgo === elegida.ordenRiesgo && c.inicio < elegida.inicio) elegida = c;
  }
  return elegida;
}

/** El estado de seguimiento que corresponde a esta situación. */
export function derivarEstadoSeguimiento(entrada: EntradaSeguimiento): EstadoSeguimiento {
  const { condicionesAbiertas, declaracion, etapa, riesgoNeutro } = entrada;

  const deCondicion = (c: CondicionAbierta, motivo: string): EstadoSeguimiento => ({
    estado: c.tipo,
    estadoOrigen: 'condicion',
    riesgo: c.riesgo,
    ordenRiesgo: c.ordenRiesgo,
    origen: 'deducido',
    condicionId: c.id,
    vigenteDesde: c.inicio,
    motivo,
  });

  // ── 1 · Lo que sólo cierra una persona no lo puede tapar nada ────────────
  const pegajosas = condicionesAbiertas.filter(esPegajosa);
  const pegajosa = laMasGrave(pegajosas);
  if (pegajosa) {
    return deCondicion(
      pegajosa,
      `${pegajosa.tipo} está abierta y sólo la cierra un operador: ningún otro estado la reemplaza.`,
    );
  }

  const masGrave = laMasGrave(condicionesAbiertas);

  // ── 2 y 3 · La declaración del operador, salvo algo estrictamente peor ───
  if (declaracion) {
    const laPisaAlgoPeor = masGrave !== null && masGrave.ordenRiesgo > declaracion.ordenRiesgo;
    if (!laPisaAlgoPeor) {
      return {
        estado: declaracion.tipo,
        estadoOrigen: 'condicion',
        riesgo: declaracion.riesgo,
        ordenRiesgo: declaracion.ordenRiesgo,
        origen: 'manual',
        condicionId: null,
        vigenteDesde: declaracion.desde,
        motivo: `Declarado por un operador${declaracion.nota ? `: ${declaracion.nota}` : '.'}`,
      };
    }
    return deCondicion(
      masGrave as CondicionAbierta,
      `${(masGrave as CondicionAbierta).tipo} es más grave que el estado declarado ` +
        `(${declaracion.tipo}), así que el motor lo pisa.`,
    );
  }

  // ── 4 · Nada abierto: el estado es el tramo del viaje ────────────────────
  if (masGrave) {
    return deCondicion(masGrave, `Es la condición abierta de mayor riesgo (${masGrave.riesgo}).`);
  }

  return {
    estado: etapa.codigo,
    estadoOrigen: 'ciclo_vida',
    riesgo: riesgoNeutro.codigo,
    ordenRiesgo: riesgoNeutro.orden,
    origen: 'deducido',
    condicionId: null,
    // Sin condiciones no hay un momento de inicio propio: el estado vale desde
    // que el viaje entró en esta etapa. La fecha entra por parámetro — acá no
    // se puede leer el reloj sin volver impura la función.
    vigenteDesde: etapa.desde,
    motivo: 'Sin condiciones abiertas: el estado es el tramo del ciclo de vida.',
  };
}

/** Lo que la máquina necesita saber del código que el operador quiere declarar. */
export interface IntentoDeclaracion {
  tipo: string;
  ordenRiesgo: number;
  /** `motor_tipos_condicion.declarable_por_operador`. */
  declarablePorOperador: boolean;
  /** `motor_tipos_condicion.is_active`, y que el código exista. */
  activoEnCatalogo: boolean;
}

/**
 * ¿Se puede declarar este estado a mano?
 *
 * ⚠️ CADA `false` VIENE CON SU MOTIVO, Y NO ES CORTESÍA. La etapa exige que
 * una transición inválida no se descarte en silencio: se registra el intento
 * con el motivo. Sin un motivo escrito acá, la fila del historial no se puede
 * ni escribir — el CHECK de la base la rechaza.
 *
 * Las cuatro reglas están ordenadas de la más barata a la más cara, y de la
 * más específica a la más general: el primer `false` es el que mejor explica
 * qué pasó.
 */
export function validarDeclaracionManual(
  intento: IntentoDeclaracion,
  entrada: EntradaSeguimiento,
): Veredicto {
  if (!intento.activoEnCatalogo) {
    return {
      valida: false,
      motivo:
        `El código "${intento.tipo}" no existe o está inactivo en el catálogo de ` +
        'condiciones. No se inventa vocabulario: se declara lo que el catálogo tiene.',
    };
  }

  if (!intento.declarablePorOperador) {
    return {
      valida: false,
      motivo:
        `"${intento.tipo}" existe en el catálogo pero no es declarable por un ` +
        'operador. Hay condiciones que abre el motor o el conductor, no el panel.',
    };
  }

  if (entrada.etapa.esTerminal) {
    return {
      valida: false,
      motivo:
        `El viaje está en "${entrada.etapa.codigo}", que es un estado terminal. ` +
        'Un viaje cerrado no cambia de estado de seguimiento.',
    };
  }

  // ⚠️ Ésta es la regla que hace que un operador no pueda tapar un pánico, sin
  // que este archivo sepa que el pánico se llama SOS.
  const pegajosa = laMasGrave(entrada.condicionesAbiertas.filter(esPegajosa));
  if (pegajosa) {
    return {
      valida: false,
      motivo:
        `Hay una condición abierta que sólo puede cerrar un operador ` +
        `("${pegajosa.tipo}", riesgo ${pegajosa.riesgo}). Primero se cierra esa; ` +
        'declarar otro estado la ocultaría sin resolverla.',
    };
  }

  const masGrave = laMasGrave(entrada.condicionesAbiertas);
  if (masGrave && masGrave.ordenRiesgo > intento.ordenRiesgo) {
    return {
      valida: false,
      motivo:
        `Hay una condición más grave abierta ("${masGrave.tipo}", riesgo ` +
        `${masGrave.riesgo}) que el estado que se quiere declarar ("${intento.tipo}"). ` +
        'El estado declarado no la puede tapar.',
    };
  }

  return { valida: true };
}

/** ¿Se puede levantar el estado declarado? */
export function validarLevantar(entrada: EntradaSeguimiento): Veredicto {
  if (!entrada.declaracion) {
    return {
      valida: false,
      motivo: 'No hay un estado declarado a mano que levantar en este viaje.',
    };
  }
  return { valida: true };
}

/**
 * ¿Cambió algo entre dos estados?
 *
 * ⚠️ Se compara por CÓDIGO Y ORIGEN, no por objeto. El worker deriva el estado
 * en cada vuelta y la enorme mayoría de las veces da lo mismo que la anterior:
 * sin esta comparación, cada punto escribiría una fila de historial idéntica a
 * la previa y la línea de tiempo del operador quedaría inservible.
 *
 * `vigenteDesde` NO entra en la comparación a propósito: la misma condición
 * sigue siendo el mismo estado aunque se recalcule.
 */
export function huboCambio(
  anterior: EstadoSeguimiento | null,
  nuevo: EstadoSeguimiento,
): boolean {
  if (anterior === null) return true;
  return (
    anterior.estado !== nuevo.estado ||
    anterior.origen !== nuevo.origen ||
    anterior.estadoOrigen !== nuevo.estadoOrigen
  );
}
