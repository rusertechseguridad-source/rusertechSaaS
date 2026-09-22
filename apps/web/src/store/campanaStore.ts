import { create } from 'zustand';
import { API_URL } from '../services/api';
import { mensajeDeError } from '../services/avisos';
import { sonido, tituloParpadeante } from '../services/sonido';

/** Lo que manda el backend. Mismo contrato que `AvisoDespacho`. */
export interface Aviso {
  fuente: 'condicion' | 'evento';
  id: string;
  tenant_id: string;
  vehicle_id: string;
  trip_id: string | null;
  tipo: string;
  titulo: string;
  nivel_riesgo: string | null;
  color: string;
  interrumpe: boolean;
  requiere_atencion: boolean;
  clasificado: boolean;
  ocurrio_at: string;
  patente: string | null;
  latitud: number | null;
  longitud: number | null;
  direccion: string | null;
  disparador: string | null;
  /** Local: quién la atendió, cuando el aviso llega por el flujo. */
  atendida_por_nombre?: string | null;
  /** Local: se cerró sola mientras la pantalla estaba abierta. */
  resuelta?: boolean;
}

export type EstadoConexion = 'conectando' | 'en_vivo' | 'cortada';

interface CampanaState {
  avisos: Aviso[];
  conexion: EstadoConexion;
  /** Último latido recibido. Si envejece, la conexión está muerta aunque parezca viva. */
  ultimoLatido: number | null;
  cargando: boolean;
  error: string | null;
  panelAbierto: boolean;

  cargarPendientes: () => Promise<void>;
  conectar: () => void;
  desconectar: () => void;
  atender: (aviso: Aviso, nota?: string) => Promise<boolean>;
  abrirPanel: (abierto: boolean) => void;
}

const token = () => localStorage.getItem('rusertech_token');

/** Las que interrumpen y nadie atendió todavía. */
export const criticasVivas = (avisos: Aviso[]): Aviso[] =>
  avisos.filter((a) => a.interrumpe && !a.atendida_por_nombre && !a.resuelta);

/** Todo lo que cuenta para el número de la campana. */
export const pendientesVisibles = (avisos: Aviso[]): Aviso[] =>
  avisos.filter((a) => !a.atendida_por_nombre && !a.resuelta);

let lector: AbortController | null = null;
let reintento: ReturnType<typeof setTimeout> | null = null;
let esperaMs = 1000;

export const useCampanaStore = create<CampanaState>((set, get) => ({
  avisos: [],
  conexion: 'conectando',
  ultimoLatido: null,
  cargando: false,
  error: null,
  panelAbierto: false,

  abrirPanel: (abierto) => set({ panelAbierto: abierto }),

  /**
   * ⚠️ ESTO ES LA CAMPANA. El flujo es sólo el empujón.
   *
   * Se llama al entrar y en CADA reconexión, y es lo que cumple la regla dura:
   * si el navegador estuvo cerrado, si se cortó la conexión, si el operador
   * recargó — al volver ve todo lo pendiente, porque sale de la base y no de
   * lo que se haya alcanzado a empujar.
   */
  cargarPendientes: async () => {
    set({ cargando: true, error: null });
    try {
      const res = await fetch(`${API_URL}/api/v1/campana/pendientes`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) {
        set({ error: mensajeDeError(res.status, await res.text()), cargando: false });
        return;
      }
      const datos = (await res.json()) as Aviso[];
      // Se REEMPLAZA la lista, no se mezcla: la base es la verdad. Si algo se
      // atendió desde otra pantalla mientras esta estaba cerrada, tiene que
      // desaparecer de acá, y mezclando quedaría para siempre.
      set({ avisos: Array.isArray(datos) ? datos : [], cargando: false });
      sincronizarAlarma(get().avisos);
    } catch (e) {
      set({ error: (e as Error).message, cargando: false });
    }
  },

  /**
   * Abre el flujo en vivo.
   *
   * ⚠️ NO SE USA `EventSource`, y no es capricho: ese cliente **no puede mandar
   * el encabezado `Authorization`**. Las alternativas eran meter el token en la
   * dirección —donde queda escrito en los registros de todo proxy intermedio—
   * o leer el flujo con `fetch`, que sí manda encabezados. Es lo que se hace
   * acá, a costa de escribir a mano el troceado de los mensajes.
   */
  conectar: () => {
    get().desconectar();
    const control = new AbortController();
    lector = control;
    set({ conexion: 'conectando' });

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/campana/flujo`, {
          headers: { Authorization: `Bearer ${token()}`, Accept: 'text/event-stream' },
          signal: control.signal,
        });
        if (!res.ok || !res.body) throw new Error(`flujo no disponible (${res.status})`);

        set({ conexion: 'en_vivo', ultimoLatido: Date.now() });
        esperaMs = 1000;
        // Al (re)conectar se vuelve a pedir la lista: lo que haya pasado
        // durante el corte no viajó por el flujo, pero está en la base.
        await get().cargarPendientes();

        const decodificador = new TextDecoder();
        const lectura = res.body.getReader();
        let resto = '';

        for (;;) {
          const { value, done } = await lectura.read();
          if (done) break;
          resto += decodificador.decode(value, { stream: true });
          // Un mensaje termina en línea en blanco. El resto queda para la
          // vuelta siguiente: un trozo puede cortar un mensaje por la mitad.
          const partes = resto.split('\n\n');
          resto = partes.pop() ?? '';
          for (const parte of partes) manejar(parte, set, get);
        }
        throw new Error('el flujo se cerró');
      } catch (e) {
        if (control.signal.aborted) return;
        set({ conexion: 'cortada' });
        // Espera creciente con tope: reintentar cada 100 ms contra un servidor
        // caído es una forma de tirarlo cuando vuelve.
        esperaMs = Math.min(esperaMs * 2, 30000);
        reintento = setTimeout(() => get().conectar(), esperaMs);
      }
    })();
  },

  desconectar: () => {
    if (reintento) { clearTimeout(reintento); reintento = null; }
    if (lector) { lector.abort(); lector = null; }
    sonido.detenerRepeticion();
    tituloParpadeante.parar();
  },

  /**
   * Atender. Lo que apaga el sonido EN TODAS las pantallas.
   *
   * La pantalla no se adelanta a la respuesta: se marca cuando el servidor
   * confirma. Si dos operadores tocan a la vez, el servidor dice cuál de los
   * dos quedó anotado y las dos pantallas muestran el mismo nombre.
   */
  atender: async (aviso, nota) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/campana/${aviso.id}/atender`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fuente: aviso.fuente, nota }),
      });
      if (!res.ok) {
        set({ error: mensajeDeError(res.status, await res.text()) });
        return false;
      }
      const datos = (await res.json()) as { atendida_por_nombre: string | null };
      set((s) => ({
        avisos: s.avisos.map((a) =>
          a.id === aviso.id && a.fuente === aviso.fuente
            ? { ...a, atendida_por_nombre: datos.atendida_por_nombre ?? 'otro operador' }
            : a,
        ),
      }));
      sincronizarAlarma(get().avisos);
      return true;
    } catch (e) {
      set({ error: (e as Error).message });
      return false;
    }
  },
}));

