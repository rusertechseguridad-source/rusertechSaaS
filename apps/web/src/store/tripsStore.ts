import { create } from 'zustand';
import { escribir, type Resultado } from '../services/avisos';
import { API_URL } from '../services/api';

export interface Trip {
  id: string;
  trip_code: string | null;
  name: string;
  status: string;
  scheduled_start: string;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  vehicle_id: string;
  vehicle?: any;
  // El esquema tiene `trips.driver_id` y la relación `driver`, y
  // `TripDetailsPage` las lee. Faltaban en el tipo, así que el compilador
  // (ciego) no podía decir nada. Van OPCIONALES porque hoy sólo las devuelve
  // `generateMobilePairing`: `findAll`/`findOne` no incluyen `driver`, y por eso
  // la columna Conductor sale vacía. Cerrar eso es de la Tanda 6.
  driver_id: string | null;
  driver?: any;
  operation_id: string | null;
  operation?: any;
  origin_location_id: string | null;
  origin_location?: any;
  destination_location_id: string | null;
  destination_location?: any;
  route_id: string | null;
  route?: any;
  events?: any[];
  tenant_id: string;
}

interface TripsState {
  trips: Trip[];
  loading: boolean;
  error: string | null;
  fetchTrips: () => Promise<void>;
  createTrip: (data: Partial<Trip>) => Promise<void>;
  updateTrip: (id: string, data: Partial<Trip>) => Promise<void>;
  /**
   * Cambio de estado del viaje. Va por `POST /trips/:id/status`, que es el
   * ÚNICO camino que estampa `actual_start` y `actual_end`.
   *
   * ⚠️ Los botones de estado usaban `updateTrip` (el `PUT` genérico), que sólo
   * escribe el campo `status`. Resultado: `actual_end` no se escribía por
   * ninguna vía del repo, y las columnas "Inicio real" / "Fin real" salían
   * vacías en la lista, en el CSV y en el informe PDF que se presenta ante
   * terceros. El endpoint existía y no lo llamaba nadie.
   */
  cambiarEstado: (id: string, status: string, notes?: string) => Promise<Resultado>;
  deleteTrip: (id: string) => Promise<void>;
  getTrip: (id: string) => Promise<Trip | null>;
  getLinkedVehicles: (tripId: string) => Promise<any[]>;
  linkVehicle: (tripId: string, data: any) => Promise<any>;
  unlinkVehicle: (tripId: string, vehicleId: string) => Promise<void>;
  generateMobilePairing: (tripId: string) => Promise<any>;
}

export const useTripsStore = create<TripsState>((set, get) => ({
  trips: [],
  loading: false,
  error: null,
  fetchTrips: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/api/v1/trips`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` },
      });
      if (!res.ok) throw new Error('Error al obtener viajes');
      const data = await res.json();
      set({ trips: data, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },
  createTrip: async (data) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Error al crear viaje');
      get().fetchTrips();
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  },
  cambiarEstado: async (id, status, notes) => {
    const r = await escribir(
      () => fetch(`${API_URL}/api/v1/trips/${id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`,
        },
        body: JSON.stringify({ status, notes }),
      }),
      'Estado del viaje actualizado.',
    );
    if (r.ok) await get().fetchTrips();
    return r;
  },

  updateTrip: async (id, data) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/trips/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Error al actualizar viaje');
      get().fetchTrips();
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  },
  deleteTrip: async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/trips/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` },
      });
      if (!res.ok) {
        // El backend explica POR QUÉ no se puede borrar (viaje en curso, o la
        // lista de lo que cuelga con sus cantidades) y ofrece la alternativa.
        // Antes se descartaba el cuerpo y se mostraba 'Error al eliminar viaje':
        // el operador veía un fallo genérico ante una negativa deliberada.
        const detalle = await res
          .json()
          .then((cuerpo) => cuerpo?.message)
          .catch(() => null);
        throw new Error(
          detalle || `No se pudo eliminar el viaje (HTTP ${res.status}).`,
        );
      }
      get().fetchTrips();
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  },
  getTrip: async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/trips/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error(e);
      return null;
    }
  },
  getLinkedVehicles: async (tripId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/trips/${tripId}/linked-vehicles`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` },
      });
      if (!res.ok) throw new Error('Error al obtener vehículos enlazados');
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  },
  linkVehicle: async (tripId: string, data: any) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/trips/${tripId}/linked-vehicles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al enlazar vehículo');
      }
      return await res.json();
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  },
  unlinkVehicle: async (tripId: string, vehicleId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/trips/${tripId}/linked-vehicles/${vehicleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` },
      });
      if (!res.ok) throw new Error('Error al desenlazar vehículo');
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  },
  generateMobilePairing: async (tripId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/trips/${tripId}/mobile-pairing`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` },
      });
      if (!res.ok) throw new Error('Error al generar código de emparejamiento');
      const data = await res.json();
      // Refetch trip to get updated metadata
      get().getTrip(tripId);
      return data;
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }
}));
