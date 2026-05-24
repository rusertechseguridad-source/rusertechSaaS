import { create } from 'zustand';

interface Route {
  id: string;
  name: string;
  description: string | null;
  corridor_meters: number;
  distance_km: number | null;
  estimated_minutes: number | null;
  origin_location_id: string | null;
  destination_location_id: string | null;
  operation_id: string | null;
  origin_location: { name: string } | null;
  destination_location: { name: string } | null;
  operation: { name: string } | null;
  is_active: boolean;
  times_used: number;
  geojson?: any;
}

interface RoutesState {
  routes: Route[];
  loading: boolean;
  error: string | null;
  fetchRoutes: () => Promise<void>;
  createRoute: (data: any) => Promise<void>;
  updateRoute: (id: string, data: Partial<Route>) => Promise<void>;
  deleteRoute: (id: string) => Promise<void>;
  toggleActive: (id: string, isActive: boolean) => Promise<void>;
}

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`,
});

export const useRoutesStore = create<RoutesState>((set, get) => ({
  routes: [],
  loading: false,
  error: null,

  fetchRoutes: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('http://localhost:3000/api/v1/routes', {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch routes');
      const data = await res.json();
      set({ routes: data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  createRoute: async (data) => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/routes', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create route');
      await get().fetchRoutes();
    } catch (error: any) {
      console.error(error);
    }
  },

  updateRoute: async (id, data) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/routes/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update route');
      await get().fetchRoutes();
    } catch (error: any) {
      console.error(error);
    }
  },

  deleteRoute: async (id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/routes/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete route');
      await get().fetchRoutes();
    } catch (error: any) {
      console.error(error);
    }
  },

  toggleActive: async (id, isActive) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/routes/${id}/toggle`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: isActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle active');
      set((state) => ({
        routes: state.routes.map((r) => (r.id === id ? { ...r, is_active: isActive } : r)),
      }));
    } catch (error: any) {
      console.error(error);
    }
  },
}));
