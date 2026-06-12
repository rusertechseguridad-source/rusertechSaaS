import React, { useEffect, useState, useRef } from 'react';
import { useTripsStore, type Trip } from '../../store/tripsStore';
import { Map, Plus, Search, Calendar, MapPin, Truck, ChevronRight, Play, CheckCircle, Key, Cloud, CloudRain, Sun, CloudLightning, Snowflake, CloudFog, CloudDrizzle, CloudSun, ExternalLink, Filter, X } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';
import { Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const getWeatherDetails = (code: number) => {
  if (code === 0) return { label: 'Despejado', icon: <Sun className="w-4 h-4 text-yellow-400" /> };
  if (code >= 1 && code <= 3) return { label: 'Parcialmente Nublado', icon: <CloudSun className="w-4 h-4 text-gray-300" /> };
  if (code >= 45 && code <= 48) return { label: 'Niebla', icon: <CloudFog className="w-4 h-4 text-gray-400" /> };
  if (code >= 51 && code <= 55) return { label: 'Llovizna', icon: <CloudDrizzle className="w-4 h-4 text-blue-300" /> };
  if (code >= 61 && code <= 65) return { label: 'Lluvia', icon: <CloudRain className="w-4 h-4 text-blue-400" /> };
  if (code >= 71 && code <= 77) return { label: 'Nieve', icon: <Snowflake className="w-4 h-4 text-white" /> };
  if (code >= 95) return { label: 'Tormenta', icon: <CloudLightning className="w-4 h-4 text-yellow-500" /> };
  return { label: 'Nublado', icon: <Cloud className="w-4 h-4 text-gray-400" /> };
};

const LiveTripData: React.FC<{ event: any }> = ({ event }) => {
  const [weather, setWeather] = useState<any>(null);

  useEffect(() => {
    if (event && event.lat && event.lng) {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${event.lat}&longitude=${event.lng}&current_weather=true`)
        .then(res => res.json())
        .then(data => {
          if (data.current_weather) setWeather(data.current_weather);
        })
        .catch(console.error);
    }
  }, [event]);

  if (!event) {
    return (
      <div className="mt-3 pt-3 border-t border-borderDefault/50 bg-bgSurface/50 p-2 rounded text-xs text-center text-textMuted italic">
        Aguardando primeros datos de telemetría...
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-borderDefault/50 bg-bgSurface/50 p-2 rounded text-xs space-y-2">
      <div className="flex justify-between items-center text-accentMint font-medium mb-1">
        <span>Última Posición: {new Date(event.generated_at).toLocaleString()}</span>
        {event.speed !== null && <span>{event.speed} km/h</span>}
      </div>
      
      {event.address && <div className="text-textSecondary truncate">{event.address}</div>}
      
      <div className="flex justify-between items-center mt-2">
        {event.lat && event.lng ? (
          <a 
            href={`https://www.google.com/maps?q=${event.lat},${event.lng}`} 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center text-accentBlue hover:underline"
          >
            <MapPin className="w-3 h-3 mr-1" />
            {event.lat.toFixed(4)}, {event.lng.toFixed(4)}
          </a>
        ) : <span />}

        {weather && (
          <div className="flex items-center text-white" title={getWeatherDetails(weather.weathercode).label}>
            {getWeatherDetails(weather.weathercode).icon}
            <span className="ml-1">{weather.temperature}°C</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const TripsPage: React.FC = () => {
  const { trips, fetchTrips, createTrip, updateTrip, deleteTrip, loading } = useTripsStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  
  // Data for selectors
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [avlUsers, setAvlUsers] = useState<any[]>([]);

  // Filters State
  const [operationFilter, setOperationFilter] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');
  const [avlFilter, setAvlFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [tripCode, setTripCode] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [operationId, setOperationId] = useState('');
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');

  useEffect(() => {
    fetchTrips();
    fetchDependencies();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: [-58.3816, -34.6037],
      zoom: 10
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const fetchDependencies = async () => {
    const token = localStorage.getItem('rusertech_token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [vRes, oRes, lRes, rRes, cRes, aRes] = await Promise.all([
        fetch('http://localhost:3000/api/v1/vehicles', { headers }),
        fetch('http://localhost:3000/api/v1/operations', { headers }),
        fetch('http://localhost:3000/api/v1/locations', { headers }),
        fetch('http://localhost:3000/api/v1/routes', { headers }),
        fetch('http://localhost:3000/api/v1/carriers', { headers }),
        fetch('http://localhost:3000/api/v1/avl-users', { headers }),
      ]);
      if (vRes.ok) { const d = await vRes.json(); setVehicles(Array.isArray(d) ? d : (d.data || [])); }
      if (oRes.ok) { const d = await oRes.json(); setOperations(Array.isArray(d) ? d : []); }
      if (lRes.ok) { const d = await lRes.json(); setLocations(Array.isArray(d) ? d : []); }
      if (rRes.ok) { const d = await rRes.json(); setRoutes(Array.isArray(d) ? d : []); }
      if (cRes.ok) { const d = await cRes.json(); setCarriers(Array.isArray(d) ? d : []); }
      if (aRes.ok) { const d = await aRes.json(); setAvlUsers(Array.isArray(d) ? d : []); }
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = trips.filter(t => 
    (!statusFilter || t.status === statusFilter) &&
    (!operationFilter || t.operation_id === operationFilter) &&
    (!carrierFilter || t.vehicle?.carrier_id === carrierFilter) &&
    (!avlFilter || t.vehicle?.avl_user_id === avlFilter) &&
    (t.name.toLowerCase().includes(search.toLowerCase()) || 
    (t.trip_code && t.trip_code.toLowerCase().includes(search.toLowerCase())) ||
    (t.vehicle?.plate.toLowerCase().includes(search.toLowerCase())))
  );

  useEffect(() => {
    if (!map.current) return;
    
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    
    const activeTrips = filtered.filter(t => t.status === 'EN_CURSO' || t.status === 'PROGRAMADO');
    
    const bounds = new maplibregl.LngLatBounds();
    let hasBounds = false;

    activeTrips.forEach(trip => {
      const originLat = (trip as any).origin_lat;
      const originLng = (trip as any).origin_lng;
      
      if (originLat && originLng) {
         const el = document.createElement('div');
         el.className = 'w-8 h-8 bg-bgStart border-2 border-accentGreen rounded-full shadow-[0_0_15px_rgba(42,179,255,0.8)] flex items-center justify-center text-accentGreen cursor-pointer relative';
         el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14v10h1"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`;
         
         const marker = new maplibregl.Marker({ element: el })
           .setLngLat([originLng, originLat])
           .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(`
             <div class="p-2 max-w-xs text-center">
               <h3 class="font-bold text-gray-900 mb-1 text-sm">${trip.name}</h3>
               <p class="text-xs text-gray-600 mb-2">🚗 ${trip.vehicle?.plate || 'N/A'}</p>
               <a href="/trips/${trip.id}" class="inline-block px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700">VER DETALLE</a>
             </div>
           `))
           .addTo(map.current!);
           
         markersRef.current.push(marker);
         bounds.extend([originLng, originLat]);
         hasBounds = true;
      }
    });

    if (hasBounds) {
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 12 });
    }
  }, [filtered]);

  const resetForm = () => {
    setName('');
    setTripCode('');
    setVehicleId('');
    setOperationId('');
    setOriginId('');
    setDestinationId('');
    setRouteId('');
    
    // Set default date to now and 24 hours from now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setScheduledStart(now.toISOString().slice(0, 16));
    
    const tomorrow = new Date(now);
    tomorrow.setHours(tomorrow.getHours() + 24);
    setScheduledEnd(tomorrow.toISOString().slice(0, 16));
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTrip({
      name,
      trip_code: tripCode || null,
      vehicle_id: vehicleId,
      operation_id: operationId || null,
      origin_location_id: originId || null,
      destination_location_id: destinationId || null,
      route_id: routeId || null,
      scheduled_start: new Date(scheduledStart).toISOString(),
      scheduled_end: scheduledEnd ? new Date(scheduledEnd).toISOString() : null,
      status: 'PROGRAMADO'
    });
    setShowModal(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PROGRAMADO': return 'bg-accentBlue/20 text-accentBlue border-accentBlue/30';
      case 'EN_CURSO': return 'bg-accentGreen/20 text-accentGreen border-accentGreen/30';
      case 'FINALIZADO': return 'bg-textMuted/20 text-textMuted border-textMuted/30';
      case 'CANCELADO': return 'bg-statusDanger/20 text-statusDanger border-statusDanger/30';
      default: return 'bg-bgSurfaceHigh text-textSecondary border-borderDefault';
    }
  };

  return (
    <div className="p-8 h-[calc(100vh-4rem)] w-full flex flex-col">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <h1 
          className="text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-accentGreen to-accentBlue tracking-wider flex items-center"
          style={{ textShadow: '0 0 10px rgba(42,179,255,0.3)', animation: 'pulse 3s infinite' }}
        >
          <Map className="w-8 h-8 mr-3 text-accentGreen" />
          Viajes y Monitoreo
        </h1>
        <RequirePermission permission="trips:manage">
          <button
            onClick={openCreateModal}
            className="bg-accentGreen hover:bg-accentGreen/90 text-bgStart px-4 py-2 rounded font-bold flex items-center shadow-lg shadow-accentGreen/20 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" /> Programar Viaje
          </button>
        </RequirePermission>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        
        {/* Left Column: Trip List */}
        <div className="w-[450px] xl:w-[550px] shrink-0 bg-bgSurface border border-borderDefault rounded-xl overflow-hidden shadow-card flex flex-col min-h-0">
          <div className="p-4 border-b border-borderDefault bg-bgStart/50 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar viajes..."
                className="w-full bg-bgStart border border-borderDefault rounded-lg pl-10 pr-4 py-2 text-textPrimary focus:border-accentGreen focus:outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button 
                onClick={() => setStatusFilter(statusFilter === 'EN_CURSO' ? null : 'EN_CURSO')}
                className={`text-xs font-medium px-2 py-1 rounded border transition-colors cursor-pointer ${statusFilter === 'EN_CURSO' ? 'bg-accentGreen text-bgStart border-accentGreen shadow-[0_0_10px_rgba(43,244,182,0.4)]' : 'bg-accentGreen/10 text-accentGreen border-accentGreen/20 hover:bg-accentGreen/20'}`}
              >
                {trips.filter(t => t.status === 'EN_CURSO').length} EN CURSO
              </button>
              <button 
                onClick={() => setStatusFilter(statusFilter === 'PROGRAMADO' ? null : 'PROGRAMADO')}
                className={`text-xs font-medium px-2 py-1 rounded border transition-colors cursor-pointer ${statusFilter === 'PROGRAMADO' ? 'bg-accentBlue text-bgStart border-accentBlue shadow-[0_0_10px_rgba(42,179,255,0.4)]' : 'bg-accentBlue/10 text-accentBlue border-accentBlue/20 hover:bg-accentBlue/20'}`}
              >
                {trips.filter(t => t.status === 'PROGRAMADO').length} PROGRAMADOS
              </button>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`ml-auto text-xs font-medium px-2 py-1 rounded border transition-colors flex items-center gap-1 ${showFilters ? 'bg-bgSurfaceHigh text-white border-borderDefault' : 'bg-transparent text-textMuted border-transparent hover:text-white'}`}
              >
                <Filter className="w-3.5 h-3.5" /> Filtros
              </button>
            </div>
            
            {showFilters && (
              <div className="mt-3 pt-3 border-t border-borderDefault grid grid-cols-1 gap-2 animate-fade-in text-xs">
                <select
                  className="w-full bg-bgStart border border-borderDefault rounded px-2 py-1.5 text-textPrimary focus:border-accentGreen focus:outline-none"
                  value={operationFilter}
                  onChange={(e) => setOperationFilter(e.target.value)}
                >
                  <option value="">Todos los Clientes</option>
                  {operations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <select
                  className="w-full bg-bgStart border border-borderDefault rounded px-2 py-1.5 text-textPrimary focus:border-accentGreen focus:outline-none"
                  value={carrierFilter}
                  onChange={(e) => setCarrierFilter(e.target.value)}
                >
                  <option value="">Todos los Transportistas</option>
                  {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select
                  className="w-full bg-bgStart border border-borderDefault rounded px-2 py-1.5 text-textPrimary focus:border-accentGreen focus:outline-none"
                  value={avlFilter}
                  onChange={(e) => setAvlFilter(e.target.value)}
                >
                  <option value="">Todos los Proveedores GPS</option>
                  {avlUsers.map(a => <option key={a.id} value={a.id}>{a.provider_name}</option>)}
                </select>
                {(operationFilter || carrierFilter || avlFilter) && (
                  <button 
                    onClick={() => { setOperationFilter(''); setCarrierFilter(''); setAvlFilter(''); }}
                    className="mt-1 text-statusDanger hover:text-red-400 flex items-center justify-center gap-1 py-1"
                  >
                    <X className="w-3 h-3" /> Limpiar filtros
                  </button>
                )}
              </div>
            )}
          </div>
  
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-textMuted">Cargando viajes...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-textMuted">No se encontraron viajes.</div>
          ) : (
            filtered.map(trip => (
              <div key={trip.id} className="bg-bgStart border border-borderDefault rounded-lg p-5 hover:border-accentGreen transition-colors group relative flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-white text-lg truncate pr-4">{trip.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-textMuted bg-bgSurfaceHigh px-1.5 py-0.5 rounded">{trip.trip_code || 'SIN_CODIGO'}</span>
                      {trip.operation && <span className="text-xs font-medium text-accentMint bg-accentMint/10 px-1.5 py-0.5 rounded border border-accentMint/20 truncate max-w-[150px]">👤 {trip.operation.name}</span>}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border shadow-sm shrink-0 ${getStatusColor(trip.status)}`}>
                    {trip.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 text-sm text-textSecondary bg-bgSurface/40 p-3 rounded-lg border border-borderDefault/50">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-accentGreen shrink-0" />
                    <span className="font-medium text-white truncate" title={trip.vehicle?.plate}>{trip.vehicle?.plate || '—'}</span>
                    
                    {/* Tooltip AVL Credentials */}
                    {trip.vehicle?.avl_user && (
                      <div className="relative group/tooltip ml-1">
                        <Key className="w-3.5 h-3.5 text-accentBlue cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block w-72 bg-bgSurface border border-borderDefault p-4 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] z-50 text-xs before:content-[''] before:absolute before:left-1/2 before:-translate-x-1/2 before:-bottom-2 before:border-l-8 before:border-r-8 before:border-t-8 before:border-transparent before:border-t-borderDefault">
                          <div className="before:content-[''] before:absolute before:left-1/2 before:-translate-x-1/2 before:-bottom-[7px] before:border-l-[7px] before:border-r-[7px] before:border-t-[7px] before:border-transparent before:border-t-bgSurface" />
                          <p className="font-bold text-white mb-2 pb-2 border-b border-borderDefault flex items-center gap-2">
                            <Key className="w-3 h-3 text-accentBlue" />
                            Credenciales: {trip.vehicle.avl_user.provider_name}
                          </p>
                          <div className="space-y-2">
                            {!trip.vehicle.avl_user.provider_platform_url && !trip.vehicle.avl_user.provider_username && !trip.vehicle.avl_user.provider_password && !trip.vehicle.avl_user.operational_contact && !trip.vehicle.avl_user.provider_notes && (
                              <p className="text-textMuted italic text-center py-2">Sin datos registrados</p>
                            )}
                            {trip.vehicle.avl_user.provider_platform_url && (
                              <p className="flex items-center justify-between">
                                <span className="text-textMuted">Link:</span>
                                <a href={trip.vehicle.avl_user.provider_platform_url.startsWith('http') ? trip.vehicle.avl_user.provider_platform_url : `https://${trip.vehicle.avl_user.provider_platform_url}`} target="_blank" rel="noreferrer" className="text-accentBlue hover:underline flex items-center">
                                  Plataforma AVL <ExternalLink className="w-3 h-3 ml-1" />
                                </a>
                              </p>
                            )}
                            {trip.vehicle.avl_user.provider_username && (
                              <p className="flex items-center justify-between">
                                <span className="text-textMuted">Usuario:</span>
                                <span className="font-mono text-white select-all bg-bgStart px-1.5 py-0.5 rounded">{trip.vehicle.avl_user.provider_username}</span>
                              </p>
                            )}
                            {trip.vehicle.avl_user.provider_password && (
                              <p className="flex items-center justify-between">
                                <span className="text-textMuted">Clave:</span>
                                <span className="font-mono text-white select-all bg-bgStart px-1.5 py-0.5 rounded">{trip.vehicle.avl_user.provider_password}</span>
                              </p>
                            )}
                            {trip.vehicle.avl_user.operational_contact && (
                              <p className="flex items-center justify-between">
                                <span className="text-textMuted">Contacto:</span>
                                <span className="text-white bg-bgStart px-1.5 py-0.5 rounded">{trip.vehicle.avl_user.operational_contact}</span>
                              </p>
                            )}
                            {trip.vehicle.avl_user.provider_notes && (
                              <div className="mt-3 pt-3 border-t border-borderDefault">
                                <span className="text-textMuted block mb-1">Otras Credenciales / Notas:</span>
                                <div className="text-white whitespace-pre-wrap select-all max-h-32 overflow-y-auto bg-bgStart p-2 rounded leading-relaxed border border-borderDefault/50">
                                  {trip.vehicle.avl_user.provider_notes}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-textMuted text-[10px] uppercase">Chofer:</span>
                    <span className="font-medium text-white truncate" title={trip.driver?.full_name}>{trip.driver?.full_name || '—'}</span>
                  </div>

                  <div className="flex items-center gap-2 col-span-2">
                    <MapPin className="w-4 h-4 text-textMuted shrink-0" />
                    <div className="text-xs truncate w-full flex items-center">
                      <span className="truncate" title={trip.origin_location?.name}>{trip.origin_location?.name || 'Indefinido'}</span>
                      <span className="text-accentBlue mx-2 font-bold">→</span>
                      <span className="truncate" title={trip.destination_location?.name}>{trip.destination_location?.name || 'Indefinido'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-1 px-1">
                  <div className="text-xs text-textMuted flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(trip.scheduled_start).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                  <Link to={`/trips/${trip.id}`} className="bg-bgSurfaceHigh hover:bg-accentBlue hover:text-bgStart px-3 py-1.5 rounded text-xs font-bold text-white transition-colors flex items-center gap-1 shadow-sm">
                    Ver Detalles <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                  {/* Live Trip Data Section */}
                  {trip.status === 'EN_CURSO' && (
                    <LiveTripData event={trip.events && trip.events.length > 0 ? trip.events[0] : null} />
                  )}
              </div>
            ))
          )}
        </div>
      </div>

        {/* Right Column: Map */}
        <div className="flex-1 bg-bgStart border border-borderDefault rounded-xl relative overflow-hidden flex flex-col shadow-card min-w-0">
          <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-bgOverlay z-50 flex items-center justify-center p-4">
          <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-2xl shadow-card flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="p-6 border-b border-borderDefault shrink-0">
              <h2 className="text-2xl font-bold text-white">Programar Nuevo Viaje</h2>
            </div>
            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 overflow-y-auto flex-1 space-y-5">
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-textSecondary mb-1">Nombre del Viaje *</label>
                    <input required type="text" placeholder="Ej: Viaje a Rosario" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={name} onChange={e => setName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm text-textSecondary mb-1">Código de Viaje (Opcional)</label>
                    <input type="text" placeholder="Ej: VJ-2023-001" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white font-mono focus:border-accentGreen focus:outline-none" value={tripCode} onChange={e => setTripCode(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-textSecondary mb-1">Vehículo *</label>
                  <select required className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white font-bold focus:border-accentGreen focus:outline-none" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                    <option value="">— Seleccionar Vehículo —</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.plate} {v.alias ? `(${v.alias})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="border-t border-borderDefault pt-4">
                  <h3 className="text-sm font-bold text-accentGreen uppercase tracking-wider mb-3">Logística</h3>
                  
                  <div className="mb-3">
                    <label className="block text-sm text-textSecondary mb-1">Cliente / Operación</label>
                    <select className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={operationId} onChange={e => setOperationId(e.target.value)}>
                      <option value="">— Ninguno (Interno) —</option>
                      {operations.map(op => (
                        <option key={op.id} value={op.id}>{op.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-sm text-textSecondary mb-1">Origen</label>
                      <select className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={originId} onChange={e => setOriginId(e.target.value)}>
                        <option value="">— Indefinido —</option>
                        {locations.filter(l => !operationId || l.operation_id === operationId).map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-textSecondary mb-1">Destino</label>
                      <select className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={destinationId} onChange={e => setDestinationId(e.target.value)}>
                        <option value="">— Indefinido —</option>
                        {locations.filter(l => !operationId || l.operation_id === operationId).map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-textSecondary mb-1">Corredor / Ruta (Opcional)</label>
                    <select className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={routeId} onChange={e => setRouteId(e.target.value)}>
                      <option value="">— Sin Control de Desvío —</option>
                      {routes.filter(r => !operationId || r.operation_id === operationId).map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-textMuted mt-1">Si se asigna una ruta, el sistema generará alertas de desvío al salir del corredor.</p>
                  </div>
                </div>

                <div className="border-t border-borderDefault pt-4">
                  <h3 className="text-sm font-bold text-accentGreen uppercase tracking-wider mb-3">Programación Horaria</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-textSecondary mb-1">Inicio Programado *</label>
                      <input required type="datetime-local" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={scheduledStart} onChange={e => setScheduledStart(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm text-textSecondary mb-1">Fin Programado Estimado</label>
                      <input type="datetime-local" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={scheduledEnd} onChange={e => setScheduledEnd(e.target.value)} />
                    </div>
                  </div>
                </div>

              </div>
              <div className="p-6 border-t border-borderDefault flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded text-textSecondary hover:text-white transition-colors">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-accentGreen text-bgStart font-bold rounded hover:bg-accentGreen/90 transition-colors flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" /> Guardar Viaje
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
