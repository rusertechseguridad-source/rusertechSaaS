import React, { useEffect, useState } from 'react';
import { useLocationsStore } from '../../store/locationsStore';
import { MapPin, Plus, Search, Edit, Trash2, Crosshair } from 'lucide-react';

export const LocationsPage: React.FC = () => {
  const { locations, fetchLocations, deleteLocation, createLocation, loading } = useLocationsStore();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [locationType, setLocationType] = useState('generic');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState(100);

  useEffect(() => {
    fetchLocations();
  }, []);

  const filtered = locations.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createLocation({
      name,
      location_type: locationType,
      address: address || null,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radius_meters: radius,
    });
    setShowModal(false);
    setName('');
    setAddress('');
    setLat('');
    setLng('');
    setRadius(100);
  };

  return (
    <div className="p-8 h-[calc(100vh-4rem)] max-w-7xl mx-auto flex flex-col">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <h1 className="text-3xl font-display font-bold text-white flex items-center">
          <MapPin className="w-8 h-8 mr-3 text-accentGreen" />
          Ubicaciones y Nodos
        </h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-accentGreen hover:bg-accentGreen/90 text-bgStart px-4 py-2 rounded font-bold flex items-center shadow-lg shadow-accentGreen/20"
        >
          <Plus className="w-5 h-5 mr-2" /> Nueva Ubicación
        </button>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
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
                  <div key={loc.id} className="p-4 rounded-lg bg-bgStart/40 hover:bg-bgSurfaceHigh border border-borderDefault cursor-pointer group transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-white">{loc.name}</h3>
                        <div className="text-xs text-textMuted mt-1 uppercase tracking-wider">{loc.location_type}</div>
                      </div>
                      <div className="flex space-x-1">
                        <button className="p-1.5 hover:bg-bgSurfaceHigh rounded text-textSecondary hover:text-white">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); if(confirm('Eliminar ubicación?')) deleteLocation(loc.id); }}
                          className="p-1.5 hover:bg-bgSurfaceHigh rounded text-textSecondary hover:text-statusDanger"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-2/3 bg-bgStart border border-borderDefault rounded-xl relative overflow-hidden flex items-center justify-center">
          <div className="absolute top-4 right-4 bg-bgSurface border border-borderDefault rounded p-2 text-xs text-textMuted z-10">
            [MapLibre GL Map View]
          </div>
          <div className="text-center">
            <Crosshair className="w-16 h-16 mx-auto text-bgSurfaceHigh mb-4" />
            <p className="text-textMuted font-mono">Seleccione una ubicación para visualizarla en el mapa</p>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-bgOverlay z-50 flex items-center justify-center p-4">
          <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-lg shadow-card flex flex-col" style={{ maxHeight: '80vh' }}>
            <div className="p-6 border-b border-borderDefault shrink-0">
              <h2 className="text-2xl font-bold text-white">Nueva Ubicación</h2>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                <div>
                  <label className="block text-sm text-textSecondary mb-1">Nombre</label>
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
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-textSecondary mb-1">Dirección (opcional)</label>
                  <input type="text" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={address} onChange={e => setAddress(e.target.value)} />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm text-textSecondary mb-1">Latitud</label>
                    <input required type="number" step="any" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={lat} onChange={e => setLat(e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm text-textSecondary mb-1">Longitud</label>
                    <input required type="number" step="any" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={lng} onChange={e => setLng(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-textSecondary mb-1">Radio de Llegada (metros)</label>
                  <input required type="number" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={radius} onChange={e => setRadius(parseInt(e.target.value))} />
                </div>
              </div>
              <div className="p-6 border-t border-borderDefault flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded text-textSecondary hover:text-white transition-colors">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-accentGreen text-bgStart font-bold rounded hover:bg-accentGreen/90 transition-colors">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
