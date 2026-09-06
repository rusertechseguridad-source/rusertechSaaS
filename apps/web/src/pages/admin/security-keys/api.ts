import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SecurityKey, CreateSecurityKeyDTO, UpdateSecurityKeyDTO } from './types';
import { API_URL } from '../../../services/api';

/** Prefijo de este módulo. La base sale de `services/api`. */
const BASE = `${API_URL}/api/v1/security-keys`;

const getHeaders = () => {
  const token = localStorage.getItem('rusertech_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
};

export const useSecurityKeys = (filters?: { is_active?: boolean }) => {
  return useQuery<{ data: SecurityKey[], total: number }>({
    queryKey: ['security-keys', filters],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (filters?.is_active !== undefined) queryParams.append('is_active', String(filters.is_active));

      const res = await fetch(`${BASE}?${queryParams.toString()}`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Error al cargar claves de seguridad');
      return res.json();
    }
  });
};

export const useCreateSecurityKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateSecurityKeyDTO) => {
      const res = await fetch(BASE, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error al crear clave');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-keys'] });
    }
  });
};

export const useUpdateSecurityKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSecurityKeyDTO }) => {
      const res = await fetch(`${BASE}/${id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error al actualizar clave');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-keys'] });
    }
  });
};

export const useDeleteSecurityKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${BASE}/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error al eliminar clave');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-keys'] });
    }
  });
};
