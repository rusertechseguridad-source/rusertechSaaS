/**
 * ══════════════════════════════════════════════════════════════════════════
 * EL SONIDO DE LAS ALERTAS — generado, no descargado
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ LO QUE ROMPE EN EL NAVEGADOR REAL, Y POR QUÉ ESTE ARCHIVO EXISTE.
 *
 * Todos los navegadores modernos **bloquean el audio hasta que la persona
 * interactúa con la página**. La llamada a `play()` no tira una excepción
 * visible: devuelve una promesa rechazada que nadie mira, y el `AudioContext`
 * nace en estado `suspended`. O sea: **falla en silencio**. Una alerta crítica
 * que confía en que va a sonar sola, en la práctica no suena — y el operador
 * no tiene forma de enterarse de que no está sonando.
 *
 * Por eso hay un gesto explícito: `activar()` se llama desde el clic de un
 * botón, y la pantalla muestra siempre si el sonido está activo. Un botón
 * ausente es indistinguible de una función que no existe; un sonido apagado
 * que se cree encendido es peor todavía.
 *
 * ⚠️ NO SE DESCARGA NINGÚN ARCHIVO. Los dos tonos se sintetizan con Web Audio:
 * sin dependencias de terceros, sin un `.mp3` que pueda faltar en el
 * despliegue, sin una petición de red entre el hecho y el aviso.
 */

/** Cómo suena cada clase de aviso. */
export type ClaseDeSonido = 'critico' | 'menor';

/** Cada cuánto se repite el tono crítico mientras nadie atienda. */
export const REPETICION_CRITICA_MS = 4000;

/**
 * Los dos tonos.
 *
 * ⚠️ TIENEN QUE SONAR DISTINTO SIN MIRAR LA PANTALLA. El crítico son dos notas
 * que alternan —el intervalo que el oído lee como urgencia—; el menor es una
 * sola nota corta y más aguda. Si los dos fueran un pitido igual, el operador
 * tendría que mirar para saber cuál es, y entonces el sonido no estaría
 * haciendo su trabajo.
 */
const TONOS: Record<ClaseDeSonido, { frecuencias: number[]; duracion: number; volumen: number }> = {
  critico: { frecuencias: [880, 622, 880, 622], duracion: 0.22, volumen: 0.18 },
  menor: { frecuencias: [1320], duracion: 0.12, volumen: 0.09 },
};

const CLAVE_SILENCIO = 'rusertech_campana_silencio';

type Oyente = () => void;

class Sonido {
  private contexto: AudioContext | null = null;
  private repeticion: ReturnType<typeof setInterval> | null = null;
  private readonly oyentes = new Set<Oyente>();

  /** ¿El navegador ya nos dejó sonar? */
  get activo(): boolean {
    return this.contexto !== null && this.contexto.state === 'running';
  }

  /**
   * ¿Silenciado por esta persona?
   *
   * ⚠️ Silenciar NO oculta el aviso rojo. Es una regla del encargo y tiene
   * sentido: quien silencia está diciendo «no me hagas ruido», no «no me
   * cuentes lo que pasa».
   */
  get silenciado(): boolean {
    try {
      return localStorage.getItem(CLAVE_SILENCIO) === '1';
    } catch {
      // Un navegador con el almacenamiento bloqueado no es un navegador sin
      // sonido: ante la duda, que suene.
      return false;
    }
  }

  set silenciado(valor: boolean) {
    try {
      if (valor) localStorage.setItem(CLAVE_SILENCIO, '1');
      else localStorage.removeItem(CLAVE_SILENCIO);
    } catch {
      /* Sin almacenamiento la preferencia dura lo que la pestaña. */
    }
    if (valor) this.detenerRepeticion();
    this.avisar();
  }

  /** Para que la pantalla se entere de que el estado cambió. */
  suscribir(oyente: Oyente): () => void {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  }

