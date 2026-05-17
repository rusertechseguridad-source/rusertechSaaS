import { create } from 'zustand';

interface AvlUser {
  id: string;
  tenant_id: string;
  user_avl_code: string;
  name: string;
  description: string | null;
  provider_name: string | null;
  provider_platform_url: string | null;
  provider_username: string | null;
  provider_password: string | null;
  provider_api_url: string | null;
  provider_api_key: string | null;
  provider_notes: string | null;
  api_key: string;
  is_active: boolean;
  last_data_at: string | null;
  created_at: string;
  updated_at: string;
  _count?: { vehicles: number };
}

interface AvlEventDictionary {
  id: string;
  avl_user_id: string;
  raw_code: string;
  event_type: string;
  description: string | null;
  triggers_alert: boolean;
  severity: string;
  is_active: boolean;
  created_at: string;
}

interface AvlStore {
  users: AvlUser[];
  loading: boolean;
  error: string | null;
  fetchUsers: () => Promise<void>;
  toggleActive: (id: string, isActive: boolean) => Promise<void>;
  regenerateApiKey: (id: string) => Promise<void>;
  createUser: (data: Partial<AvlUser>) => Promise<void>;
  updateUser: (id: string, data: Partial<AvlUser>) => Promise<void>;
  
  // Dictionary
  dictionary: AvlEventDictionary[];
  unknownCodes: string[];
  fetchDictionary: (userId: string) => Promise<void>;
  fetchUnknownCodes: (userId: string) => Promise<void>;
  addDictionaryEntry: (userId: string, data: Partial<AvlEventDictionary>) => Promise<void>;
  updateDictionaryEntry: (dictId: string, data: Partial<AvlEventDictionary>) => Promise<void>;
}

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`,
});

export const useAvlStore = create<AvlStore>((set, get) => ({
  users: [],
  loading: false,
  error: null,
  dictionary: [],
  unknownCodes: [],

  fetchUsers: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('http://localhost:3000/api/v1/avl-users', {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch AVL users');
      const data = await res.json();
      set({ users: data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  toggleActive: async (id, isActive) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/avl-users/${id}/toggle`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: isActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle active status');
      set((state) => ({
        users: state.users.map((u) => (u.id === id ? { ...u, is_active: isActive } : u)),
      }));
    } catch (error: any) {
      console.error(error);
    }
  },

  regenerateApiKey: async (id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/avl-users/${id}/regenerate-api-key`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to regenerate API Key');
      const data = await res.json();
      set((state) => ({
        users: state.users.map((u) => (u.id === id ? { ...u, api_key: data.api_key } : u)),
      }));
    } catch (error: any) {
      console.error(error);
    }
  },

  createUser: async (data) => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/avl-users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create user');
      await get().fetchUsers();
    } catch (error: any) {
      console.error(error);
    }
  },

  updateUser: async (id, data) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/avl-users/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update user');
      await get().fetchUsers();
    } catch (error: any) {
      console.error(error);
    }
  },

  fetchDictionary: async (userId) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/avl-users/${userId}/dictionary`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch dictionary');
      const data = await res.json();
      set({ dictionary: data });
    } catch (error: any) {
      console.error(error);
    }
  },

  fetchUnknownCodes: async (userId) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/avl-users/${userId}/unknown-codes`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch unknown codes');
      const data = await res.json();
      set({ unknownCodes: data });
    } catch (error: any) {
      console.error(error);
    }
  },

  addDictionaryEntry: async (userId, data) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/avl-users/${userId}/dictionary`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to add entry');
      await get().fetchDictionary(userId);
      await get().fetchUnknownCodes(userId); // Refresh unknown codes as we might have mapped one
    } catch (error: any) {
      console.error(error);
    }
  },

  updateDictionaryEntry: async (dictId, data) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/avl-users/dictionary/${dictId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update entry');
      // We don't have userId easily here without passing it, let's just let the UI call fetchDictionary if needed
      // Actually we can pass userId or just let the caller refetch.
      set((state) => ({
        dictionary: state.dictionary.map((d) => (d.id === dictId ? { ...d, ...data } : d)),
      }));
    } catch (error: any) {
      console.error(error);
    }
  },
}));
