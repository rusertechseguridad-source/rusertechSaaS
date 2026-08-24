import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = 'http://localhost:3000/api/v1/motor';

const getHeaders = () => {
  const token = localStorage.getItem('rusertech_token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
};

export interface SaludMotor {
  pendientes: number;
  procesando: number;
  fallidos: number;
  /** Antigüedad del punto más viejo sin procesar. El indicador que importa. */
  antiguedad_segundos: number | null;
}

export interface VehiculoMonitoreado {
  vehicle_id: string;
  plate: string | null;
  trip_id: string | null;
  motivo: 'estado' | 'manual' | 'red_seguridad';
  desde: string;
}

/**
 * Salud del motor. Se refresca sola cada 10 s: es una pantalla de guardia y un
 * dato de hace un minuto no responde "¿el motor está al día ahora?".
 */
export const useSaludMotor = () =>
  useQuery<SaludMotor>({
    queryKey: ['motor-salud'],
    refetchInterval: 10_000,
    queryFn: async () => {
      const res = await fetch(`${API_URL}/salud`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Error al consultar la salud del motor');
      return res.json();
    },
  });

export const useVehiculosMonitoreados = () =>
  useQuery<VehiculoMonitoreado[]>({
    queryKey: ['motor-monitoreados'],
    refetchInterval: 30_000,
    queryFn: async () => {
      const res = await fetch(`${API_URL}/monitoreados`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Error al consultar los vehículos monitoreados');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

export const useDesactivarMonitoreo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vehicleId: string) => {
      const res = await fetch(`${API_URL}/monitoreados/${vehicleId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('No se pudo desactivar el monitoreo');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['motor-monitoreados'] }),
  });
};

/** Historial de estados de un viaje: qué lo cambió y cuándo. */
export interface EntradaHistorial {
  id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  disparado_por: string;
  causa_detalle: string | null;
  automatico: boolean;
  created_at: string;
  nombre_anterior: string | null;
  nombre_nuevo: string | null;
  color: string | null;
}

export const useHistorialViaje = (tripId: string | undefined) =>
  useQuery<EntradaHistorial[]>({
    queryKey: ['motor-historial', tripId],
    enabled: Boolean(tripId),
    queryFn: async () => {
      const res = await fetch(`${API_URL}/viajes/${tripId}/historial`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Error al cargar el historial de estados');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });
