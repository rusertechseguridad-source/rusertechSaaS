import { create } from 'zustand';

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
}

interface LocationsState {
  locations: Location[];
  loading: boolean;
  error: string | null;
  fetchLocations: () => Promise<void>;
  createLocation: (data: Partial<Location>) => Promise<void>;
  updateLocation: (id: string, data: Partial<Location>) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;
  toggleActive: (id: string, isActive: boolean) => Promise<void>;
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
    try {
      const res = await fetch('http://localhost:3000/api/v1/locations', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Error al crear ubicación');
      }
      await get().fetchLocations();
    } catch (error: any) {
      console.error(error);
      alert('Error al crear ubicación: ' + error.message);
    }
  },

  updateLocation: async (id, data) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/locations/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Error al actualizar ubicación');
      }
      await get().fetchLocations();
    } catch (error: any) {
      console.error(error);
      alert('Error al actualizar ubicación: ' + error.message);
    }
  },

  deleteLocation: async (id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/locations/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete location');
      await get().fetchLocations();
    } catch (error: any) {
      console.error(error);
    }
  },

  toggleActive: async (id, isActive) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/locations/${id}/toggle`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: isActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle active');
      set((state) => ({
        locations: state.locations.map((l) => (l.id === id ? { ...l, is_active: isActive } : l)),
      }));
    } catch (error: any) {
      console.error(error);
    }
  },
}));
