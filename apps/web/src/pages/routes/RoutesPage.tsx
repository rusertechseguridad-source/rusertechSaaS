import React, { useEffect, useState } from 'react';
import { useRoutesStore } from '../../store/routesStore';
import { Map, Plus, Search, Upload, Download, Route as RouteIcon, Trash2, Edit } from 'lucide-react';

export const RoutesPage: React.FC = () => {
  const { routes, fetchRoutes, deleteRoute, createRoute, loading } = useRoutesStore();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [kmlContent, setKmlContent] = useState('');
  const [routeName, setRouteName] = useState('');

  useEffect(() => {
    fetchRoutes();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setKmlContent(evt.target?.result as string);
        setRouteName(file.name.replace('.kml', ''));
        setShowModal(true);
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate KML parsing here
    const geojson = {
      type: "LineString",
      coordinates: [
        [-58.3816, -34.6037],
        [-58.3820, -34.6040]
      ]
    };
    
    await createRoute({
      name: routeName,
      corridor_meters: 500,
      geojson
    });
    
    setShowModal(false);
    setKmlContent('');
    setRouteName('');
  };

  return (
    <div className="p-8 h-[calc(100vh-4rem)] max-w-7xl mx-auto flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-display font-bold text-white flex items-center">
          <RouteIcon className="w-8 h-8 mr-3 text-brand" />
          Recorridos KML
        </h1>
        <div className="flex gap-4">
          <label className="cursor-pointer bg-surface border border-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded font-bold flex items-center shadow-lg transition-colors">
            <Upload className="w-5 h-5 mr-2" /> Importar KML
            <input type="file" accept=".kml" className="hidden" onChange={handleFileUpload} />
          </label>
          <button 
            onClick={() => alert('La creación manual de rutas requiere la integración completa del mapa interactivo (MapLibre GL Draw). Por el momento, por favor utilice la función "Importar KML".')}
            className="bg-brand hover:bg-brand/90 text-black px-4 py-2 rounded font-bold flex items-center shadow-lg shadow-brand/20"
          >
            <Plus className="w-5 h-5 mr-2" /> Crear Manual
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Left Side: Tree */}
        <div className="w-1/3 flex flex-col bg-surface border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-gray-800 bg-black/20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Buscar recorridos..." 
                className="w-full bg-black border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:border-brand focus:outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="text-center text-gray-500 p-8">Cargando rutas...</div>
            ) : routes.length === 0 ? (
              <div className="text-center text-gray-500 p-8">No hay rutas registradas</div>
            ) : (
              <div className="space-y-4">
                {/* Group by Cliente (Operation) - Mocked structure since operations are optional */}
                <div>
                  <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">▼ Sin cliente (Genéricos)</h3>
                  <div className="space-y-1 ml-2 border-l border-gray-800 pl-2">
                    {routes.map(r => (
                      <div key={r.id} className="group p-2 hover:bg-gray-800 rounded cursor-pointer transition-colors flex justify-between items-center">
                        <div className="flex items-center text-gray-300">
                          <Map className="w-4 h-4 text-brand mr-2" />
                          <span className="truncate">{r.name}</span>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                          <button className="p-1 hover:text-white"><Download className="w-3 h-3" /></button>
                          <button onClick={() => deleteRoute(r.id)} className="p-1 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Map Stub */}
        <div className="w-2/3 bg-black border border-gray-800 rounded-xl relative overflow-hidden flex items-center justify-center">
          <div className="absolute top-4 right-4 bg-gray-900 border border-gray-700 rounded p-2 text-xs text-gray-400 z-10">
            [MapLibre GL Map View]
          </div>
          <div className="text-center p-8">
            <RouteIcon className="w-16 h-16 mx-auto text-gray-800 mb-4" />
            <p className="text-gray-600 font-mono mb-2">Seleccione una ruta para previsualizarla</p>
            <p className="text-gray-700 text-sm italic">Se dibujará la ruta con color verde neón usando MapLibre GL.</p>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-gray-800 rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-2xl font-bold text-white mb-6">Importar KML</h2>
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-3 rounded mb-4 text-sm">
              ⚠️ Solo se aceptan geometrías LineString. Puntos y polígonos serán ignorados.
            </div>
            <form onSubmit={handleImport} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nombre de la Ruta</label>
                <input required type="text" className="w-full bg-black border border-gray-700 rounded p-2 text-white" value={routeName} onChange={e => setRouteName(e.target.value)} />
              </div>
              <div className="text-gray-400 text-sm bg-black p-3 rounded border border-gray-800 h-32 overflow-hidden relative">
                <div className="absolute inset-0 p-3">
                  {kmlContent.slice(0, 500)}...
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent pointer-events-none" />
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded text-gray-400 hover:text-white">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-brand text-black font-bold rounded hover:bg-brand/90">Confirmar e Importar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
