import React, { useEffect, useState, useRef } from 'react';
import { AlertTriangle, MapPin, Truck, ExternalLink, RefreshCw, AlertCircle, CheckCircle, Search, X, User, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAlertsStore } from '../../store/alertsStore';
import { exportToCsv } from '../../utils/export';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export const AlertsPage: React.FC = () => {
  const { alerts, loading, fetchAlerts, resolveAlert } = useAlertsStore();

  const [search, setSearch] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');
  const [avlFilter, setAvlFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [mapStyle, setMapStyle] = useState('https://tiles.openfreemap.org/styles/dark');

  const [showModal, setShowModal] = useState(false);
  const [alertToResolve, setAlertToResolve] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [-58.3816, -34.6037],
      zoom: 10
    });
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update map style
  useEffect(() => {
    if (map.current) {
      map.current.setStyle(mapStyle);
    }
  }, [mapStyle]);

  // Update marker on selection
  useEffect(() => {
    if (!map.current || !selectedAlert) return;
    if (marker.current) {
      marker.current.remove();
      marker.current = null;
    }
    
    if (selectedAlert.latitude && selectedAlert.longitude) {
      const el = document.createElement('div');
      el.className = 'w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(239,68,68,0.8)] flex items-center justify-center animate-pulse';
      
      const dot = document.createElement('div');
      dot.className = 'w-2 h-2 bg-white rounded-full';
      el.appendChild(dot);

      marker.current = new maplibregl.Marker(el)
        .setLngLat([selectedAlert.longitude, selectedAlert.latitude])
        .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(`<b>${selectedAlert.event_type}</b>`))
        .addTo(map.current);

      map.current.flyTo({
        center: [selectedAlert.longitude, selectedAlert.latitude],
        zoom: 14,
        essential: true
      });
    }
  }, [selectedAlert]);

  const handleResolveClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAlertToResolve(id);
    setResolutionNote('');
    setShowModal(true);
  };

  const submitResolve = async () => {
    if (!alertToResolve) return;
    if (!resolutionNote.trim()) {
      alert('Debes ingresar una justificación para resolver la alerta.');
      return;
    }
    await resolveAlert(alertToResolve, resolutionNote);
    setShowModal(false);
    setAlertToResolve(null);
    if (selectedAlert?.id === alertToResolve) {
      setSelectedAlert(null);
    }
  };

  // Helper to translate event types
  const translateEvent = (eventType: string) => {
    const types: Record<string, string> = {
      'SPEED_VIOLATION': 'EXCESO DE VELOCIDAD',
      'POSITION': 'POSICIÓN',
      'HARSH_ACCELERATION': 'ACELERACIÓN BRUSCA',
      'HARSH_BRAKING': 'FRENADA BRUSCA',
      'HARSH_CORNERING': 'GIRO BRUSCO',
      'JAMMING': 'INTERFERENCIA DE SEÑAL',
      'GEOFENCE_ENTER': 'ENTRADA A GEOFENCE',
      'GEOFENCE_EXIT': 'SALIDA DE GEOFENCE',
      'POWER_CUT': 'CORTE DE CORRIENTE',
      'TEMPERATURE_HIGH': 'TEMPERATURA ALTA',
      'TEMPERATURE_LOW': 'TEMPERATURA BAJA'
    };
    return types[eventType.toUpperCase()] || eventType.replace(/_/g, ' ').toUpperCase();
  };

  // Select only active ones first
  const activeAlerts = alerts.filter(a => a.status !== 'resolved');

  // Derive filter options
  const uniqueCarriers = Array.from(new Set(activeAlerts.map(a => (a.vehicle as any)?.carrier?.name).filter(Boolean)));
  const uniqueAvls = Array.from(new Set(activeAlerts.map(a => (a.vehicle as any)?.device?.avl_user?.provider_name).filter(Boolean)));

  // Filters
  const filtered = activeAlerts.filter(a => {
    if (search && !a.vehicle?.plate?.toLowerCase().includes(search.toLowerCase()) && !a.trip?.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (carrierFilter && (a.vehicle as any)?.carrier?.name !== carrierFilter) return false;
    if (avlFilter && (a.vehicle as any)?.device?.avl_user?.provider_name !== avlFilter) return false;
    return true;
  }).sort((a, b) => {
    const d1 = new Date(a.triggered_at).getTime();
    const d2 = new Date(b.triggered_at).getTime();
    return sortOrder === 'desc' ? d2 - d1 : d1 - d2;
  });

  const handleExport = () => {
    const headers = ['Fecha/Hora', 'Evento', 'Vehículo', 'Chofer', 'Viaje', 'Ubicación', 'Latitud', 'Longitud'];
    const rows = filtered.map(a => [
      new Date(a.triggered_at).toLocaleString(),
      translateEvent(a.event_type),
      a.vehicle?.plate || 'Desconocido',
      (a.vehicle as any)?.driver ? `${(a.vehicle as any).driver.first_name} ${(a.vehicle as any).driver.last_name}` : 'Sin Chofer',
      a.trip?.name || 'Viaje libre',
      a.address || 'Ubicación desconocida',
      a.latitude || '',
      a.longitude || ''
    ]);
    exportToCsv('Alertas', headers, rows);
  };

  const handleExportDetail = (alert: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const headers = ['Fecha/Hora', 'Evento', 'Vehículo', 'Chofer', 'Viaje', 'Ubicación', 'Latitud', 'Longitud'];
    const row = [
      new Date(alert.triggered_at).toLocaleString(),
      translateEvent(alert.event_type),
      alert.vehicle?.plate || 'Desconocido',
      (alert.vehicle as any)?.driver ? `${(alert.vehicle as any).driver.first_name} ${(alert.vehicle as any).driver.last_name}` : 'Sin Chofer',
      alert.trip?.name || 'Viaje libre',
      alert.address || 'Ubicación desconocida',
      alert.latitude || '',
      alert.longitude || ''
    ];
    exportToCsv(`Alerta_${alert.event_type}_${alert.vehicle?.plate || 'Desc'}`, headers, [row]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] w-full overflow-hidden bg-gradient-bg">
      {/* ── HEADER ── */}
      <div className="px-8 pt-8 pb-4 shrink-0 flex justify-between items-center z-10 relative">
        <div>
          <h1 className="text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400 tracking-wider flex items-center" style={{ textShadow: '0 0 10px rgba(239,68,68,0.3)' }}>
            <AlertTriangle className="w-8 h-8 mr-3 text-red-500" />
            Alertas e Incidentes
          </h1>
          <p className="text-textMuted mt-2">Monitoreo y resolución de eventos críticos.</p>
        </div>
        <button
          onClick={fetchAlerts}
          className="bg-bgSurfaceHigh hover:bg-borderDefault text-white px-4 py-2 rounded flex items-center gap-2 transition-colors font-bold text-sm shadow-card"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {/* ── MAP AREA (TOP FIXED) ── */}
      <div className="px-8 shrink-0 mb-4 z-10 relative">
        <div className="bg-bgSurface border border-borderDefault rounded-xl overflow-hidden shadow-card relative h-[180px] min-h-[100px] max-h-[500px] w-full resize-y flex flex-col">
          <div ref={mapContainer} className="absolute inset-0 w-full h-full pointer-events-auto" />
          {!selectedAlert && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-bgStart/50 backdrop-blur-[2px] pointer-events-none transition-all duration-300">
              <MapPin className="w-12 h-12 text-textMuted opacity-50 mb-3" />
              <p className="text-white font-bold tracking-wider">Selecciona una alerta para ubicarla en el mapa</p>
            </div>
          )}
          {selectedAlert && selectedAlert.latitude && selectedAlert.longitude && (
            <div className="absolute top-4 left-4 z-10 bg-bgSurfaceHigh/90 backdrop-blur-sm border border-borderDefault p-3 rounded-xl shadow-lg max-w-sm">
              <div className="font-bold text-white text-sm uppercase flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-red-500" />
                {selectedAlert.event_type.replace(/_/g, ' ')}
              </div>
              <div className="text-xs text-textSecondary mb-2">
                {selectedAlert.address || 'Ubicación desconocida'}
              </div>
              <a 
                href={`https://www.google.com/maps?q=${selectedAlert.latitude},${selectedAlert.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-accentBlue hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> Abrir en Google Maps
              </a>
            </div>
          )}

          {/* Map Style Toggle */}
          <div
            className="absolute bottom-4 left-4 z-20 flex gap-2"
            style={{
              background: 'rgba(10,18,30,0.82)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding: '6px',
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
                className={`text-xs px-3 py-1 rounded-lg transition-colors ${
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

      {/* ── FILTERS BAR ── */}
      <div className="px-8 pb-3 shrink-0 z-10 relative">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar vehículo, viaje..."
              className="w-full bg-bgSurface border border-borderDefault rounded-lg pl-9 pr-4 py-1.5 text-sm text-textPrimary focus:border-red-500 focus:outline-none transition-colors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select value={carrierFilter} onChange={(e) => setCarrierFilter(e.target.value)} className="bg-bgSurface border border-borderDefault rounded-lg px-3 py-1.5 text-xs text-textPrimary focus:border-red-500 focus:outline-none">
            <option value="">Todos los Transportistas</option>
            {uniqueCarriers.map((c: any) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={avlFilter} onChange={(e) => setAvlFilter(e.target.value)} className="bg-bgSurface border border-borderDefault rounded-lg px-3 py-1.5 text-xs text-textPrimary focus:border-red-500 focus:outline-none">
            <option value="">Todos los AVLs</option>
            {uniqueAvls.map((a: any) => <option key={a} value={a}>{a}</option>)}
          </select>

          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)} className="bg-bgSurface border border-borderDefault rounded-lg px-3 py-1.5 text-xs text-textPrimary focus:border-red-500 focus:outline-none font-bold">
            <option value="desc">Más Recientes ▼</option>
            <option value="asc">Más Antiguos ▲</option>
          </select>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-textMuted font-bold bg-bgSurface px-3 py-1.5 rounded-lg border border-borderDefault">
              {filtered.length} alerta{filtered.length !== 1 ? 's' : ''}
            </span>
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 bg-bgSurface/80 hover:bg-bgSurfaceHigh text-white px-3 py-1.5 text-xs rounded-lg border border-borderDefault transition-colors"
            >
              <Download size={14} className="text-accentBlue" />
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      {/* ── LIST VIEW ── */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col relative w-full px-8 pb-8 z-10">
        <div className="bg-bgSurface border border-borderDefault rounded-xl overflow-hidden shadow-card flex flex-col min-w-[1000px] h-full">
          {/* Header */}
          <div className="bg-bgStart/95 backdrop-blur-md border-b border-borderDefault text-textMuted text-[10px] uppercase tracking-wider font-bold px-4 py-3 flex items-center w-full shrink-0">
            <div className="w-28 shrink-0">Hora</div>
            <div className="w-40 shrink-0">Evento</div>
            <div className="flex-1 min-w-[150px]">Vehículo / Chofer</div>
            <div className="flex-1 min-w-[150px]">Viaje (Num)</div>
            <div className="flex-[1.5] min-w-[200px]">Ubicación y Coordenadas</div>
            <div className="w-28 shrink-0 text-center">Acciones</div>
          </div>
          
          {/* Body */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            {loading && activeAlerts.length === 0 ? (
              <div className="text-center text-textMuted py-12">Cargando alertas...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-textMuted py-12 flex flex-col items-center">
                <CheckCircle className="w-10 h-10 text-statusSuccess mb-2 opacity-50" />
                No se encontraron incidentes abiertos.
              </div>
            ) : (
              filtered.map(alert => (
                <div 
                  key={alert.id}
                  onClick={() => setSelectedAlert(alert)}
                  className={`flex items-center w-full px-2 py-0 border-b border-borderDefault/50 hover:bg-bgSurfaceHigh transition-all cursor-pointer group h-10 ${
                    selectedAlert?.id === alert.id ? 'bg-red-500/10 border-l-4 border-l-red-500' : 'border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="w-28 shrink-0 pr-2 flex items-center">
                    <div className="text-textSecondary font-medium text-xs">
                      {new Date(alert.triggered_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>

                  <div className="w-40 shrink-0 pr-2 flex items-center">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black tracking-wider border border-red-500 text-red-500 bg-red-500/10 truncate">
                      {translateEvent(alert.event_type)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-[150px] pr-2">
                    <div className="text-white font-bold text-xs truncate flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-textMuted" />
                      {alert.vehicle?.plate || 'Desconocido'}
                    </div>
                    <div className="text-textSecondary text-[11px] mt-0.5 truncate flex items-center gap-1.5 font-medium">
                      <User className="w-3 h-3 text-textMuted" />
                      {(alert as any).trip?.driver?.full_name || 'Sin Chofer'}
                    </div>
                  </div>

                  <div className="flex-1 min-w-[150px] pr-2">
                    {alert.trip ? (
                      <>
                        <Link to={`/trips/${alert.trip.id}`} className="text-accentBlue hover:text-white font-bold text-xs truncate flex items-center gap-1.5 transition-colors" onClick={(e) => e.stopPropagation()}>
                          <ExternalLink className="w-3.5 h-3.5" />
                          {alert.trip.name}
                        </Link>
                        <div className="text-textSecondary text-[11px] mt-0.5 truncate font-mono">
                          {alert.trip.trip_code || 'SIN_CÓDIGO'}
                        </div>
                      </>
                    ) : (
                      <span className="text-textMuted text-[11px] italic font-medium">Viaje No Asignado</span>
                    )}
                  </div>

                  <div className="flex-[1.5] min-w-[200px] pr-2 flex items-center">
                    <div className="text-textSecondary text-xs flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span className="truncate" title={alert.address || ''}>{alert.address || 'Sin dirección registrada'}</span>
                    </div>
                  </div>

                  <div className="w-28 shrink-0 flex items-center gap-1.5 justify-end">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setAlertToResolve(alert.id); setResolutionNote(''); setShowModal(true); }}
                      className="text-[10px] font-bold text-red-400 hover:text-white border border-red-500/30 hover:bg-red-500/20 px-2 py-1 rounded transition-colors flex-1 text-center"
                      title="Marcar Resuelto"
                    >
                      Resuelto
                    </button>
                    <button 
                      onClick={(e) => handleExportDetail(alert, e)}
                      className="text-[10px] font-bold text-textSecondary hover:text-white border border-borderDefault hover:bg-bgSurface px-2 py-1 rounded transition-colors flex items-center justify-center"
                      title="Exportar"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── RESOLUTION MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 bg-bgOverlay z-[100] flex items-center justify-center p-4">
          <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-md shadow-card overflow-hidden">
            <div className="p-4 border-b border-borderDefault bg-red-500/10 flex justify-between items-center">
              <h2 className="text-lg font-bold text-red-500 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Resolver Alerta
              </h2>
              <button onClick={() => setShowModal(false)} className="text-textMuted hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-textSecondary mb-4">
                Por favor ingresa una justificación o comentario técnico para el cierre de esta alerta. Este registro quedará guardado permanentemente.
              </p>
              <textarea
                autoFocus
                className="w-full bg-bgStart border border-borderDefault rounded-lg p-3 text-white text-sm focus:border-red-500 focus:outline-none min-h-[120px] resize-none"
                placeholder="Ej: Falsa alarma por pérdida de señal, o el conductor reportó frenada brusca por cruce de animal..."
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
              />
              <div className="mt-6 flex justify-end gap-3">
                <button 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded text-sm font-bold text-textSecondary hover:text-white hover:bg-bgSurfaceHigh transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={submitResolve}
                  disabled={!resolutionNote.trim()}
                  className="px-6 py-2 rounded text-sm font-bold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors shadow-lg shadow-red-500/20"
                >
                  Cerrar Alerta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
