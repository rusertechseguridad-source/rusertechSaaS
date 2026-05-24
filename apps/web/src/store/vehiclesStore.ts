import { create } from 'zustand';

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
  createVehicle: (data: Partial<Vehicle>) => Promise<void>;
  updateVehicle: (id: string, data: Partial<Vehicle>) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  toggleBlock: (id: string, blocked: boolean, reason?: string) => Promise<void>;
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
      const res = await fetch('http://localhost:3000/api/v1/vehicles', {
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
    try {
      const res = await fetch('http://localhost:3000/api/v1/vehicles', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Error al crear vehículo');
      }
      await get().fetchVehicles();
    } catch (error: any) {
      console.error(error);
      alert('Error al crear vehículo: ' + error.message);
    }
  },

  updateVehicle: async (id, data) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/vehicles/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Error al actualizar vehículo');
      }
      await get().fetchVehicles();
    } catch (error: any) {
      console.error(error);
      alert('Error al actualizar vehículo: ' + error.message);
    }
  },

  deleteVehicle: async (id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/vehicles/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete vehicle');
      await get().fetchVehicles();
    } catch (error: any) {
      console.error(error);
    }
  },

  toggleBlock: async (id, blocked, reason) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/vehicles/${id}/block`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ blocked, reason }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Error al cambiar estado de bloqueo');
      }
      
      // Re-fetch to get the updated state from server
      await get().fetchVehicles();
    } catch (error: any) {
      console.error(error);
      alert('Error al cambiar estado de bloqueo: ' + error.message);
    }
  },
}));
