import { create } from 'zustand';
import { escribir, type Resultado } from '../services/avisos';
import { API_URL } from '../services/api';

interface Vehicle {
  id: string;
  tenant_id: string;
  plate: string;
  alias: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  vehicle_type: string;
  fuel_type: string;
  hub_asset_id: string | null;
  dictionary_category?: string | null;
  is_blocked: boolean;
  block_reason: string | null;
  status: string;
  avl_user?: { name: string; user_avl_code: string };
  lastPosition?: any;
}

interface VehiclesState {
  vehicles: Vehicle[];
  loading: boolean;
  error: string | null;
  fetchVehicles: () => Promise<void>;
  // Devuelven `Resultado` y no `void`: la pantalla necesita saber si salió
  // bien para decidir si cierra el modal. Cerrarlo igual es lo que hacía
  // creer al operador que había guardado.
  createVehicle: (data: Partial<Vehicle>) => Promise<Resultado>;
  updateVehicle: (id: string, data: Partial<Vehicle>) => Promise<Resultado>;
  deleteVehicle: (id: string) => Promise<Resultado>;
  toggleBlock: (id: string, blocked: boolean, reason?: string) => Promise<Resultado>;
}

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`,
});

export const useVehiclesStore = create<VehiclesState>((set, get) => ({
  vehicles: [],
  loading: false,
  error: null,

  fetchVehicles: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/api/v1/vehicles`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch vehicles');
      const data = await res.json();
      set({ vehicles: data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  createVehicle: async (data) => {
    // Antes: `res.text()` + un `alert` del navegador. El operador veía el JSON crudo del
    // backend en una ventana del navegador, y un alta exitosa no avisaba nada.
    const r = await escribir(
      () => fetch(`${API_URL}/api/v1/vehicles`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
      }),
      'Vehículo creado.',
    );
    if (r.ok) await get().fetchVehicles();
    return r;
  },

  updateVehicle: async (id, data) => {
    const r = await escribir(
      () => fetch(`${API_URL}/api/v1/vehicles/${id}`, {
        method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data),
      }),
      'Vehículo actualizado.',
    );
    if (r.ok) await get().fetchVehicles();
    return r;
  },

  deleteVehicle: async (id) => {
    // Éste era el único de su store que fallaba MUDO: ni siquiera un alert.
    const r = await escribir(
      () => fetch(`${API_URL}/api/v1/vehicles/${id}`, {
        method: 'DELETE', headers: getAuthHeaders(),
      }),
      'Vehículo eliminado.',
    );
    if (r.ok) await get().fetchVehicles();
    return r;
  },

  toggleBlock: async (id, blocked, reason) => {
    const r = await escribir(
      () => fetch(`${API_URL}/api/v1/vehicles/${id}/block`, {
        method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ blocked, reason }),
      }),
      blocked ? 'Vehículo bloqueado.' : 'Vehículo desbloqueado.',
    );
    if (r.ok) await get().fetchVehicles();
    return r;
  },
}));
