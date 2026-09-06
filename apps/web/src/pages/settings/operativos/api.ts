import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { OperativosSettings } from './types';
import { API_URL } from '../../../services/api';

/** Prefijo de este módulo. La base sale de `services/api`. */
const BASE = `${API_URL}/api/v1/settings/parameters`;

const getHeaders = () => {
  const token = localStorage.getItem('rusertech_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
};

export const useOperativosSettings = () => {
  return useQuery<OperativosSettings>({
    queryKey: ['settings-operativos'],
    queryFn: async () => {
      const res = await fetch(BASE, { headers: getHeaders() });
      if (!res.ok) throw new Error('Error al cargar configuración Operativa');
      const data = await res.json();
      
      const mapped: Partial<OperativosSettings> = {
        vehicle_moving_min_speed_kmh: 5,
        location_default_radius_meters: 100,
        destination_arrival_proximity_km: 10,
        broken_loop_threshold_minutes: 6,
        provider_ok_threshold_minutes: 15
      };

      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          if (item.key === 'vehicle_moving_min_speed_kmh') mapped.vehicle_moving_min_speed_kmh = Number(item.value);
          if (item.key === 'location_default_radius_meters') mapped.location_default_radius_meters = Number(item.value);
          if (item.key === 'destination_arrival_proximity_km') mapped.destination_arrival_proximity_km = Number(item.value);
          if (item.key === 'broken_loop_threshold_minutes') mapped.broken_loop_threshold_minutes = Number(item.value);
          if (item.key === 'provider_ok_threshold_minutes') mapped.provider_ok_threshold_minutes = Number(item.value);
        });
      }
      return mapped as OperativosSettings;
    }
  });
};

export const useUpdateOperativosSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: OperativosSettings) => {
      const promises = Object.entries(data).map(([key, value]) => {
        return fetch(BASE, {
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
      queryClient.invalidateQueries({ queryKey: ['settings-operativos'] });
    }
  });
};
