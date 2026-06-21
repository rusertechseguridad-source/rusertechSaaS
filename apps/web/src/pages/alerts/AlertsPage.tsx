import React, { useEffect, useState, useRef } from 'react';
import { AlertTriangle, MapPin, Truck, ExternalLink, RefreshCw, AlertCircle, CheckCircle, Search, X, User, Download, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAlertsStore } from '../../store/alertsStore';
import { exportToCsv } from '../../utils/export';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import AlertsSettingsModal, { SEVERITY_LEVELS } from './AlertsSettingsModal';

export const AlertsPage: React.FC = () => {
  const { alerts, loading, fetchAlerts: storeFetch, resolveAlert } = useAlertsStore();

  const [search, setSearch] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');
  const [avlFilter, setAvlFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [mapStyle, setMapStyle] = useState('https://tiles.openfreemap.org/styles/dark');

  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tenantSettings, setTenantSettings] = useState<any>({});
  const [alertToResolve, setAlertToResolve] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  let isAdmin = false;
  const token = localStorage.getItem('rusertech_token');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      isAdmin = ['tenant_admin', 'admin', 'super_admin', 'rusertech_admin'].includes(payload.role || payload.role_code);
    } catch(e) {}
  }

  // Resizable columns state
  const [colWidths, setColWidths] = useState({
    hora: 112,
    evento: 180,
    vehiculo: 140,
    chofer: 160,
    viaje: 160,
    codigo: 140,
    coordenadas: 140,
  });

  const startResize = (e: React.MouseEvent, col: keyof typeof colWidths) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.pageX;
    const startWidth = colWidths[col];
    const onMouseMove = (moveEvent: MouseEvent) => {
      setColWidths(prev => ({ ...prev, [col]: Math.max(60, startWidth + moveEvent.pageX - startX) }));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const Resizer = ({ col }: { col: keyof typeof colWidths }) => (
    <div 
      onMouseDown={(e) => startResize(e, col)}
      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-accentBlue/50 z-10 transition-colors"
    />
  );
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const fetchAlerts = async () => {
    try {
      await storeFetch();

      const token = localStorage.getItem('rusertech_token');
      if (!token) return;

      const settingsRes = await fetch('http://localhost:3000/api/v1/alerts/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (settingsRes.ok) {
        setTenantSettings(await settingsRes.json());
      }
    } catch (err) {
      console.error('Failed to load alerts settings', err);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

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



  const submitResolve = async () => {
    if (!alertToResolve) return;
    if (!resolutionNote.trim()) {
      alert('Debes ingresar una justificación para atender la alerta.');
      return;
    }
    
    try {
      if (alertToResolve === 'BULK') {
        await Promise.all(Array.from(selectedIds).map(id => resolveAlert(id, resolutionNote)));
        setSelectedIds(new Set());
      } else {
        await resolveAlert(alertToResolve, resolutionNote);
      }
      setShowModal(false);
      setAlertToResolve(null);
      if (selectedAlert?.id === alertToResolve) {
        setSelectedAlert(null);
      }
      await storeFetch();
    } catch (err: any) {
      alert(err.message || 'Error al atender.');
    }
  };

  const handleSaveSettings = async (newSettings: any) => {
    const token = localStorage.getItem('rusertech_token');
    const res = await fetch('http://localhost:3000/api/v1/alerts/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(newSettings)
    });
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 403) {
        alert(errData.message || 'No tienes permisos de administrador para cambiar esta configuración.');
      } else {
        throw new Error('Failed to update settings');
      }
      return;
    }
    
    setTenantSettings(await res.json());
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

  const getEventColor = (eventType: string) => {
    const configuredSeverityId = tenantSettings?.alert_colors?.[eventType];
    if (configuredSeverityId) {
      const sev = SEVERITY_LEVELS.find(s => s.id === configuredSeverityId);
      if (sev) return sev.colorClass;
    }

    const type = (eventType || '').toUpperCase();
    if (['SPEED_VIOLATION', 'HARSH_BRAKING', 'JAMMING', 'POWER_CUT', 'PANIC_BUTTON', 'FUEL_DROP', 'FATIGUE', 'DISTRACTION'].includes(type)) return 'border-red-500 text-red-500 bg-red-500/10';
    if (['HARSH_ACCELERATION', 'HARSH_CORNERING', 'TEMPERATURE_HIGH', 'TEMPERATURE_LOW'].includes(type)) return 'border-orange-500 text-orange-500 bg-orange-500/10';
    if (['GEOFENCE_ENTER', 'GEOFENCE_EXIT', 'DOOR_CLOSE', 'REFUELING', 'TRAILER_CONNECT', 'ENGINE_ON', 'ENGINE_OFF'].includes(type)) return 'border-blue-500 text-blue-500 bg-blue-500/10';
    if (type === 'POSITION') return 'border-green-500 text-green-500 bg-green-500/10';
    return 'border-slate-500 text-slate-500 bg-slate-500/10';
  };

  // Select only active ones first
  const activeAlerts = alerts.filter(a => a.status !== 'resolved');

  // Derive filter options
  const uniqueCarriers = Array.from(new Set(activeAlerts.map(a => (a.vehicle as any)?.carrier?.name).filter(Boolean)));
  const uniqueAvls = Array.from(new Set(activeAlerts.map(a => (a.vehicle as any)?.device?.avl_user?.provider_name).filter(Boolean)));

  // Filters
  const filtered = activeAlerts.filter(a => {
    const matchesSearch = search
      ? a.vehicle?.plate?.toLowerCase().includes(search.toLowerCase()) || a.trip?.name?.toLowerCase().includes(search.toLowerCase())
      : true;

    let alertSeverity = tenantSettings?.alert_colors?.[a.event_type];
    if (!alertSeverity) {
      const type = (a.event_type || '').toUpperCase();
      if (['SPEED_VIOLATION', 'HARSH_BRAKING', 'JAMMING', 'POWER_CUT', 'PANIC_BUTTON', 'FUEL_DROP', 'FATIGUE', 'DISTRACTION'].includes(type)) alertSeverity = 'high';
      else if (['GEOFENCE_ENTER', 'GEOFENCE_EXIT', 'DOOR_CLOSE', 'REFUELING', 'TRAILER_CONNECT', 'ENGINE_ON', 'ENGINE_OFF'].includes(type)) alertSeverity = 'low';
      else if (type === 'POSITION') alertSeverity = 'none';
      else alertSeverity = 'medium';
    }

    const matchesSeverity = severityFilter ? alertSeverity === severityFilter : true;
    const matchesCarrier = carrierFilter ? (a.vehicle as any)?.carrier?.name === carrierFilter : true;
    const matchesAvl = avlFilter ? (a.vehicle as any)?.device?.avl_user?.provider_name === avlFilter : true;

    return matchesSearch && matchesSeverity && matchesCarrier && matchesAvl;
  }).sort((a, b) => {
    const d1 = new Date(a.triggered_at).getTime();
    const d2 = new Date(b.triggered_at).getTime();
    return sortOrder === 'desc' ? d2 - d1 : d1 - d2;
  });

  // Update map style
  useEffect(() => {
    if (map.current) {
      map.current.setStyle(mapStyle);
    }
  }, [mapStyle]);

  // Render all active markers
  useEffect(() => {
    if (!map.current) return;
    
    // Clean up old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    filtered.forEach(alert => {
      const lat = Number(alert.latitude);
      const lng = Number(alert.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        const el = document.createElement('div');
        
        // Determine background based on severity
        let bgClass = 'bg-slate-500';
        let alertSeverity = tenantSettings?.alert_colors?.[alert.event_type];
        if (!alertSeverity) {
          const type = (alert.event_type || '').toUpperCase();
          if (['SPEED_VIOLATION', 'HARSH_BRAKING', 'JAMMING', 'POWER_CUT', 'PANIC_BUTTON', 'FUEL_DROP', 'FATIGUE', 'DISTRACTION'].includes(type)) alertSeverity = 'high';
          else if (['GEOFENCE_ENTER', 'GEOFENCE_EXIT', 'DOOR_CLOSE', 'REFUELING', 'TRAILER_CONNECT', 'ENGINE_ON', 'ENGINE_OFF'].includes(type)) alertSeverity = 'low';
          else if (type === 'POSITION') alertSeverity = 'none';
          else alertSeverity = 'medium';
        }

        if (alertSeverity === 'none') bgClass = 'bg-green-500';
        if (alertSeverity === 'low') bgClass = 'bg-blue-500';
        if (alertSeverity === 'medium') bgClass = 'bg-orange-500';
        if (alertSeverity === 'high') bgClass = 'bg-red-500';
        if (alertSeverity === 'critical') bgClass = 'bg-black';

        // Make selected marker larger
        const isSelected = selectedAlert?.id === alert.id;
        el.className = `w-4 h-4 ${bgClass} rounded-full border-2 border-white shadow-[0_0_10px_rgba(0,0,0,0.5)] cursor-pointer transition-all hover:scale-125 ${isSelected ? 'scale-150 animate-pulse ring-2 ring-white/50' : ''}`;
        
        const dot = document.createElement('div');
        dot.className = 'w-1.5 h-1.5 bg-white rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
        el.appendChild(dot);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedAlert(alert);
        });

        const m = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(`
            <div style="font-family:sans-serif;font-size:12px;color:#333;line-height:1.4;min-width:180px;">
              <strong style="font-size:13px;color:#d32f2f;display:block;margin-bottom:4px;">${translateEvent(alert.event_type)}</strong>
              <b>Vehículo:</b> ${alert.vehicle?.plate || 'Desc.'}<br/>
              <b>Chofer:</b> ${(alert as any).trip?.driver?.full_name || 'Sin Chofer'}<br/>
              <b>Hora:</b> ${new Date(alert.triggered_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}<br/>
              <div style="margin-top:8px;">${alert.address || 'Ubicación desconocida'}</div>
            </div>
          `))
          .addTo(map.current!);
          
        markersRef.current.push(m);
      }
    });
  }, [filtered, tenantSettings, selectedAlert]);

  // Fly to selected alert
  useEffect(() => {
    if (!map.current || !selectedAlert) return;
    const lat = Number(selectedAlert.latitude);
    const lng = Number(selectedAlert.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      map.current.flyTo({
        center: [lng, lat],
        zoom: 14,
        essential: true,
        speed: 1.5
      });
    }
  }, [selectedAlert]);

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
        <div className="flex gap-3">
          {isAdmin && (
            <button
              onClick={() => setShowSettings(true)}
              className="bg-bgSurface hover:bg-borderDefault text-textMuted hover:text-white px-3 py-2 rounded flex items-center gap-2 transition-colors font-bold text-sm border border-borderDefault shadow-card"
              title="Configuración de Alertas"
            >
              <Settings className="w-4 h-4" /> Configuración
            </button>
          )}
          <button
            onClick={fetchAlerts}
            className="bg-bgSurfaceHigh hover:bg-borderDefault text-white px-4 py-2 rounded flex items-center gap-2 transition-colors font-bold text-sm shadow-card"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>
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

          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="bg-bgSurface border border-borderDefault rounded-lg px-3 py-1.5 text-xs text-textPrimary focus:border-red-500 focus:outline-none">
            <option value="">Todas las Severidades</option>
            {SEVERITY_LEVELS.map(sev => <option key={sev.id} value={sev.id}>{sev.label}</option>)}
          </select>

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
            {selectedIds.size > 0 && (
              <button 
                onClick={() => { setAlertToResolve('BULK'); setResolutionNote(''); setShowModal(true); }}
                className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1.5 text-xs font-bold rounded-lg border border-red-500/50 transition-colors"
              >
                Atender Seleccionados ({selectedIds.size})
              </button>
            )}
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
        <div className="bg-bgSurface border border-borderDefault rounded-xl overflow-hidden shadow-card flex flex-col min-w-[1400px] h-full">
          {/* Header */}
          <div className="bg-bgStart/95 backdrop-blur-md border-b border-borderDefault text-textMuted text-[10px] uppercase tracking-wider font-bold px-4 py-3 flex items-center w-full shrink-0">
            <div className="w-8 shrink-0 flex items-center justify-center">
              <input 
                type="checkbox" 
                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                onChange={(e) => {
                  if (e.target.checked) setSelectedIds(new Set(filtered.map(a => a.id)));
                  else setSelectedIds(new Set());
                }}
                className="w-3.5 h-3.5 rounded border-borderDefault bg-bgSurface text-accentBlue focus:ring-accentBlue/50 cursor-pointer"
              />
            </div>
            <div className="shrink-0 relative pr-2" style={{ width: colWidths.hora }}>Hora <Resizer col="hora" /></div>
            <div className="shrink-0 relative pr-2" style={{ width: colWidths.evento }}>Evento <Resizer col="evento" /></div>
            <div className="shrink-0 relative pr-2" style={{ width: colWidths.vehiculo }}>Vehículo <Resizer col="vehiculo" /></div>
            <div className="shrink-0 relative pr-2" style={{ width: colWidths.chofer }}>Chofer <Resizer col="chofer" /></div>
            <div className="shrink-0 relative pr-2" style={{ width: colWidths.viaje }}>Viaje <Resizer col="viaje" /></div>
            <div className="shrink-0 relative pr-2" style={{ width: colWidths.codigo }}>Código Viaje <Resizer col="codigo" /></div>
            <div className="shrink-0 relative pr-2" style={{ width: colWidths.coordenadas }}>Coordenadas <Resizer col="coordenadas" /></div>
            <div className="flex-1 min-w-[200px] relative pr-2">Ubicación</div>
            <div className="w-28 shrink-0 text-right pr-2">Acciones</div>
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
                  <div className="w-8 shrink-0 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(alert.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedIds);
                        if (e.target.checked) newSet.add(alert.id);
                        else newSet.delete(alert.id);
                        setSelectedIds(newSet);
                      }}
                      className="w-3.5 h-3.5 rounded border-borderDefault bg-bgSurface text-accentBlue focus:ring-accentBlue/50 cursor-pointer"
                    />
                  </div>
                  <div className="shrink-0 pr-2 flex items-center" style={{ width: colWidths.hora }}>
                    <div className="text-textSecondary font-medium text-xs">
                      {new Date(alert.triggered_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>

                  <div className="shrink-0 pr-2 flex items-center" style={{ width: colWidths.evento }}>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black tracking-wider border truncate ${getEventColor(alert.event_type)}`}>
                      {translateEvent(alert.event_type)}
                    </span>
                  </div>

                  <div className="shrink-0 pr-2 flex items-center" style={{ width: colWidths.vehiculo }}>
                    <div className="text-white font-bold text-xs truncate flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-textMuted shrink-0" />
                      {alert.vehicle?.plate || 'Desconocido'}
                    </div>
                  </div>

                  <div className="shrink-0 pr-2 flex items-center" style={{ width: colWidths.chofer }}>
                    <div className="text-textSecondary text-xs truncate flex items-center gap-1.5 font-medium">
                      <User className="w-3 h-3 text-textMuted shrink-0" />
                      {(alert as any).trip?.driver?.full_name || 'Sin Chofer'}
                    </div>
                  </div>

                  <div className="shrink-0 pr-2 flex items-center" style={{ width: colWidths.viaje }}>
                    {alert.trip ? (
                      <Link to={`/trips/${alert.trip.id}`} className="text-accentBlue hover:text-white font-bold text-xs truncate flex items-center gap-1.5 transition-colors" onClick={(e) => e.stopPropagation()}>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{alert.trip.name}</span>
                      </Link>
                    ) : (
                      <span className="text-textMuted text-xs italic font-medium">No Asignado</span>
                    )}
                  </div>

                  <div className="shrink-0 pr-2 flex items-center" style={{ width: colWidths.codigo }}>
                    {alert.trip ? (
                      <div className="text-textSecondary text-xs truncate font-mono">
                        {alert.trip.trip_code || 'SIN_CÓDIGO'}
                      </div>
                    ) : (
                      <span className="text-textMuted text-xs font-mono">-</span>
                    )}
                  </div>

                  <div className="shrink-0 pr-2 flex items-center" style={{ width: colWidths.coordenadas }}>
                    {alert.latitude && alert.longitude && !isNaN(Number(alert.latitude)) && !isNaN(Number(alert.longitude)) ? (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${alert.latitude},${alert.longitude}`} target="_blank" rel="noreferrer" className="text-accentBlue hover:text-white font-mono text-[10px] truncate flex items-center gap-1 transition-colors" onClick={(e) => e.stopPropagation()}>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        {Number(alert.latitude).toFixed(4)}, {Number(alert.longitude).toFixed(4)}
                      </a>
                    ) : (
                      <span className="text-textMuted text-xs font-mono">-</span>
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
                      title="Atender Incidente"
                    >
                      Atender
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

      <AlertsSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentSettings={tenantSettings}
        onSave={handleSaveSettings}
      />

    </div>
  );
};

export default AlertsPage;
