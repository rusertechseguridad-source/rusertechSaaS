import { create } from 'zustand';
import { API_URL } from '../services/api';

interface SimulatorJob {
  id: string;
  data: any;
}

interface SimulatorState {
  activeJobs: SimulatorJob[];
  loading: boolean;
  error: string | null;
  fetchStatus: () => Promise<void>;
  sendPoint: (data: any) => Promise<boolean>;
  sendAlert: (data: any) => Promise<boolean>;
  startRoute: (data: any) => Promise<boolean>;
  deleteRoute: (jobId: string) => Promise<boolean>;
}

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`,
});

export const useSimulatorStore = create<SimulatorState>((set) => ({
  activeJobs: [],
  loading: false,
  error: null,

  fetchStatus: async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/simulator/status`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch status');
      const data = await res.json();
      set({ activeJobs: [...data.activeJobs, ...data.delayedJobs, ...data.waitingJobs] });
    } catch (error: any) {
      console.error(error);
    }
  },

  sendPoint: async (data) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/api/v1/simulator/send`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to send point');
      set({ loading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return false;
    }
  },

  sendAlert: async (data) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/api/v1/simulator/alert`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to send alert');
      set({ loading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return false;
    }
  },

  startRoute: async (data) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/api/v1/simulator/route`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to start route');
      set({ loading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return false;
    }
  },

  deleteRoute: async (jobId) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/simulator/route/${jobId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete route');
      return true;
    } catch (error: any) {
      console.error(error);
      return false;
    }
  },
}));
