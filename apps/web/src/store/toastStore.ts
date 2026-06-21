import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    // Determine type by message content if it's info (this is a heuristic for intercepted alerts)
    let finalType = type;
    if (type === 'info') {
      const lower = message.toLowerCase();
      if (lower.includes('error') || lower.includes('falla')) finalType = 'error';
      else if (lower.includes('exito') || lower.includes('éxito') || lower.includes('correctamente') || lower.includes('guardad') || lower.includes('cread') || lower.includes('enviad') || lower.includes('actualizad')) finalType = 'success';
    }

    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { id, message, type: finalType }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }))
}));
