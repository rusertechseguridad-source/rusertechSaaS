import { useQuery } from '@tanstack/react-query';
import type { RespuestaMonitorAvl, RespuestaVehiculosAvl } from './types';

const API_BASE = 'http://localhost:3000/api/v1/avl-users';

const getHeaders = () => {
  const token = localStorage.getItem('rusertech_token');
  return { Authorization: `Bearer ${token}` };
};

/**
 * Estado de ingesta de todos los proveedores.
 *
 * Se refresca solo cada 60 s: es una pantalla de guardia, y un dato de hace un
 * minuto ya no responde "¿está entrando telemetría ahora?".
 */
export const useAvlMonitor = (horas: number) =>
  useQuery<RespuestaMonitorAvl>({
    queryKey: ['avl-monitor', horas],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/monitor?horas=${horas}`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Error al cargar el monitor de ingesta');
      return res.json();
    },
    refetchInterval: 60_000,
  });

/**
 * Detalle por vehículo de un proveedor. Sólo se consulta cuando la fila está
 * desplegada (`enabled`): es la consulta más cara de la pantalla y no tiene
 * sentido pagarla por proveedores que nadie abrió.
 */
export const useAvlMonitorVehiculos = (avlUserId: string | null, horas: number) =>
  useQuery<RespuestaVehiculosAvl>({
    queryKey: ['avl-monitor-vehiculos', avlUserId, horas],
    enabled: Boolean(avlUserId),
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/monitor/${avlUserId}/vehicles?horas=${horas}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Error al cargar el detalle por vehículo');
      return res.json();
    },
  });
