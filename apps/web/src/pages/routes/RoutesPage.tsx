import React, { useEffect, useState, useRef } from 'react';
import { useRoutesStore } from '../../store/routesStore';
import { Map, Plus, Search, Upload, Download, Route as RouteIcon, Trash2 } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { kml } from '@tmcw/togeojson';

export const RoutesPage: React.FC = () => {
  const { routes, fetchRoutes, deleteRoute, createRoute, loading } = useRoutesStore();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [kmlContent, setKmlContent] = useState('');
  const [routeName, setRouteName] = useState('');
  const [operationId, setOperationId] = useState('');
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [operations, setOperations] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);

  useEffect(() => {
    fetchRoutes();
    fetchOperations();
    fetchLocations();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: [-58.3816, -34.6037],
      zoom: 10
    });

    map.current.on('load', () => {
      if (!map.current) return;
      map.current.addSource('route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#00FF00',
          'line-width': 5,
          'line-opacity': 0.8
        }
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !selectedRoute || !selectedRoute.geojson) return;
    
    const source = map.current.getSource('route') as maplibregl.GeoJSONSource;
    if (source) {
      const geojson: any = {
        type: 'Feature',
        properties: {},
        geometry: selectedRoute.geojson
      };
      source.setData(geojson);
      
      if (selectedRoute.geojson.coordinates && selectedRoute.geojson.coordinates.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        const coords = selectedRoute.geojson.type === 'MultiLineString' 
          ? selectedRoute.geojson.coordinates.flat(1) 
          : selectedRoute.geojson.coordinates;
          
        coords.forEach((c: number[]) => {
          bounds.extend([c[0], c[1]]);
        });
        map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
      }
    }
  }, [selectedRoute]);

  const fetchOperations = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/operations', {
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` },
      });
      if (res.ok) setOperations(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchLocations = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/locations', {
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` },
      });
      if (res.ok) setLocations(await res.json());
    } catch (e) { console.error(e); }
  };

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
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlContent, 'text/xml');
    const geojsonData = kml(xmlDoc);
    
    let lineStringGeoJSON = null;
    if (geojsonData.features) {
      for (const feature of geojsonData.features) {
        if (feature.geometry && (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString')) {
          lineStringGeoJSON = feature.geometry;
          break;
        }
      }
    }

    if (!lineStringGeoJSON) {
      window.alert("El archivo KML no contiene una ruta válida (LineString).");
      return;
    }

    await createRoute({
      name: routeName,
      corridor_meters: 500,
      operation_id: operationId || null,
      origin_location_id: originId || null,
      destination_location_id: destinationId || null,
      geojson: lineStringGeoJSON
    });

    setShowModal(false);
    setKmlContent('');
    setRouteName('');
    setOperationId('');
    setOriginId('');
    setDestinationId('');
  };

  const groupedRoutes = routes.reduce((acc, route) => {
    const opName = route.operation?.name || 'Internos / Sin Cliente';
    if (!acc[opName]) acc[opName] = [];
    acc[opName].push(route);
    return acc;
  }, {} as Record<string, typeof routes>);

  return (
    <div className="p-8 h-[calc(100vh-4rem)] max-w-7xl mx-auto flex flex-col">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <h1 className="text-3xl font-display font-bold text-white flex items-center">
          <RouteIcon className="w-8 h-8 mr-3 text-accentGreen" />
          Recorridos KML
        </h1>
        <RequirePermission permission="routes:edit">
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
        </RequirePermission>
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
            ) : Object.keys(groupedRoutes).length === 0 ? (
              <div className="text-center text-textMuted p-8">No hay rutas registradas</div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedRoutes).map(([opName, opRoutes]) => (
                  <div key={opName}>
                    <h3 className="text-sm font-bold text-textMuted uppercase mb-2 flex items-center gap-2">
                      ▼ {opName}
                      <span className="bg-bgSurfaceHigh text-textSecondary text-[10px] px-1.5 py-0.5 rounded-full">
                        {opRoutes.length}
                      </span>
                    </h3>
                    <div className="space-y-1 ml-2 border-l border-borderDefault pl-2">
                      {opRoutes.filter(r => r.name.toLowerCase().includes(search.toLowerCase())).map(r => (
                        <div 
                          key={r.id} 
                          className={`group p-3 rounded cursor-pointer transition-colors flex justify-between items-center border ${selectedRoute?.id === r.id ? 'border-accentGreen bg-bgSurfaceHigh/50' : 'border-transparent hover:bg-bgSurfaceHigh hover:border-borderDefault'}`}
                          onClick={() => setSelectedRoute(r)}
                        >
                          <div className="flex flex-col text-textSecondary">
                            <div className="flex items-center text-white font-medium">
                              <Map className="w-4 h-4 text-accentGreen mr-2" />
                              <span className="truncate">{r.name}</span>
                            </div>
                            {(r.origin_location || r.destination_location) && (
                              <div className="text-xs text-textMuted mt-1 ml-6 flex items-center gap-1">
                                <span className="truncate max-w-[100px]" title={r.origin_location?.name}>{r.origin_location?.name || '?'}</span>
                                <span className="text-accentBlue">→</span>
                                <span className="truncate max-w-[100px]" title={r.destination_location?.name}>{r.destination_location?.name || '?'}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button className="p-1 text-textMuted hover:text-white"><Download className="w-4 h-4" /></button>
                            <RequirePermission permission="routes:edit">
                              <button onClick={(e) => { e.stopPropagation(); if(confirm('¿Eliminar ruta?')) deleteRoute(r.id); }} className="p-1 text-textMuted hover:text-statusDanger"><Trash2 className="w-4 h-4" /></button>
                            </RequirePermission>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-2/3 bg-bgStart border border-borderDefault rounded-xl relative overflow-hidden flex items-center justify-center">
          <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
          {!selectedRoute && (
            <div className="text-center p-8 z-10 pointer-events-none bg-bgStart/80 rounded-xl backdrop-blur-sm shadow-card">
              <RouteIcon className="w-16 h-16 mx-auto text-bgSurfaceHigh mb-4" />
              <p className="text-white font-bold mb-2">Seleccione una ruta para previsualizarla</p>
              <p className="text-textMuted/50 text-sm italic">Se dibujará la ruta con color verde neón usando MapLibre GL.</p>
            </div>
          )}
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
                
                <div className="border-t border-borderDefault pt-4 mt-2">
                  <h3 className="text-sm font-bold text-accentGreen uppercase tracking-wider mb-3">Asignación y Logística</h3>
                  
                  <div className="mb-3">
                    <label className="block text-sm text-textSecondary mb-1">Cliente / Operación</label>
                    <select className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={operationId} onChange={e => setOperationId(e.target.value)}>
                      <option value="">— Ninguno (Ruta Interna) —</option>
                      {operations.map(op => (
                        <option key={op.id} value={op.id}>{op.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-textSecondary mb-1">Origen</label>
                      <select className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={originId} onChange={e => setOriginId(e.target.value)}>
                        <option value="">— Seleccionar —</option>
                        {locations.filter(l => !operationId || l.operation_id === operationId).map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-textSecondary mb-1">Destino</label>
                      <select className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={destinationId} onChange={e => setDestinationId(e.target.value)}>
                        <option value="">— Seleccionar —</option>
                        {locations.filter(l => !operationId || l.operation_id === operationId).map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="text-textMuted text-sm bg-bgStart p-3 rounded border border-borderDefault h-24 overflow-hidden relative mt-4">
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

