import { create } from 'zustand';
import { escribir, type Resultado } from '../services/avisos';

interface Location {
  id: string;
  name: string;
  address: string | null;
  location_type: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
  notes: string | null;
  operation_id?: string | null;
  is_authorized_stop?: boolean;
  operation?: { name: string } | null;
}

interface LocationsState {
  locations: Location[];
  loading: boolean;
  error: string | null;
  fetchLocations: () => Promise<void>;
  createLocation: (data: Partial<Location>) => Promise<Resultado>;
  updateLocation: (id: string, data: Partial<Location>) => Promise<Resultado>;
  deleteLocation: (id: string) => Promise<Resultado>;
  toggleActive: (id: string, isActive: boolean) => Promise<Resultado>;
}

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`,
});

export const useLocationsStore = create<LocationsState>((set, get) => ({
  locations: [],
  loading: false,
  error: null,

  fetchLocations: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('http://localhost:3000/api/v1/locations', {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch locations');
      const data = await res.json();
      set({ locations: data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  createLocation: async (data) => {
    const r = await escribir(
      () => fetch('http://localhost:3000/api/v1/locations', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }),
      'Ubicación creada.',
    );
    if (r.ok) await get().fetchLocations();
    return r;
  },

  updateLocation: async (id, data) => {
    const r = await escribir(
      () => fetch(`http://localhost:3000/api/v1/locations/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }),
      'Ubicación actualizada.',
    );
    if (r.ok) await get().fetchLocations();
    return r;
  },

  deleteLocation: async (id) => {
    const r = await escribir(
      () => fetch(`http://localhost:3000/api/v1/locations/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }),
      'Ubicación eliminada.',
    );
    if (r.ok) await get().fetchLocations();
    return r;
  },

  toggleActive: async (id, isActive) => {
    const r = await escribir(
      () => fetch(`http://localhost:3000/api/v1/locations/${id}/toggle`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: isActive }),
      }),
      'Estado actualizado.',
    );
    if (r.ok) await get().fetchLocations();
    return r;
  },
}));
