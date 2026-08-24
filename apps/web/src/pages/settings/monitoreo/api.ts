import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MonitoreoSettings } from './types';
import { MONITOREO_POR_DEFECTO } from './types';

const API_URL = 'http://localhost:3000/api/v1/settings/monitoring';

const getHeaders = () => {
  const token = localStorage.getItem('rusertech_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

/**
 * El backend siempre responde umbrales completos: si el tenant no tiene fila
 * propia devuelve los valores por defecto. Por eso acá no hace falta armar el
 * objeto campo por campo — sólo cubrir el caso de una respuesta malformada.
 */
export const useMonitoreoSettings = () =>
  useQuery<MonitoreoSettings>({
    queryKey: ['settings-monitoreo'],
    queryFn: async () => {
      const res = await fetch(API_URL, { headers: getHeaders() });
      if (!res.ok) throw new Error('Error al cargar la configuración de monitoreo');
      const data = await res.json();
      return { ...MONITOREO_POR_DEFECTO, ...(data ?? {}) } as MonitoreoSettings;
    },
  });

export const useUpdateMonitoreoSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: MonitoreoSettings): Promise<MonitoreoSettings> => {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Error al guardar la configuración de monitoreo');
      // La respuesta trae lo que quedó guardado, que puede diferir de lo
      // enviado: el backend acota los valores en lugar de rechazarlos.
      return res.json();
    },
    onSuccess: (guardado) => {
      queryClient.setQueryData(['settings-monitoreo'], guardado);
      // El mapa lee estos umbrales en cada refresco; se invalida por las dudas
      // de que algún consumidor los tenga cacheados.
      queryClient.invalidateQueries({ queryKey: ['vehicles-live'] });
    },
  });
};
