import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NdrSettings } from './types';

const API_URL = 'http://localhost:3000/api/v1/settings/parameters';

const getHeaders = () => {
  const token = localStorage.getItem('rusertech_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
};

export const useNdrSettings = () => {
  return useQuery<NdrSettings>({
    queryKey: ['settings-ndr'],
    queryFn: async () => {
      const res = await fetch(API_URL, { headers: getHeaders() });
      if (!res.ok) throw new Error('Error al cargar configuración NDR');
      const data = await res.json();
      
      const mapped: Partial<NdrSettings> = {
        ndr_sla_normal_minutes: 5,
        ndr_sla_anomalia_minutes: 10,
        ndr_sla_riesgo_critico_minutes: 15,
        ndr_sla_activacion_policial_minutes: 20
      };

      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          if (item.key === 'ndr_sla_normal_minutes') mapped.ndr_sla_normal_minutes = Number(item.value);
          if (item.key === 'ndr_sla_anomalia_minutes') mapped.ndr_sla_anomalia_minutes = Number(item.value);
          if (item.key === 'ndr_sla_riesgo_critico_minutes') mapped.ndr_sla_riesgo_critico_minutes = Number(item.value);
          if (item.key === 'ndr_sla_activacion_policial_minutes') mapped.ndr_sla_activacion_policial_minutes = Number(item.value);
        });
      }
      return mapped as NdrSettings;
    }
  });
};

export const useUpdateNdrSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: NdrSettings) => {
      const promises = Object.entries(data).map(([key, value]) => {
        return fetch(API_URL, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({ key, value: String(value) })
        }).then(res => {
          if (!res.ok) throw new Error(`Error al actualizar ${key}`);
        });
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-ndr'] });
    }
  });
};