/** Trocea un mensaje del flujo y lo aplica. */
function manejar(
  bruto: string,
  set: (fn: (s: CampanaState) => Partial<CampanaState>) => void,
  get: () => CampanaState,
): void {
  let tipo = 'message';
  const datos: string[] = [];
  for (const linea of bruto.split('\n')) {
    if (linea.startsWith('event:')) tipo = linea.slice(6).trim();
    else if (linea.startsWith('data:')) datos.push(linea.slice(5).trim());
  }
  if (datos.length === 0) return;

  let cuerpo: any;
  try {
    cuerpo = JSON.parse(datos.join('\n'));
  } catch {
    // Un mensaje ilegible no puede tumbar el flujo entero: se descarta y se
    // sigue. La lista completa sigue saliendo de la base.
    return;
  }

  if (tipo === 'latido') {
    set(() => ({ ultimoLatido: Date.now(), conexion: 'en_vivo' }));
    return;
  }

  if (tipo === 'nuevo') {
    const aviso = cuerpo as Aviso;
    set((s) => {
      // ⚠️ La misma alerta puede llegar por el flujo Y estar en la lista que
      // se pidió al conectar. Se deduplica por (fuente, id) — el mismo par que
      // usa el backend— o la campana contaría doble.
      const yaEsta = s.avisos.some((a) => a.id === aviso.id && a.fuente === aviso.fuente);
      return yaEsta ? {} : { avisos: [aviso, ...s.avisos] };
    });
    if (aviso.interrumpe) sonido.repetirCritico();
    else sonido.sonar('menor');
    sincronizarAlarma(get().avisos);
    return;
  }

  if (tipo === 'atendido') {
    const { id, fuente, atendida_por_nombre } = cuerpo as {
      id: string; fuente: string; atendida_por_nombre: string | null;
    };
    set((s) => ({
      avisos: s.avisos.map((a) =>
        a.id === id && a.fuente === fuente
          ? { ...a, atendida_por_nombre: atendida_por_nombre ?? 'otro operador' }
          : a,
      ),
    }));
    sincronizarAlarma(get().avisos);
    return;
  }

  if (tipo === 'resuelto') {
    const { id, fuente } = cuerpo as { id: string; fuente: string };
    // Se marca resuelta pero NO se borra: el encargo pide que el operador
    // pueda ver que pasó. Sale de la cuenta y del sonido, queda en la lista.
    set((s) => ({
      avisos: s.avisos.map((a) =>
        a.id === id && a.fuente === fuente ? { ...a, resuelta: true } : a,
      ),
    }));
    sincronizarAlarma(get().avisos);
  }
}

/**
 * El sonido y el título siguen a la LISTA, no a los eventos sueltos.
 *
 * ⚠️ Es la diferencia entre «suena cuando llega una crítica» y «suena mientras
 * haya una crítica sin atender». Atada a los eventos, una alerta que llega
 * mientras el operador atiende otra dejaría la alarma en un estado que no
 * corresponde a lo que hay en pantalla.
 */
export function sincronizarAlarma(avisos: Aviso[]): void {
  const criticas = criticasVivas(avisos);
  if (criticas.length > 0) {
    sonido.repetirCritico();
    tituloParpadeante.empezar(`🔴 ${criticas.length} alerta${criticas.length > 1 ? 's' : ''}`);
  } else {
    sonido.detenerRepeticion();
    tituloParpadeante.parar();
  }
}
