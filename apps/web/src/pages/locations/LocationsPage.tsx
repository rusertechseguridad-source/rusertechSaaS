import React, { useEffect, useState } from 'react';
import { useLocationsStore } from '../../store/locationsStore';
import { MapPin, Plus, Search, Edit, Trash2, Crosshair, X } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';

export const LocationsPage: React.FC = () => {
  const { locations, fetchLocations, deleteLocation, createLocation, updateLocation, loading } = useLocationsStore();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);

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
    <div className="p-8 h-[calc(100vh-4rem)] max-w-7xl mx-auto flex flex-col">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <h1 className="text-3xl font-display font-bold text-white flex items-center">
          <MapPin className="w-8 h-8 mr-3 text-accentGreen" />
          Ubicaciones y Nodos
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
                    onClick={() => setSelectedLocation(loc)}
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
                        </h3>
                        <div className="text-xs text-textMuted mt-1 uppercase tracking-wider">{loc.location_type}</div>
                        {loc.operation && (
                          <div className="text-xs text-accentMint font-medium mt-0.5">👤 {loc.operation.name}</div>
                        )}
                        {loc.address && <div className="text-xs text-textSecondary mt-1">{loc.address}</div>}
                      </div>
                      <RequirePermission permission="locations:edit">
                        <div className="flex space-x-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditModal(loc); }}
                            className="p-1.5 hover:bg-bgSurfaceHigh rounded text-textSecondary hover:text-white"
                            title="Editar ubicación"
                          >
                            <Edit className="w-4 h-4" />
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Map placeholder + info */}
        <div className="w-2/3 bg-bgStart border border-borderDefault rounded-xl relative overflow-hidden flex flex-col">
          <div className="absolute top-4 right-4 bg-bgSurface border border-borderDefault rounded p-2 text-xs text-textMuted z-10">
            [MapLibre GL Map View]
          </div>

          {selectedLocation ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="bg-bgSurface border border-borderDefault rounded-xl p-6 w-full max-w-md shadow-card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      {selectedLocation.name}
                      {selectedLocation.is_authorized_stop && (
                        <span className="bg-accentBlue/20 text-accentBlue border border-accentBlue/50 text-xs px-2 py-0.5 rounded uppercase font-bold">Parada Autorizada</span>
                      )}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-accentGreen uppercase tracking-wider">{selectedLocation.location_type}</span>
                      {selectedLocation.operation && (
                        <span className="text-xs text-accentMint font-medium bg-accentMint/10 px-2 py-0.5 rounded border border-accentMint/20">
                          Cliente: {selectedLocation.operation.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelectedLocation(null)} className="text-textMuted hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {selectedLocation.address && (
                  <p className="text-textSecondary text-sm mb-3">{selectedLocation.address}</p>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-bgStart rounded p-3 border border-borderDefault">
                    <div className="text-textMuted text-xs mb-1">Latitud</div>
                    <div className="text-white font-mono">{selectedLocation.latitude}</div>
                  </div>
                  <div className="bg-bgStart rounded p-3 border border-borderDefault">
                    <div className="text-textMuted text-xs mb-1">Longitud</div>
                    <div className="text-white font-mono">{selectedLocation.longitude}</div>
                  </div>
                  <div className="bg-bgStart rounded p-3 border border-borderDefault">
                    <div className="text-textMuted text-xs mb-1">Radio</div>
                    <div className="text-white font-mono">{selectedLocation.radius_meters} m</div>
                  </div>
                  <div className="bg-bgStart rounded p-3 border border-borderDefault">
                    <div className="text-textMuted text-xs mb-1">Estado</div>
                    <div className={`font-bold ${selectedLocation.is_active !== false ? 'text-statusOnline' : 'text-statusDanger'}`}>
                      {selectedLocation.is_active !== false ? 'Activo' : 'Inactivo'}
                    </div>
                  </div>
                </div>
                {selectedLocation.notes && (
                  <div className="mt-3 text-sm text-textSecondary bg-bgStart rounded p-3 border border-borderDefault">
                    <div className="text-textMuted text-xs mb-1">Notas</div>
                    {selectedLocation.notes}
                  </div>
                )}
                <RequirePermission permission="locations:edit">
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => openEditModal(selectedLocation)}
                      className="flex-1 px-4 py-2 bg-accentGreen text-bgStart font-bold rounded hover:bg-accentGreen/90 transition-colors text-sm"
                    >
                      Editar
                    </button>
                  </div>
                </RequirePermission>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Crosshair className="w-16 h-16 mx-auto text-bgSurfaceHigh mb-4" />
                <p className="text-textMuted font-mono">Seleccione una ubicación para ver sus detalles</p>
              </div>
            </div>
          )}
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
