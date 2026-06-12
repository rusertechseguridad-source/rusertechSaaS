import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTripsStore, type Trip } from '../../store/tripsStore';
import { Map, ChevronLeft, Calendar, Truck, User, MapPin, Activity, Clock, Sun, CloudSun, CloudFog, CloudDrizzle, CloudRain, Snowflake, CloudLightning, Cloud, Edit, FileText, Send } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export const TripDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getTrip, updateTrip } = useTripsStore();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [weather, setWeather] = useState<any>(null);
  const [showTrace, setShowTrace] = useState(false);
  const [editingActualStart, setEditingActualStart] = useState(false);
  const [newActualStart, setNewActualStart] = useState('');
  
  // Operator Logs (Bitácora) State
  const [operatorLogs, setOperatorLogs] = useState<any[]>([]);
  const [newLogText, setNewLogText] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (id) {
      loadTrip(id);
    }
  }, [id]);

  const loadTrip = async (tripId: string) => {
    setLoading(true);
    const data = await getTrip(tripId);
    setTrip(data);
    
    // Fetch weather
    if (data) {
      let lat = (data as any).origin_lat;
      let lng = (data as any).origin_lng;
      
      // Use latest event location if available
      if (data.events && data.events.length > 0) {
         // Assuming last event is the most recent.
         const latestEvent = data.events[data.events.length - 1];
         if (latestEvent.lat && latestEvent.lng) {
            lat = latestEvent.lat;
            lng = latestEvent.lng;
         }
      }
      
      if (lat && lng) {
        try {
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
          if (res.ok) {
            const wData = await res.json();
            setWeather(wData.current_weather);
          }
        } catch (e) {
          console.error('Weather fetch error', e);
        }
      }
    }
    
    await loadLogs(tripId);
    setLoading(false);
  };

  const loadLogs = async (tripId: string) => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`http://localhost:3000/api/v1/trips/${tripId}/logs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` }
      });
      if (res.ok) setOperatorLogs(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoadingLogs(false);
  };

  const handleAddLog = async () => {
    if (!newLogText.trim() || !trip) return;
    try {
      const res = await fetch(`http://localhost:3000/api/v1/trips/${trip.id}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`
        },
        body: JSON.stringify({ text: newLogText })
      });
      if (res.ok) {
        setNewLogText('');
        loadLogs(trip.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getWeatherDetails = (code: number) => {
    if (code === 0) return { label: 'Despejado', icon: <Sun className="w-5 h-5 text-yellow-400" /> };
    if (code >= 1 && code <= 3) return { label: 'Parcialmente Nublado', icon: <CloudSun className="w-5 h-5 text-gray-300" /> };
    if (code >= 45 && code <= 48) return { label: 'Niebla', icon: <CloudFog className="w-5 h-5 text-gray-400" /> };
    if (code >= 51 && code <= 55) return { label: 'Llovizna', icon: <CloudDrizzle className="w-5 h-5 text-blue-300" /> };
    if (code >= 61 && code <= 65) return { label: 'Lluvia', icon: <CloudRain className="w-5 h-5 text-blue-400" /> };
    if (code >= 71 && code <= 77) return { label: 'Nieve', icon: <Snowflake className="w-5 h-5 text-white" /> };
    if (code >= 95) return { label: 'Tormenta', icon: <CloudLightning className="w-5 h-5 text-yellow-500" /> };
    return { label: 'Nublado', icon: <Cloud className="w-5 h-5 text-gray-400" /> };
  };

  const handleChangeStatus = async (newStatus: string) => {
    if (!trip) return;
    setUpdating(true);
    await updateTrip(trip.id, { status: newStatus });
    await loadTrip(trip.id);
    setUpdating(false);
  };

  const handleUpdateActualStart = async () => {
    if (!trip || !newActualStart) return;
    setUpdating(true);
    await updateTrip(trip.id, { actual_start: new Date(newActualStart).toISOString() });
    await loadTrip(trip.id);
    setEditingActualStart(false);
    setUpdating(false);
  };

  useEffect(() => {
    if (!trip || !mapContainer.current || map.current) return;

    // Initialize Map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: [-58.3816, -34.6037],
      zoom: 10
    });

    map.current.on('load', () => {
      if (!map.current || !trip) return;
      const bounds = new maplibregl.LngLatBounds();
      let hasBounds = false;

      // Draw Route
      if (trip.route && trip.route.geojson) {
        map.current.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: trip.route.geojson
          }
        });
        map.current.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#00FF00', 'line-width': 5, 'line-opacity': 0.6 }
        });

        // Expand bounds
        const coords = trip.route.geojson.type === 'MultiLineString' 
          ? trip.route.geojson.coordinates.flat(1) 
          : trip.route.geojson.coordinates;
        coords.forEach((c: number[]) => bounds.extend([c[0], c[1]]));
        hasBounds = true;
      }

      // Origin Marker
      const originLat = (trip as any).origin_lat;
      const originLng = (trip as any).origin_lng;
      if (originLat && originLng) {
        new maplibregl.Marker({ color: '#22c55e' }) // Green
          .setLngLat([originLng, originLat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML('<h3>Origen</h3>'))
          .addTo(map.current);
        bounds.extend([originLng, originLat]);
        hasBounds = true;
      }

      // Destination Marker
      const destLat = (trip as any).destination_lat;
      const destLng = (trip as any).destination_lng;
      if (destLat && destLng) {
        new maplibregl.Marker({ color: '#ef4444' }) // Red
          .setLngLat([destLng, destLat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML('<h3>Destino</h3>'))
          .addTo(map.current);
        bounds.extend([destLng, destLat]);
        hasBounds = true;
      }

      if (hasBounds) {
        map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [trip]);

  // Trace effect
  useEffect(() => {
    if (!map.current || !trip) return;
    
    // Cleanup existing trace
    if (map.current.getLayer('trace-line')) map.current.removeLayer('trace-line');
    if (map.current.getSource('trace')) map.current.removeSource('trace');

    if (showTrace && trip.events && trip.events.length > 1) {
      const coords = trip.events
        .filter(e => e.lat && e.lng)
        .sort((a, b) => new Date(a.generated_at).getTime() - new Date(b.generated_at).getTime())
        .map(e => [e.lng, e.lat]);
      
      if (coords.length > 1) {
        map.current.addSource('trace', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: coords
            }
          }
        });
        map.current.addLayer({
          id: 'trace-line',
          type: 'line',
          source: 'trace',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#2ab3ff', 'line-width': 4, 'line-opacity': 0.8, 'line-dasharray': [2, 2] }
        });
      }
    }
  }, [showTrace, trip]);

  if (loading) return <div className="p-8 text-center text-textMuted">Cargando detalles del viaje...</div>;
  if (!trip) return <div className="p-8 text-center text-statusDanger">Viaje no encontrado</div>;

  return (
    <div className="p-8 h-[calc(100vh-4rem)] w-full flex flex-col">
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
                onClick={() => {
                  if (status === 'CANCELADO' && !confirm('¿Estás seguro de cancelar este viaje?')) return;
                  handleChangeStatus(status);
                }}
                className={`px-4 py-1.5 text-xs font-bold uppercase rounded transition-colors ${
                  trip.status === status
                    ? (status === 'CANCELADO' ? 'bg-statusDanger text-bgStart shadow' : 'bg-accentGreen text-bgStart shadow')
                    : (status === 'CANCELADO' ? 'text-statusDanger hover:text-white hover:bg-statusDanger/20' : 'text-textSecondary hover:text-white hover:bg-bgSurfaceHigh')
                } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </RequirePermission>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* COLUMNA IZQUIERDA: DETALLES */}
        <div className="lg:col-span-3 flex flex-col gap-6 overflow-y-auto pr-2 pb-8">
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
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-textSecondary"><Clock className="w-4 h-4 text-accentMint" /> Inicio Real</div>
                <div className="text-white text-right">
                  {editingActualStart ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input 
                        type="datetime-local" 
                        value={newActualStart} 
                        onChange={e => setNewActualStart(e.target.value)}
                        className="bg-bgStart border border-borderDefault rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accentBlue"
                      />
                      <button onClick={handleUpdateActualStart} className="text-accentGreen text-xs hover:underline">Guardar</button>
                      <button onClick={() => setEditingActualStart(false)} className="text-textMuted text-xs hover:underline">Cancelar</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      {trip.actual_start ? new Date(trip.actual_start).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : 'No iniciado'}
                      <button onClick={() => setEditingActualStart(true)} className="text-textMuted hover:text-white" title="Establecer Inicio Real manualmente"><Edit className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              </div>

              {trip.actual_end && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-textSecondary"><Clock className="w-4 h-4 text-accentBlue" /> Fin Real</div>
                  <div className="text-white">{new Date(trip.actual_end).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</div>
                </div>
              )}
            </div>
          </div>

          {weather && (
            <div className="bg-bgSurface border border-borderDefault rounded-xl p-6 shadow-card shrink-0">
              <h3 className="text-sm font-bold text-accentBlue uppercase tracking-wider mb-4 border-b border-borderDefault pb-2 flex items-center gap-2" title="El clima mostrado corresponde a la posición actual del vehículo">
                {getWeatherDetails(weather.weathercode).icon}
                Clima en: {trip.events && trip.events.length > 0 && trip.events[trip.events.length - 1].address ? trip.events[trip.events.length - 1].address.substring(0, 30) + '...' : (trip.origin_location?.name || 'Origen')}
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-display font-bold text-white">{weather.temperature}°C</div>
                  <div className="text-textSecondary text-sm mt-1">Velocidad Viento: <span className="font-mono text-white">{weather.windspeed} km/h</span></div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <div className="text-xs text-textMuted mb-1">Condiciones</div>
                  <div className="text-sm font-bold text-accentBlue uppercase">{getWeatherDetails(weather.weathercode).label}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: EVENTOS Y MAPA */}
        <div className="lg:col-span-9 flex flex-col gap-6 h-full min-h-0">
          <div className="bg-bgStart border border-borderDefault rounded-xl flex-1 relative overflow-hidden flex flex-col items-center justify-center">
            <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
            
            {/* Switch para Mostrar Recorrido */}
            <div className="absolute top-4 right-4 z-10 bg-bgSurfaceHigh/90 backdrop-blur-sm border border-borderDefault rounded-lg shadow-card p-3 flex items-center gap-3">
              <label className="text-xs font-bold text-white uppercase tracking-wider cursor-pointer select-none" htmlFor="trace-switch">
                Trazar Recorrido GPS
              </label>
              <button
                id="trace-switch"
                onClick={() => setShowTrace(!showTrace)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${showTrace ? 'bg-accentBlue' : 'bg-borderDefault'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showTrace ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            {/* Opcional: overlay para mostrar info temporal si no hay ruta ni origen ni destino */}
            {!(trip as any).origin_lat && !(trip as any).destination_lat && !trip.route?.geojson && (
              <div className="absolute inset-0 bg-bgStart/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center pointer-events-none p-8 text-center">
                <MapPin className="w-16 h-16 mx-auto text-bgSurfaceHigh mb-4" />
                <p className="text-white font-bold mb-2">Sin Coordenadas Iniciales</p>
                <p className="text-textMuted text-sm max-w-sm">No se asignó origen, destino ni corredor en la planificación de este viaje. El mapa se centrará al recibir el primer evento de GPS.</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-72 shrink-0">
            {/* Event Logs */}
            <div className="bg-bgSurface border border-borderDefault rounded-xl shadow-card flex flex-col h-full min-h-0">
              <div className="p-4 border-b border-borderDefault shrink-0 flex items-center justify-between">
                <h3 className="text-sm font-bold text-accentGreen uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Registro de Eventos (Últimos 100)
                </h3>
                <span className="text-xs text-textMuted">{trip.events?.length || 0} total</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {trip.events && trip.events.length > 0 ? (
                  <div className="space-y-3">
                    {[...trip.events].reverse().slice(0, 100).map((evt: any) => (
                      <div key={evt.id} className="flex gap-4 text-sm p-3 bg-bgStart border border-borderDefault rounded">
                        <div className="text-textMuted w-16 shrink-0">
                          {new Date(evt.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                  <div className="h-full flex items-center justify-center text-textMuted text-sm text-center">
                    No hay eventos registrados en telemetría todavía.
                  </div>
                )}
              </div>
            </div>

            {/* Operator Logs (Bitácora) */}
            <div className="bg-bgSurface border border-borderDefault rounded-xl shadow-card flex flex-col h-full min-h-0">
              <div className="p-4 border-b border-borderDefault shrink-0 flex items-center justify-between bg-bgStart/30">
                <h3 className="text-sm font-bold text-accentBlue uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Bitácora del Operador
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col-reverse gap-3">
                {operatorLogs.length > 0 ? (
                  operatorLogs.map((log: any) => (
                    <div key={log.id} className="bg-bgStart border border-borderDefault rounded p-3 text-sm flex gap-3">
                      <div className="shrink-0 flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-accentBlue/20 text-accentBlue flex items-center justify-center font-bold text-xs uppercase">
                          {log.acknowledger?.name ? log.acknowledger.name.charAt(0) : 'U'}
                        </div>
                        <div className="text-[10px] text-textMuted mt-1 text-center">
                          {new Date(log.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-xs mb-1">
                          {log.acknowledger?.name || log.acknowledger?.email || 'Usuario'}
                          <span className="font-normal text-textMuted ml-2 text-[10px]">{new Date(log.triggered_at).toLocaleDateString()}</span>
                        </div>
                        <div className="text-textSecondary whitespace-pre-wrap break-words">{log.metadata_json?.note || ''}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-textMuted text-sm">
                    Sin anotaciones.
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-borderDefault bg-bgStart/50 shrink-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLogText}
                    onChange={(e) => setNewLogText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddLog()}
                    placeholder="Escribir anotación en bitácora..."
                    className="flex-1 bg-bgStart border border-borderDefault rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accentBlue"
                  />
                  <button
                    onClick={handleAddLog}
                    disabled={!newLogText.trim()}
                    className="bg-accentBlue text-bgStart p-2 rounded hover:bg-accentBlue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