  /**
   * EL GESTO. Se llama desde el clic de un botón, nunca sola.
   *
   * Devuelve si quedó activo, para que la pantalla diga la verdad en vez de
   * suponer que funcionó.
   */
  async activar(): Promise<boolean> {
    try {
      const Constructor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) return false;

      if (!this.contexto) this.contexto = new Constructor();
      // `resume()` es lo que consume el gesto. Sin él, el contexto se queda en
      // `suspended` y todo lo que se programe no se oye.
      if (this.contexto.state === 'suspended') await this.contexto.resume();

      // Un tono muy corto y muy bajo: confirma con el oído que quedó andando.
      this.tono(1046, 0.06, 0.04);
      this.avisar();
      return this.activo;
    } catch {
      return false;
    }
  }

  /** Suena una vez. El menor usa esto y nada más. */
  sonar(clase: ClaseDeSonido): void {
    if (!this.activo || this.silenciado) return;
    const { frecuencias, duracion, volumen } = TONOS[clase];
    frecuencias.forEach((f, i) => {
      window.setTimeout(() => this.tono(f, duracion, volumen), i * duracion * 1000);
    });
  }

  /**
   * Suena y SIGUE SONANDO hasta que alguien lo detenga.
   *
   * ⚠️ Es la diferencia entre una alerta crítica y una menor, y es lo que
   * pidió el encargo: «se repite hasta que alguien la atienda». Un pitido
   * único a las tres de la mañana lo pierde cualquiera.
   */
  repetirCritico(): void {
    if (this.repeticion !== null) return;
    this.sonar('critico');
    this.repeticion = setInterval(() => this.sonar('critico'), REPETICION_CRITICA_MS);
  }

  /** Lo llama la pantalla cuando ya no queda ninguna crítica sin atender. */
  detenerRepeticion(): void {
    if (this.repeticion === null) return;
    clearInterval(this.repeticion);
    this.repeticion = null;
  }

  /** ¿Está repitiendo ahora mismo? Lo usa la prueba y el indicador. */
  get repitiendo(): boolean {
    return this.repeticion !== null;
  }

  private tono(frecuencia: number, segundos: number, volumen: number): void {
    const ctx = this.contexto;
    if (!ctx) return;
    const oscilador = ctx.createOscillator();
    const ganancia = ctx.createGain();
    oscilador.type = 'sine';
    oscilador.frequency.value = frecuencia;
    // La envolvente evita el chasquido de cortar una onda de golpe, que se oye
    // como un defecto del equipo y no como una alerta.
    const ahora = ctx.currentTime;
    ganancia.gain.setValueAtTime(0, ahora);
    ganancia.gain.linearRampToValueAtTime(volumen, ahora + 0.01);
    ganancia.gain.linearRampToValueAtTime(0, ahora + segundos);
    oscilador.connect(ganancia);
    ganancia.connect(ctx.destination);
    oscilador.start(ahora);
    oscilador.stop(ahora + segundos + 0.02);
  }

  private avisar(): void {
    for (const o of this.oyentes) o();
  }
}

/** Uno solo por pestaña: dos contextos de audio serían dos alarmas. */
export const sonido = new Sonido();

/**
 * EL TÍTULO DE LA PESTAÑA, PARPADEANDO.
 *
 * Para el operador que está en otra pestaña. Es la única señal que atraviesa
 * el foco del navegador sin permisos especiales.
 */
class TituloParpadeante {
  private original: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  empezar(texto: string): void {
    if (this.timer !== null) return;
    this.original = document.title;
    let encendido = false;
    this.timer = setInterval(() => {
      document.title = encendido ? (this.original ?? '') : texto;
      encendido = !encendido;
    }, 1000);
  }

  parar(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
    if (this.original !== null) document.title = this.original;
  }

  get activo(): boolean {
    return this.timer !== null;
  }
}

export const tituloParpadeante = new TituloParpadeante();
