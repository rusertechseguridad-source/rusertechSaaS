import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { OperationalProtocol, CreateProtocolDTO, UpdateProtocolDTO } from './types';

const API_URL = 'http://localhost:3000/api/v1/operational-protocols';

const getHeaders = () => {
  const token = localStorage.getItem('rusertech_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
};

export const useProtocols = (filters?: { trip_status?: string; risk_level?: string; is_active?: boolean }) => {
  return useQuery<{ data: OperationalProtocol[], total: number }>({
    queryKey: ['operational-protocols', filters],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (filters?.trip_status) queryParams.append('trip_status', filters.trip_status);
      if (filters?.risk_level) queryParams.append('risk_level', filters.risk_level);
      if (filters?.is_active !== undefined) queryParams.append('is_active', String(filters.is_active));

      const res = await fetch(`${API_URL}?${queryParams.toString()}`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Error al cargar protocolos');
      return res.json();
    }
  });
};

export const useCreateProtocol = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateProtocolDTO) => {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error al crear protocolo');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational-protocols'] });
    }
  });
};

export const useUpdateProtocol = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProtocolDTO }) => {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error al actualizar protocolo');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational-protocols'] });
    }
  });
};

export const useDeleteProtocol = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error al eliminar protocolo');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational-protocols'] });
    }
  });
};
