import { create } from 'zustand';
import { API_URL } from '../services/api';
import { mensajeDeError } from '../services/avisos';
import type { Aviso } from './campanaStore';

/** Un paso del protocolo, tal como sale del catálogo de la base. */
export interface Paso {
  id: string;
  orden: number;
  accion: string;
}

/** Una opción de resultado. `habilita_escalada` sale de la columna. */
export interface Resultado {
  codigo: string;
  nombre: string;
  orden: number;
  habilita_escalada: boolean;
}

export interface Destino {
  usuario_id: string;
  nombre: string | null;
  email: string;
  role_code: string;
  nivel_jerarquico: number;
}

export interface Protocolo {
  existe: boolean;
  cerrada?: boolean;
  tipo_condicion?: string;
  pasos: Paso[];
  resultados: Resultado[];
  propio_del_cliente?: boolean;
  /** ⚠️ El MOTIVO, no un booleano: la pantalla lo muestra tal cual. */
  motivo_sin_permiso_critica?: string | null;
  puede_cerrar?: boolean;
  destino_de_escalada?: Destino | null;
}

export interface Entrada {
  id: string;
  accion: 'registro' | 'escalada' | 'cierre';
  usuario_nombre: string | null;
  paso_accion: string | null;
  resultado_codigo: string | null;
  resultado_nombre: string | null;
  nota: string | null;
  escalado_a_nombre: string | null;
  created_at: string;
}

interface BitacoraState {
  abierta: Aviso | null;
  protocolo: Protocolo | null;
  hilo: Entrada[];
  cargando: boolean;
  guardando: boolean;
  error: string | null;

  abrir: (aviso: Aviso) => Promise<void>;
  cerrarModal: () => void;
  recargarHilo: () => Promise<void>;
  registrar: (entrada: { paso_id?: string; resultado_codigo?: string; nota?: string }) => Promise<boolean>;
  escalar: (nota: string) => Promise<boolean>;
  cerrarAlerta: (motivo: string) => Promise<boolean>;
}

const token = () => localStorage.getItem('rusertech_token');
const cabeceras = () => ({
  Authorization: `Bearer ${token()}`,
  'Content-Type': 'application/json',
});

/**
 * LA BITÁCORA, desde el navegador.
 *
 * ⚠️ EL HILO SE RECARGA DESPUÉS DE CADA ESCRITURA, no se arma en memoria.
 * Es la misma razón que en la campana: la base es la verdad. Si otro operador
 * registró una entrada entre medio, esta pantalla tiene que verla — y armar
 * el hilo localmente lo escondería hasta la próxima recarga completa.
 */
export const useBitacoraStore = create<BitacoraState>((set, get) => ({
  abierta: null,
  protocolo: null,
  hilo: [],
  cargando: false,
  guardando: false,
  error: null,

  abrir: async (aviso) => {
    set({ abierta: aviso, cargando: true, error: null, protocolo: null, hilo: [] });
    try {
      const q = `?fuente=${aviso.fuente}`;
      const [protoRes, hiloRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/bitacora/${aviso.id}/protocolo${q}`, { headers: cabeceras() }),
        fetch(`${API_URL}/api/v1/bitacora/${aviso.id}/hilo${q}`, { headers: cabeceras() }),
      ]);
      if (!protoRes.ok) {
        set({ error: mensajeDeError(protoRes.status, await protoRes.text()), cargando: false });
        return;
      }
      const protocolo = (await protoRes.json()) as Protocolo;
      const hilo = hiloRes.ok ? ((await hiloRes.json()) as Entrada[]) : [];
      set({ protocolo, hilo: Array.isArray(hilo) ? hilo : [], cargando: false });
    } catch (e) {
      set({ error: (e as Error).message, cargando: false });
    }
  },

  cerrarModal: () => set({ abierta: null, protocolo: null, hilo: [], error: null }),

  recargarHilo: async () => {
    const aviso = get().abierta;
    if (!aviso) return;
    try {
      const res = await fetch(
        `${API_URL}/api/v1/bitacora/${aviso.id}/hilo?fuente=${aviso.fuente}`,
        { headers: cabeceras() },
      );
      if (res.ok) set({ hilo: (await res.json()) as Entrada[] });
    } catch {
      // Un hilo que no se pudo refrescar no borra el que ya está en pantalla:
      // mostrar menos de lo que se sabe es peor que mostrarlo desactualizado.
    }
  },

  /**
   * Registrar. Es lo que antes era «Atender» — y sigue apagando el sonido,
   * pero ahora exige decir qué se hizo.
   */
  registrar: async (entrada) => {
    const aviso = get().abierta;
    if (!aviso) return false;
    set({ guardando: true, error: null });
    try {
      const res = await fetch(`${API_URL}/api/v1/campana/${aviso.id}/atender`, {
        method: 'PUT',
        headers: cabeceras(),
        body: JSON.stringify({ fuente: aviso.fuente, ...entrada }),
      });
      if (!res.ok) {
        // ⚠️ El motivo del servidor se muestra tal cual. «No se pudo
        // registrar» a secas dejaría al operador probando otra vez sin saber
        // que le falta elegir un resultado.
        set({ error: mensajeDeError(res.status, await res.text()), guardando: false });
        return false;
      }
      await get().recargarHilo();
      set({ guardando: false });
      return true;
    } catch (e) {
      set({ error: (e as Error).message, guardando: false });
      return false;
    }
  },

  escalar: async (nota) => {
    const aviso = get().abierta;
    if (!aviso) return false;
    set({ guardando: true, error: null });
    try {
      const res = await fetch(`${API_URL}/api/v1/bitacora/${aviso.id}/escalar`, {
        method: 'POST',
        headers: cabeceras(),
        body: JSON.stringify({ fuente: aviso.fuente, nota }),
      });
      if (!res.ok) {
        set({ error: mensajeDeError(res.status, await res.text()), guardando: false });
        return false;
      }
      await get().recargarHilo();
      set({ guardando: false });
      return true;
    } catch (e) {
      set({ error: (e as Error).message, guardando: false });
      return false;
    }
  },

  cerrarAlerta: async (motivo) => {
    const aviso = get().abierta;
    if (!aviso) return false;
    set({ guardando: true, error: null });
    try {
      const res = await fetch(`${API_URL}/api/v1/bitacora/${aviso.id}/cerrar`, {
        method: 'POST',
        headers: cabeceras(),
        body: JSON.stringify({ fuente: aviso.fuente, motivo }),
      });
      if (!res.ok) {
        set({ error: mensajeDeError(res.status, await res.text()), guardando: false });
        return false;
      }
      await get().recargarHilo();
      set({ guardando: false });
      return true;
    } catch (e) {
      set({ error: (e as Error).message, guardando: false });
      return false;
    }
  },
}));
