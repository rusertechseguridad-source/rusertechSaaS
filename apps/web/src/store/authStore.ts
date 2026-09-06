import { create } from 'zustand';
import { API_URL } from '../services/api';

interface AuthState {
  token: string | null;
  user: any | null;
  error: string | null;
  loading: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: any) => void;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('rusertech_token'),
  user: null,
  error: null,
  loading: false,
  setToken: (token) => {
    if (token) localStorage.setItem('rusertech_token', token);
    else localStorage.removeItem('rusertech_token');
    set({ token });
  },
  setUser: (user) => set({ user }),
  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        throw new Error('Credenciales inválidas');
      }
      const data = await response.json();
      localStorage.setItem('rusertech_token', data.access_token);
      set({ token: data.access_token, user: data.user, loading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return false;
    }
  },
  logout: () => {
    localStorage.removeItem('rusertech_token');
    set({ token: null, user: null });
  }
}));
