import React, { useEffect, useState, useRef } from 'react';
import { useLocationsStore } from '../../store/locationsStore';
import { MapPin, Plus, Search, Edit, Trash2, Power } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export const LocationsPage: React.FC = () => {
  const { locations, fetchLocations, deleteLocation, createLocation, updateLocation, toggleActive, loading } = useLocationsStore();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [mapStyle, setMapStyle] = useState('https://tiles.openfreemap.org/styles/dark');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [locationType, setLocationType] = useState('generic');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState(100);
  const [notes, setNotes] = useState('');
  const [operationId, setOperationId] = useState('');
  const [isAuthorizedStop, setIsAuthorizedStop] = useState(false);
  const [operations, setOperations] = useState<any[]>([]);

  useEffect(() => {
    fetchLocations();
    fetchOperations();
  }, []);

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: [-58.3816, -34.6037], // Default center
      zoom: 10,
    });

    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update map style when it changes
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setStyle(mapStyle);
    }
  }, [mapStyle]);

  useEffect(() => {
    if (!mapRef.current) return;
    
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    if (selectedLocation && selectedLocation.longitude && selectedLocation.latitude) {
      const el = document.createElement('div');
      el.className = 'w-6 h-6 bg-accentMint rounded-full border-2 border-white shadow-[0_0_15px_rgba(43,244,182,0.8)] flex items-center justify-center';
      
      const dot = document.createElement('div');
      dot.className = 'w-2 h-2 bg-white rounded-full';
      el.appendChild(dot);

      markerRef.current = new maplibregl.Marker(el)
        .setLngLat([selectedLocation.longitude, selectedLocation.latitude])
        .addTo(mapRef.current);

      mapRef.current.flyTo({
        center: [selectedLocation.longitude, selectedLocation.latitude],
        zoom: 15,
        essential: true
      });
    }
  }, [selectedLocation]);

  const fetchOperations = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/operations', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setOperations(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error fetching operations', e);
    }
  };

  const filtered = locations.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setLocationType('generic');
    setAddress('');
    setLat('');
    setLng('');
    setRadius(100);
    setNotes('');
    setOperationId('');
    setIsAuthorizedStop(false);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (loc: any) => {
    setEditingId(loc.id);
    setName(loc.name);
    setLocationType(loc.location_type || 'generic');
    setAddress(loc.address || '');
    setLat(String(loc.latitude));
    setLng(String(loc.longitude));
    setRadius(loc.radius_meters || 100);
    setNotes(loc.notes || '');
    setOperationId(loc.operation_id || '');
    setIsAuthorizedStop(loc.is_authorized_stop || false);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = {
      name,
      location_type: locationType,
      address: address || null,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radius_meters: radius,
      notes: notes || null,
      operation_id: operationId || null,
      is_authorized_stop: isAuthorizedStop,
    };

    if (editingId) {
      await updateLocation(editingId, data);
    } else {
      await createLocation(data);
    }
    setShowModal(false);
    resetForm();
  };

  return (
    <div className="p-8 h-[calc(100vh-4rem)] w-full flex flex-col">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <h1 
          className="text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-accentMint to-accentBlue tracking-wider flex items-center"
          style={{ textShadow: '0 0 10px rgba(42,179,255,0.3)', animation: 'pulse 3s infinite' }}
        >
          <MapPin className="w-8 h-8 mr-3 text-accentMint" />
          Ubicaciones / POIs
        </h1>
        <RequirePermission permission="locations:edit">
          <button
            onClick={openCreateModal}
            className="bg-accentGreen hover:bg-accentGreen/90 text-bgStart px-4 py-2 rounded font-bold flex items-center shadow-lg shadow-accentGreen/20"
          >
            <Plus className="w-5 h-5 mr-2" /> Nueva Ubicación
          </button>
        </RequirePermission>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Left Panel: Location List */}
        <div className="w-1/3 flex flex-col bg-bgSurface border border-borderDefault rounded-xl overflow-hidden shadow-card">
          <div className="p-4 border-b border-borderDefault bg-bgStart/50 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar ubicación..."
                className="w-full bg-bgStart border border-borderDefault rounded-lg pl-10 pr-4 py-2 text-textPrimary focus:border-accentGreen focus:outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="text-center text-textMuted p-8">Cargando ubicaciones...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-textMuted p-8">No hay ubicaciones registradas</div>
            ) : (
              <div className="space-y-2">
                {filtered.map(loc => (
                  <div
                    key={loc.id}
                    onClick={() => {
                      setSelectedLocation(loc);
                      if (mapRef.current) {
                        mapRef.current.flyTo({ center: [loc.longitude as any, loc.latitude as any], zoom: 14, essential: true });
                      }
                    }}
                    className={`p-4 rounded-lg border cursor-pointer group transition-colors ${
                      selectedLocation?.id === loc.id
                        ? 'bg-accentGreen/10 border-accentGreen/30'
                        : 'bg-bgStart/40 hover:bg-bgSurfaceHigh border-borderDefault'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-white flex items-center gap-2">
                          {loc.name}
                          {loc.is_authorized_stop && (
                            <span className="bg-accentBlue/20 text-accentBlue border border-accentBlue/50 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold" title="Parada Autorizada">P.A.</span>
                          )}
                          <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${loc.is_active ? 'bg-statusSuccess/10 text-statusSuccess border border-statusSuccess/20' : 'bg-statusDanger/10 text-statusDanger border border-statusDanger/20'}`}>
                            {loc.is_active ? 'Activo' : 'Suspendido'}
                          </span>
                        </h3>
                        <div className="text-xs text-textMuted mt-1 uppercase tracking-wider">{loc.location_type}</div>
                        {loc.operation && (
                          <div className="text-xs text-accentMint font-medium mt-0.5">👤 {loc.operation.name}</div>
                        )}
                        {loc.address && <div className="text-xs text-textSecondary mt-1">{loc.address}</div>}
                      </div>
                      <RequirePermission permission="locations:edit">
                        <div className="flex space-x-1 shrink-0 ml-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditModal(loc); }}
                            className="p-1.5 hover:bg-bgSurfaceHigh rounded text-textSecondary hover:text-white"
                            title="Editar ubicación"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); if(confirm(`¿Estás seguro de ${loc.is_active ? 'suspender' : 'reactivar'} esta ubicación?`)) toggleActive(loc.id, !loc.is_active); }}
                            className={`p-1.5 hover:bg-bgSurfaceHigh rounded ${loc.is_active ? 'text-textSecondary hover:text-statusDanger' : 'text-textSecondary hover:text-statusSuccess'}`}
                            title={loc.is_active ? 'Suspender ubicación' : 'Reactivar ubicación'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); if(confirm('¿Eliminar ubicación?')) deleteLocation(loc.id); }}
                            className="p-1.5 hover:bg-bgSurfaceHigh rounded text-textSecondary hover:text-statusDanger"
                            title="Eliminar ubicación"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </RequirePermission>
                    </div>

                    {/* Mostrar detalles si está seleccionado */}
                    {selectedLocation?.id === loc.id && (
                      <div className="mt-4 pt-4 border-t border-accentGreen/20 animate-fade-in text-sm">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-textMuted text-[10px] uppercase">Latitud</div>
                            <div className="font-mono text-white">{loc.latitude}</div>
                          </div>
                          <div>
                            <div className="text-textMuted text-[10px] uppercase">Longitud</div>
                            <div className="font-mono text-white">
                              {loc.longitude}
                              <a 
                                href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="ml-2 text-accentBlue hover:underline text-xs"
                              >
                                Ver en Maps
                              </a>
                            </div>
                          </div>
                          <div>
                            <div className="text-textMuted text-[10px] uppercase">Radio</div>
                            <div className="font-mono text-white">{loc.radius_meters} m</div>
                          </div>
                          <div>
                            <div className="text-textMuted text-[10px] uppercase">Estado</div>
                            <div className={`font-bold ${loc.is_active !== false ? 'text-statusOnline' : 'text-statusDanger'}`}>
                              {loc.is_active !== false ? 'Activo' : 'Inactivo'}
                            </div>
                          </div>
                        </div>
                        {loc.notes && (
                          <div className="mt-3 text-textSecondary italic text-xs">"{loc.notes}"</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Map */}
        <div className="w-2/3 bg-bgStart border border-borderDefault rounded-xl relative overflow-hidden flex flex-col shadow-card">
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />
          {!selectedLocation && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-textMuted pointer-events-none z-10 bg-bgStart/60 backdrop-blur-sm transition-all duration-500">
              <MapPin className="w-16 h-16 mb-4 opacity-30 animate-pulse" />
              <p className="text-lg font-medium text-white/50">Seleccione una ubicación en la lista</p>
            </div>
          )}

          {/* Map Style Selector - Bottom Left */}
          <div
            className="absolute bottom-6 left-4 z-20 flex gap-2"
            style={{
              background: 'rgba(10,18,30,0.82)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            {[
              { label: 'Oscuro', value: 'https://tiles.openfreemap.org/styles/dark' },
              { label: 'Claro', value: 'https://tiles.openfreemap.org/styles/liberty' },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => setMapStyle(opt.value)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  mapStyle === opt.value
                    ? 'bg-white/10 text-white font-bold shadow-sm border border-white/20'
                    : 'text-textMuted hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-bgOverlay z-50 flex items-center justify-center p-4">
          <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-lg shadow-card flex flex-col" style={{ maxHeight: '85vh' }}>
            <div className="p-6 border-b border-borderDefault shrink-0">
              <h2 className="text-2xl font-bold text-white">{editingId ? 'Editar Ubicación' : 'Nueva Ubicación'}</h2>
            </div>
            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                <div>
                  <label className="block text-sm text-textSecondary mb-1">Nombre *</label>
                  <input required type="text" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm text-textSecondary mb-1">Tipo</label>
                  <select className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={locationType} onChange={e => setLocationType(e.target.value)}>
                    <option value="generic">Genérico</option>
                    <option value="origen">Origen</option>
                    <option value="destino">Destino</option>
                    <option value="deposito">Depósito</option>
                    <option value="planta">Planta</option>
                    <option value="cliente">Cliente</option>
                    <option value="puerto">Puerto</option>
                    <option value="aduana">Aduana</option>
                    <option value="peaje">Peaje</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-textSecondary mb-1">Dirección</label>
                  <input type="text" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={address} onChange={e => setAddress(e.target.value)} />
                </div>
                
                <div className="border-t border-borderDefault pt-4 mt-2">
                  <h3 className="text-sm font-bold text-accentGreen uppercase tracking-wider mb-3">Asignación Operativa</h3>
                  <div className="mb-3">
                    <label className="block text-sm text-textSecondary mb-1">Cliente / Operación</label>
                    <select className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={operationId} onChange={e => setOperationId(e.target.value)}>
                      <option value="">— Ninguno (Uso Interno) —</option>
                      {operations.map(op => (
                        <option key={op.id} value={op.id}>{op.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" checked={isAuthorizedStop} onChange={e => setIsAuthorizedStop(e.target.checked)} className="rounded text-accentGreen bg-bgStart border-borderDefault focus:ring-accentGreen h-4 w-4" />
                      <span className="text-sm text-white font-medium">Parada Autorizada (P.A.)</span>
                    </label>
                    <p className="text-xs text-textMuted mt-1 ml-6">
                      Indica si el vehículo tiene permitido detenerse en esta ubicación durante el viaje.
                    </p>
                  </div>
                </div>

                <div className="border-t border-borderDefault pt-4 flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm text-textSecondary mb-1">Latitud *</label>
                    <input required type="number" step="any" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={lat} onChange={e => setLat(e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm text-textSecondary mb-1">Longitud *</label>
                    <input required type="number" step="any" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={lng} onChange={e => setLng(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-textSecondary mb-1">Radio de Llegada (metros)</label>
                  <input required type="number" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={radius} onChange={e => setRadius(parseInt(e.target.value) || 100)} />
                </div>
                <div>
                  <label className="block text-sm text-textSecondary mb-1">Notas</label>
                  <textarea className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none h-20 resize-none" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>
              <div className="p-6 border-t border-borderDefault flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="px-4 py-2 rounded text-textSecondary hover:text-white transition-colors">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-accentGreen text-bgStart font-bold rounded hover:bg-accentGreen/90 transition-colors">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
