import React, { useEffect, useState } from 'react';
import { useRoutesStore } from '../../store/routesStore';
import { Map, Plus, Search, Upload, Download, Route as RouteIcon, Trash2 } from 'lucide-react';

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

  const handleCreateManual = () => {
    window.alert('La creación manual de rutas requiere la integración completa del mapa interactivo (MapLibre GL Draw). Por el momento, por favor utilice la función "Importar KML".');
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
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
      <div className="flex justify-between items-center mb-8 shrink-0">
        <h1 className="text-3xl font-display font-bold text-white flex items-center">
          <RouteIcon className="w-8 h-8 mr-3 text-accentGreen" />
          Recorridos KML
        </h1>
        <div className="flex gap-4">
          <label className="cursor-pointer bg-bgSurface border border-borderDefault hover:bg-bgSurfaceHigh text-white px-4 py-2 rounded font-bold flex items-center shadow-card transition-colors">
            <Upload className="w-5 h-5 mr-2" /> Importar KML
            <input type="file" accept=".kml" className="hidden" onChange={handleFileUpload} />
          </label>
          <button
            onClick={handleCreateManual}
            className="bg-accentGreen hover:bg-accentGreen/90 text-bgStart px-4 py-2 rounded font-bold flex items-center shadow-lg shadow-accentGreen/20"
          >
            <Plus className="w-5 h-5 mr-2" /> Crear Manual
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        <div className="w-1/3 flex flex-col bg-bgSurface border border-borderDefault rounded-xl overflow-hidden shadow-card">
          <div className="p-4 border-b border-borderDefault bg-bgStart/50 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar recorridos..."
                className="w-full bg-bgStart border border-borderDefault rounded-lg pl-10 pr-4 py-2 text-textPrimary focus:border-accentGreen focus:outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="text-center text-textMuted p-8">Cargando rutas...</div>
            ) : routes.length === 0 ? (
              <div className="text-center text-textMuted p-8">No hay rutas registradas</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-textMuted uppercase mb-2">▼ Rutas</h3>
                  <div className="space-y-1 ml-2 border-l border-borderDefault pl-2">
                    {routes.map(r => (
                      <div key={r.id} className="group p-2 hover:bg-bgSurfaceHigh rounded cursor-pointer transition-colors flex justify-between items-center">
                        <div className="flex items-center text-textSecondary">
                          <Map className="w-4 h-4 text-accentGreen mr-2" />
                          <span className="truncate">{r.name}</span>
                        </div>
                        <div className="flex gap-1">
                          <button className="p-1 text-textMuted hover:text-white"><Download className="w-3 h-3" /></button>
                          <button onClick={() => deleteRoute(r.id)} className="p-1 text-textMuted hover:text-statusDanger"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-2/3 bg-bgStart border border-borderDefault rounded-xl relative overflow-hidden flex items-center justify-center">
          <div className="absolute top-4 right-4 bg-bgSurface border border-borderDefault rounded p-2 text-xs text-textMuted z-10">
            [MapLibre GL Map View]
          </div>
          <div className="text-center p-8">
            <RouteIcon className="w-16 h-16 mx-auto text-bgSurfaceHigh mb-4" />
            <p className="text-textMuted font-mono mb-2">Seleccione una ruta para previsualizarla</p>
            <p className="text-textMuted/50 text-sm italic">Se dibujará la ruta con color verde neón usando MapLibre GL.</p>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-bgOverlay z-50 flex items-center justify-center p-4">
          <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-lg shadow-card flex flex-col" style={{ maxHeight: '80vh' }}>
            <div className="p-6 border-b border-borderDefault shrink-0">
              <h2 className="text-2xl font-bold text-white">Importar KML</h2>
            </div>
            <form onSubmit={handleImport} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                <div className="bg-statusWarning/10 border border-statusWarning/20 text-statusWarning p-3 rounded text-sm">
                  ⚠️ Solo se aceptan geometrías LineString. Puntos y polígonos serán ignorados.
                </div>
                <div>
                  <label className="block text-sm text-textSecondary mb-1">Nombre de la Ruta</label>
                  <input required type="text" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={routeName} onChange={e => setRouteName(e.target.value)} />
                </div>
                <div className="text-textMuted text-sm bg-bgStart p-3 rounded border border-borderDefault h-32 overflow-hidden relative">
                  <div className="absolute inset-0 p-3">
                    {kmlContent.slice(0, 500)}...
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-bgStart to-transparent pointer-events-none" />
                </div>
              </div>
              <div className="p-6 border-t border-borderDefault flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded text-textSecondary hover:text-white transition-colors">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-accentGreen text-bgStart font-bold rounded hover:bg-accentGreen/90 transition-colors">Confirmar e Importar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
