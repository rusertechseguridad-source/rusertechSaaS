import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTripsStore, type Trip } from '../../store/tripsStore';
import { Map, ChevronLeft, Calendar, Truck, User, MapPin, Activity, Clock } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';

export const TripDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getTrip, updateTrip } = useTripsStore();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (id) {
      loadTrip(id);
    }
  }, [id]);

  const loadTrip = async (tripId: string) => {
    setLoading(true);
    const data = await getTrip(tripId);
    setTrip(data);
    setLoading(false);
  };

  const handleChangeStatus = async (newStatus: string) => {
    if (!trip) return;
    setUpdating(true);
    await updateTrip(trip.id, { status: newStatus });
    await loadTrip(trip.id);
    setUpdating(false);
  };

  if (loading) return <div className="p-8 text-center text-textMuted">Cargando detalles del viaje...</div>;
  if (!trip) return <div className="p-8 text-center text-statusDanger">Viaje no encontrado</div>;

  return (
    <div className="p-8 h-full max-w-7xl mx-auto flex flex-col">
      <div className="mb-6 flex items-center justify-between shrink-0">
        <div className="flex items-center">
          <Link to="/trips" className="mr-4 p-2 bg-bgSurface border border-borderDefault rounded hover:text-white hover:bg-bgSurfaceHigh transition-colors text-textSecondary">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-display font-bold text-white flex items-center">
              {trip.name}
            </h1>
            <p className="text-textMuted text-sm font-mono mt-1">ID: {trip.id} {trip.trip_code ? `| COD: ${trip.trip_code}` : ''}</p>
          </div>
        </div>
        
        <RequirePermission permission="trips:manage">
          <div className="flex bg-bgSurface border border-borderDefault rounded-lg overflow-hidden p-1 shadow-card">
            {['PROGRAMADO', 'EN_CURSO', 'FINALIZADO', 'CANCELADO'].map(status => (
              <button
                key={status}
                disabled={updating}
                onClick={() => handleChangeStatus(status)}
                className={`px-4 py-1.5 text-xs font-bold uppercase rounded transition-colors ${
                  trip.status === status
                    ? 'bg-accentGreen text-bgStart shadow'
                    : 'text-textSecondary hover:text-white hover:bg-bgSurfaceHigh'
                } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </RequirePermission>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* COLUMNA IZQUIERDA: DETALLES */}
        <div className="col-span-1 flex flex-col gap-6 overflow-y-auto">
          {/* Card Resumen */}
          <div className="bg-bgSurface border border-borderDefault rounded-xl p-6 shadow-card">
            <h3 className="text-sm font-bold text-accentGreen uppercase tracking-wider mb-4 border-b border-borderDefault pb-2">Logística</h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-textMuted mt-0.5" />
                <div>
                  <div className="text-textMuted text-xs">Vehículo</div>
                  <div className="text-white font-bold">{trip.vehicle?.plate}</div>
                  {trip.vehicle?.alias && <div className="text-textSecondary text-xs">{trip.vehicle.alias}</div>}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-textMuted mt-0.5" />
                <div>
                  <div className="text-textMuted text-xs">Operación / Cliente</div>
                  <div className="text-white font-medium">{trip.operation?.name || 'Interno (Sin Cliente asignado)'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-bgSurface border border-borderDefault rounded-xl p-6 shadow-card">
            <h3 className="text-sm font-bold text-accentGreen uppercase tracking-wider mb-4 border-b border-borderDefault pb-2">Ruta</h3>
            <div className="space-y-4 relative">
              <div className="absolute left-[11px] top-6 bottom-6 w-0.5 bg-borderDefault z-0"></div>
              
              <div className="flex items-start gap-3 relative z-10">
                <div className="bg-bgSurface rounded-full p-1 mt-0.5 border border-textMuted shadow">
                  <div className="w-2.5 h-2.5 bg-textMuted rounded-full"></div>
                </div>
                <div>
                  <div className="text-textMuted text-xs">Origen</div>
                  <div className="text-white font-medium">{trip.origin_location?.name || 'Indefinido'}</div>
                  <div className="text-textSecondary text-xs">{trip.origin_location?.address}</div>
                </div>
              </div>

              <div className="flex items-start gap-3 relative z-10">
                <div className="bg-bgSurface rounded-full p-1 mt-0.5 border border-accentGreen shadow">
                  <div className="w-2.5 h-2.5 bg-accentGreen rounded-full"></div>
                </div>
                <div>
                  <div className="text-textMuted text-xs">Destino</div>
                  <div className="text-white font-medium">{trip.destination_location?.name || 'Indefinido'}</div>
                  <div className="text-textSecondary text-xs">{trip.destination_location?.address}</div>
                </div>
              </div>
            </div>
            {trip.route && (
              <div className="mt-4 pt-4 border-t border-borderDefault">
                <div className="text-textMuted text-xs mb-1">Corredor asignado</div>
                <div className="flex items-center gap-2 text-white text-sm">
                  <Map className="w-4 h-4 text-accentGreen" />
                  {trip.route.name}
                </div>
              </div>
            )}
          </div>

          <div className="bg-bgSurface border border-borderDefault rounded-xl p-6 shadow-card">
            <h3 className="text-sm font-bold text-accentGreen uppercase tracking-wider mb-4 border-b border-borderDefault pb-2">Tiempos</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-textSecondary"><Calendar className="w-4 h-4" /> Inicio Programado</div>
                <div className="text-white">{new Date(trip.scheduled_start).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</div>
              </div>
              {trip.scheduled_end && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-textSecondary"><Calendar className="w-4 h-4" /> Fin Programado</div>
                  <div className="text-white">{new Date(trip.scheduled_end).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</div>
                </div>
              )}
              {trip.actual_start && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-textSecondary"><Clock className="w-4 h-4 text-accentMint" /> Inicio Real</div>
                  <div className="text-white">{new Date(trip.actual_start).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</div>
                </div>
              )}
              {trip.actual_end && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-textSecondary"><Clock className="w-4 h-4 text-accentBlue" /> Fin Real</div>
                  <div className="text-white">{new Date(trip.actual_end).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: EVENTOS Y MAPA */}
        <div className="col-span-2 flex flex-col gap-6 h-full min-h-0">
          <div className="bg-bgStart border border-borderDefault rounded-xl flex-1 relative overflow-hidden flex flex-col items-center justify-center">
            <div className="absolute top-4 right-4 bg-bgSurface border border-borderDefault rounded p-2 text-xs text-textMuted z-10 shadow-card">
              [MapLibre GL Map View]
            </div>
            <div className="text-center p-8">
              <MapPin className="w-16 h-16 mx-auto text-bgSurfaceHigh mb-4" />
              <p className="text-textMuted font-mono">Simulación de Mapa Interactivo</p>
              <p className="text-textSecondary text-sm mt-2 max-w-sm">Aquí se mostrará el rastro del viaje, alertas geo-cercadas y posición en tiempo real mediante WebSockets o Polling.</p>
            </div>
          </div>

          <div className="bg-bgSurface border border-borderDefault rounded-xl h-64 shadow-card flex flex-col">
            <div className="p-4 border-b border-borderDefault shrink-0 flex items-center justify-between">
              <h3 className="text-sm font-bold text-accentGreen uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Registro de Eventos
              </h3>
              <span className="text-xs text-textMuted">{trip.events?.length || 0} eventos</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {trip.events && trip.events.length > 0 ? (
                <div className="space-y-3">
                  {trip.events.map((evt: any) => (
                    <div key={evt.id} className="flex gap-4 text-sm p-3 bg-bgStart border border-borderDefault rounded">
                      <div className="text-textMuted w-20 shrink-0">
                        {new Date(evt.generated_at).toLocaleTimeString()}
                      </div>
                      <div className="flex-1">
                        <span className="font-bold text-white mr-2">{evt.event_name}</span>
                        {evt.speed !== null && <span className="text-xs text-accentBlue font-mono">{evt.speed} km/h</span>}
                        {evt.address && <div className="text-textSecondary text-xs mt-1">{evt.address}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-textMuted text-sm">
                  No hay eventos registrados para este viaje todavía.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
