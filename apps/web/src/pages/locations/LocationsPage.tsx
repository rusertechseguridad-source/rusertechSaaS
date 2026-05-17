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
      address,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radius_meters: radius,
    });
    setShowModal(false);
    setName('');
    setAddress('');
    setLat('');
    setLng('');
  };

  return (
    <div className="p-8 h-[calc(100vh-4rem)] max-w-7xl mx-auto flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-display font-bold text-white flex items-center">
          <MapPin className="w-8 h-8 mr-3 text-brand" />
          Ubicaciones y Nodos
        </h1>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-brand hover:bg-brand/90 text-black px-4 py-2 rounded font-bold flex items-center shadow-lg shadow-brand/20"
        >
          <Plus className="w-5 h-5 mr-2" /> Nueva Ubicación
        </button>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        <div className="w-1/3 flex flex-col bg-surface border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-gray-800 bg-black/20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Buscar ubicación..." 
                className="w-full bg-black border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:border-brand focus:outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="text-center text-gray-500 p-8">Cargando ubicaciones...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-gray-500 p-8">No hay ubicaciones registradas</div>
            ) : (
              <div className="space-y-2">
                {filtered.map(loc => (
                  <div key={loc.id} className="p-4 rounded-lg bg-black/40 hover:bg-gray-800 border border-gray-800 cursor-pointer group transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-white">{loc.name}</h3>
                        <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">{loc.location_type}</div>
                      </div>
                      <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); if(confirm('Eliminar ubicación?')) deleteLocation(loc.id); }}
                          className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
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

        <div className="w-2/3 bg-black border border-gray-800 rounded-xl relative overflow-hidden flex items-center justify-center">
          <div className="absolute top-4 right-4 bg-gray-900 border border-gray-700 rounded p-2 text-xs text-gray-400 z-10">
            [MapLibre GL Map View]
          </div>
          <div className="text-center">
            <Crosshair className="w-16 h-16 mx-auto text-gray-800 mb-4" />
            <p className="text-gray-600 font-mono">Seleccione una ubicación para visualizarla en el mapa</p>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] flex flex-col">
            <h2 className="text-2xl font-bold text-white mb-6 shrink-0">Nueva Ubicación</h2>
            <form onSubmit={handleCreate} className="space-y-4 overflow-y-auto pr-2 flex-1">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nombre</label>
                <input required type="text" className="w-full bg-black border border-gray-700 rounded p-2 text-white" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tipo</label>
                <select className="w-full bg-black border border-gray-700 rounded p-2 text-white" value={locationType} onChange={e => setLocationType(e.target.value)}>
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
                <label className="block text-sm text-gray-400 mb-1">Dirección (opcional)</label>
                <input type="text" className="w-full bg-black border border-gray-700 rounded p-2 text-white" value={address} onChange={e => setAddress(e.target.value)} />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-1">Latitud</label>
                  <input required type="number" step="any" className="w-full bg-black border border-gray-700 rounded p-2 text-white" value={lat} onChange={e => setLat(e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-1">Longitud</label>
                  <input required type="number" step="any" className="w-full bg-black border border-gray-700 rounded p-2 text-white" value={lng} onChange={e => setLng(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Radio de Llegada (metros)</label>
                <input required type="number" className="w-full bg-black border border-gray-700 rounded p-2 text-white" value={radius} onChange={e => setRadius(parseInt(e.target.value))} />
              </div>
              
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-800 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded text-gray-400 hover:text-white">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-brand text-black font-bold rounded hover:bg-brand/90">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
