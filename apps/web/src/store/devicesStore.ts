import { create } from 'zustand';
// Las tres escrituras se tragaban el error en un `console.error` y el modal
// se cerraba igual: el operador creía haber guardado.
import { escribir, type Resultado } from '../services/avisos';
import { API_URL } from '../services/api';

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
  createDevice: (data: Partial<Device>) => Promise<Resultado>;
  updateDevice: (id: string, data: Partial<Device>) => Promise<Resultado>;
  deleteDevice: (id: string) => Promise<Resultado>;
}

export const useDevicesStore = create<DevicesState>((set, get) => ({
  devices: [],
  loading: false,

  fetchDevices: async () => {
    set({ loading: true });
    try {
      const res = await fetch(`${API_URL}/api/v1/devices`, {
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
    const r = await escribir(
      () => fetch(`${API_URL}/api/v1/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` },
        body: JSON.stringify(data),
      }),
      'Dispositivo creado.',
    );
    if (r.ok) await get().fetchDevices();
    return r;
  },

  updateDevice: async (id, data) => {
    const r = await escribir(
      () => fetch(`${API_URL}/api/v1/devices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` },
        body: JSON.stringify(data),
      }),
      'Dispositivo actualizado.',
    );
    if (r.ok) await get().fetchDevices();
    return r;
  },

  deleteDevice: async (id) => {
    const r = await escribir(
      () => fetch(`${API_URL}/api/v1/devices/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` },
      }),
      'Dispositivo eliminado.',
    );
    if (r.ok) await get().fetchDevices();
    return r;
  },
}));
