import { create } from 'zustand';

export interface AlertData {
  id: string;
  event_type: string;
  severity: string;
  status: string;
  triggered_at: string;
  resolved_at: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  vehicle?: { plate: string; alias?: string };
  trip?: { id: string; name: string; trip_code?: string };
  rule?: { name: string };
  acknowledger?: { full_name: string; email: string };
}

interface AlertsState {
  alerts: AlertData[];
  loading: boolean;
  fetchAlerts: () => Promise<void>;
  resolveAlert: (id: string, resolution_note: string) => Promise<void>;
}

export const useAlertsStore = create<AlertsState>((set, get) => ({
  alerts: [],
  loading: false,

  fetchAlerts: async () => {
    set({ loading: true });
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch('http://localhost:3000/api/v1/alerts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        set({ alerts: Array.isArray(data) ? data : [] });
      }
    } catch (error) {
      console.error('Failed to fetch alerts', error);
    } finally {
      set({ loading: false });
    }
  },

  resolveAlert: async (id: string, resolution_note: string) => {
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch(`http://localhost:3000/api/v1/alerts/${id}/resolve`, {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ resolution_note })
      });
      if (res.ok) {
        const updatedAlert = await res.json();
        // Update locally
        set((state) => ({
          alerts: state.alerts.map((a) => (a.id === id ? { ...a, ...updatedAlert } : a))
        }));
      }
    } catch (error) {
      console.error('Failed to resolve alert', error);
    }
  }
}));
