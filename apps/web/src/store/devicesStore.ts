import { create } from 'zustand';

export interface Device {
  id: string;
  tenant_id: string;
  imei: string | null;
  device_code: string | null;
  name: string;
  device_type: string;
  status: string;
  battery_level: number | null;
  signal_strength: number | null;
  operation_id: string | null;
  avl_user_id: string | null;
  created_at: string;
  updated_at: string;
  operation?: { name: string };
  avl_user?: { provider_name: string };
}

interface DevicesState {
  devices: Device[];
  loading: boolean;
  fetchDevices: () => Promise<void>;
  createDevice: (data: Partial<Device>) => Promise<void>;
  updateDevice: (id: string, data: Partial<Device>) => Promise<void>;
  deleteDevice: (id: string) => Promise<void>;
}

export const useDevicesStore = create<DevicesState>((set, get) => ({
  devices: [],
  loading: false,

  fetchDevices: async () => {
    set({ loading: true });
    try {
      const res = await fetch('http://localhost:3000/api/v1/devices', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        set({ devices: Array.isArray(data) ? data : [] });
      }
    } catch (e) {
      console.error(e);
    } finally {
      set({ loading: false });
    }
  },

  createDevice: async (data) => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await get().fetchDevices();
      }
    } catch (e) {
      console.error(e);
    }
  },

  updateDevice: async (id, data) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/devices/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await get().fetchDevices();
      }
    } catch (e) {
      console.error(e);
    }
  },

  deleteDevice: async (id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/devices/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`,
        },
      });
      if (res.ok) {
        await get().fetchDevices();
      }
    } catch (e) {
      console.error(e);
    }
  },
}));
