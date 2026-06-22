import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Map as MapIcon, Search, X, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TripEvent {
  id: string;
  lat: number | null;
  lng: number | null;
  speed: number | null;
  address: string | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  generated_at: string;
  metadata_json?: any;
}

interface TripData {
  id: string;
  name: string;
  trip_code: string | null;
  status: string;
  vehicle?: { plate: string; alias?: string; carrier?: { name: string }; avl_user?: { provider_name: string } };
  driver?: { full_name: string };
  events?: TripEvent[];
}

const getStatusLabels = (t: any) => ({
  EN_CURSO: t('map.status_in_progress'),
  PROGRAMADO: t('map.status_scheduled'),
  FINALIZADO: t('map.status_finished'),
  CANCELADO: t('map.status_canceled'),
});

const STATUS_COLORS: Record<string, string> = {
  EN_CURSO: '#2BF4B6',
  PROGRAMADO: '#2AB3FF',
  FINALIZADO: '#6B7280',
  CANCELADO: '#EF4444',
};

function getLastEventWithPos(events?: TripEvent[]): TripEvent | null {
  if (!events || events.length === 0) return null;
  const sorted = [...events].sort(
    (a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime()
  );
  return sorted.find((e) => e.lat !== null && e.lng !== null) ?? null;
}

function createMarkerEl(status: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText =
    'width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,0.3);cursor:pointer;position:relative;';
  if (status === 'EN_CURSO') {
    el.style.background = '#2BF4B6';
    el.style.animation = 'mapPulse 2s infinite';
    if (!document.getElementById('map-pulse-style')) {
      const s = document.createElement('style');
      s.id = 'map-pulse-style';
      s.textContent =
        '@keyframes mapPulse{0%{box-shadow:0 0 0 0 rgba(43,244,182,0.7)}70%{box-shadow:0 0 0 12px rgba(43,244,182,0)}100%{box-shadow:0 0 0 0 rgba(43,244,182,0)}}';
      document.head.appendChild(s);
    }
  } else if (status === 'PROGRAMADO') {
    el.style.background = '#2AB3FF';
    el.style.boxShadow = '0 0 8px rgba(42,179,255,0.6)';
  } else {
    el.style.background = '#4B5563';
    el.style.boxShadow = '0 0 4px rgba(0,0,0,0.5)';
  }
  return el;
}

function buildPopupHTML(trip: TripData, event: TripEvent | null, t: any): string {
  const statusColor = STATUS_COLORS[trip.status] ?? '#6B7280';
  const statusLabel = getStatusLabels(t)[trip.status] ?? trip.status;
  const plate = trip.vehicle?.plate ?? 'N/A';
  const driver = trip.driver?.full_name ?? 'N/D';
  const address = event?.address ?? event?.metadata_json?.address ?? t('map.no_address');
  const speed = event?.speed != null ? String(event.speed) + ` ${t('map.km')}/h` : '--';
  const temp = event?.temperature_c != null ? String(event.temperature_c) + '°C' : '--';
  const humidity = event?.humidity_pct != null ? String(event.humidity_pct) + '%' : '--';
  return [
    '<div style="font-family:system-ui,sans-serif;min-width:220px;max-width:280px;padding:12px;',
    'background:#0F1C2E;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#E2E8F0;">',
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:8px;">',
    '<span style="font-size:13px;font-weight:700;color:#fff;line-height:1.3;">' + trip.name + '</span>',
    '<span style="flex-shrink:0;font-size:10px;font-weight:800;padding:2px 7px;border-radius:4px;',
    'background:' + statusColor + '22;color:' + statusColor + ';border:1px solid ' + statusColor + '44;',
    'text-transform:uppercase;letter-spacing:0.05em;">' + statusLabel + '</span></div>',
    trip.trip_code ? '<div style="font-size:10px;font-family:monospace;color:#94A3B8;margin-bottom:8px;">' + trip.trip_code + '</div>' : '',
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:11px;margin-bottom:8px;',
    'border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;">',
    '<div style="color:#94A3B8;">🚛 ' + t('map.plate') + '</div><div style="color:#fff;font-weight:600;">' + plate + '</div>',
    '<div style="color:#94A3B8;">👤 ' + t('map.driver') + '</div><div style="color:#fff;">' + driver + '</div>',
    '<div style="color:#94A3B8;">📍 ' + t('map.address') + '</div><div style="color:#CBD5E1;font-size:10px;">' + address + '</div>',
    '<div style="color:#94A3B8;">⚡ ' + t('map.speed') + '</div><div style="color:#2BF4B6;font-weight:600;">' + speed + '</div>',
    '<div style="color:#94A3B8;">🌡 ' + t('map.temperature') + '</div><div style="color:#F59E0B;">' + temp + '</div>',
    '<div style="color:#94A3B8;">💧 ' + t('map.humidity') + '</div><div style="color:#60A5FA;">' + humidity + '</div></div>',
    '<a href="/trips/' + trip.id + '" style="display:block;text-align:center;background:#2AB3FF22;',
    'border:1px solid #2AB3FF55;color:#2AB3FF;padding:5px 12px;border-radius:6px;font-size:11px;',
    'font-weight:700;text-decoration:none;margin-top:4px;">' + t('map.view_details') + ' →</a></div>',
  ].join('');
}

export const MapPage: React.FC = () => {
  const { t } = useTranslation();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [trips, setTrips] = useState<TripData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [carrierFilter, setCarrierFilter] = useState<string>('');
  const [avlFilter, setAvlFilter] = useState<string>('');
  const [mapStyle, setMapStyle] = useState('https://tiles.openfreemap.org/styles/dark');
  const [mapReady, setMapReady] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(true);

  const fetchTrips = useCallback(async () => {
    const token = localStorage.getItem('rusertech_token');
    try {
      const res = await fetch('http://localhost:3000/api/v1/trips', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setTrips(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
    const interval = setInterval(fetchTrips, 30000);
    return () => clearInterval(interval);
  }, [fetchTrips]);

  useEffect(() => {
    if (mapContainer.current && !map.current) {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: mapStyle,
        center: [-58.38, -34.6],
        zoom: 6,
      });
      map.current.addControl(new maplibregl.NavigationControl(), 'bottom-right');
      map.current.on('load', () => setMapReady(true));
    }
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const filtered = trips.filter((t) => {
    const matchStatus = !statusFilter || t.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      (t.trip_code ?? '').toLowerCase().includes(q) ||
      (t.vehicle?.plate ?? '').toLowerCase().includes(q);
    const matchCarrier = !carrierFilter || (t.vehicle as any)?.carrier?.id === carrierFilter;
    const matchAvl = !avlFilter || (t.vehicle as any)?.avl_user?.id === avlFilter;
    return matchStatus && matchSearch && matchCarrier && matchAvl;
  });

  useEffect(() => {
    if (map.current && mapReady) {
      map.current.setStyle(mapStyle);
    }
  }, [mapStyle, mapReady]);

  const uniqueCarriers = Array.from(
    new Map(
      trips
        .map((t) => (t.vehicle as any)?.carrier)
        .filter(Boolean)
        .map((c: any) => [c.id, c])
    ).values()
  );

  const uniqueAvl = Array.from(
    new Map(
      trips
        .map((t) => (t.vehicle as any)?.avl_user)
        .filter(Boolean)
        .map((a: any) => [a.id, a])
    ).values()
  );

  useEffect(() => {
    if (!map.current || !mapReady) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    filtered.forEach((trip) => {
      const event = getLastEventWithPos(trip.events);
      if (!event || event.lat === null || event.lng === null) return;
      const el = createMarkerEl(trip.status);
      const popup = new maplibregl.Popup({
        offset: 14,
        closeButton: true,
        maxWidth: '300px',
        className: 'map-global-popup',
      }).setHTML(buildPopupHTML(trip, event, t));
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([event.lng, event.lat])
        .setPopup(popup)
        .addTo(map.current!);
      markersRef.current.push(marker);
    });
  }, [filtered, mapReady]);

  const activeCount = trips.filter((t) => t.status === 'EN_CURSO').length;
  const totalWithPos = trips.filter((t) => getLastEventWithPos(t.events) !== null).length;
  const filterOpts = [
    { value: '', label: t('map.status_all'), color: '#94A3B8' },
    { value: 'EN_CURSO', label: t('map.status_in_progress'), color: '#2BF4B6' },
    { value: 'PROGRAMADO', label: t('map.status_scheduled'), color: '#2AB3FF' },
    { value: 'FINALIZADO', label: t('map.status_finished'), color: '#6B7280' },
  ];
  const legendRows = [
    { label: t('map.status_in_progress'), color: '#2BF4B6', glow: true, count: activeCount },
    { label: t('map.status_scheduled'), color: '#2AB3FF', glow: false, count: trips.filter((t) => t.status === 'PROGRAMADO').length },
    { label: t('map.status_finished'), color: '#4B5563', glow: false, count: trips.filter((t) => t.status === 'FINALIZADO').length },
  ];

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

      {/* Centre header - Removed since it's merged left */}
      
      {/* Toggle Button */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="absolute top-4 z-30 p-2 rounded-xl text-white transition-all duration-300"
        style={{
          left: isMenuOpen ? '280px' : '16px',
          background: 'rgba(10,18,30,0.80)',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
        }}
      >
        {isMenuOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>

      {/* Left panel (Filters + Legend) */}
      <div
        className={`absolute top-4 left-4 z-20 flex flex-col gap-4 transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : '-translate-x-[150%]'}`}
        style={{
          width: '260px',
        }}
      >
        {/* Main Title Block */}
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{
            background: 'rgba(10,18,30,0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(43,244,182,0.25)',
            boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
          }}
        >
          <MapIcon className="w-5 h-5 text-accentGreen" />
          <span className="text-base font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-accentGreen to-accentBlue">
            {t('map.title')}
          </span>
        </div>

        {/* Filters */}
        <div
          className="flex flex-col gap-3 rounded-xl"
          style={{
            background: 'rgba(10,18,30,0.85)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-textMuted" />
            <input
              type="text"
              placeholder={t('map.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-8 py-2 text-xs text-white placeholder-textMuted focus:border-accentGreen focus:outline-none transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-textMuted hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <select
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-accentGreen focus:outline-none"
            >
              <option value="">{t('map.all_carriers')}</option>
              {uniqueCarriers.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={avlFilter}
              onChange={(e) => setAvlFilter(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-accentGreen focus:outline-none"
            >
              <option value="">{t('map.all_gps')}</option>
              {uniqueAvl.map((a: any) => (
                <option key={a.id} value={a.id}>{a.provider_name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            {filterOpts.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-all"
                style={{
                  border: '1px solid ' + (statusFilter === opt.value ? opt.color : 'rgba(255,255,255,0.05)'),
                  background: statusFilter === opt.value ? opt.color + '15' : 'rgba(255,255,255,0.02)',
                  color: statusFilter === opt.value ? opt.color : '#94A3B8',
                }}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: statusFilter === opt.value ? opt.color : '#475569' }} 
                  />
                  <span className="text-xs font-bold tracking-wider">{opt.label}</span>
                </div>
              </button>
            ))}
          </div>
          {loading && (
            <div className="text-[10px] text-textMuted text-center animate-pulse">{t('map.loading')}</div>
          )}
        </div>

        {/* Legend / Stats integrated */}
        <div
          className="rounded-xl"
          style={{
            background: 'rgba(10,18,30,0.85)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
            <Layers className="w-4 h-4 text-accentGreen" />
            <span className="text-xs font-bold text-white">{t('map.status_summary')}</span>
          </div>
          <div className="space-y-2 mb-4">
            {legendRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      display: 'inline-block',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: row.color,
                      boxShadow: row.glow ? '0 0 6px ' + row.color : undefined,
                    }}
                  />
                  <span className="text-textSecondary">{row.label}</span>
                </div>
                <span style={{ color: row.color }} className="font-bold">{row.count}</span>
              </div>
            ))}
          </div>
          <div
            className="text-center text-[11px] rounded-lg py-2 mb-2"
            style={{ background: 'rgba(43,244,182,0.08)', border: '1px solid rgba(43,244,182,0.15)' }}
          >
            <span className="text-accentGreen font-bold text-sm">{activeCount}</span>
            <span className="text-textMuted"> {t('map.active_count')} </span>
            <span className="text-white font-bold text-sm">{trips.length}</span>
            <span className="text-textMuted"> {t('map.total_count')}</span>
          </div>
          <div className="text-[9px] text-textMuted text-center">
            {totalWithPos} {t('map.with_gps')} • {t('map.auto_refresh')}
          </div>
        </div>
      </div>

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
          { label: t('map.dark_mode', 'Oscuro'), value: 'https://tiles.openfreemap.org/styles/dark' },
          { label: t('map.light_mode', 'Claro'), value: 'https://tiles.openfreemap.org/styles/liberty' },
        ].map((opt) => (
          <button
            key={opt.label}
            onClick={() => setMapStyle(opt.value)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              mapStyle === opt.value
                ? 'bg-accentGreen/20 text-accentGreen border border-accentGreen/30'
                : 'text-textSecondary hover:text-white border border-transparent hover:bg-white/5'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <style>{`
        .map-global-popup .maplibregl-popup-content {
          background: transparent !important; padding: 0 !important;
          border-radius: 10px !important; box-shadow: 0 20px 60px rgba(0,0,0,0.7) !important;
        }
        .map-global-popup .maplibregl-popup-tip { border-top-color: #0F1C2E !important; border-bottom-color: #0F1C2E !important; }
        .map-global-popup .maplibregl-popup-close-button { color: #94A3B8 !important; font-size: 16px !important; right: 8px !important; top: 6px !important; }
        .map-global-popup .maplibregl-popup-close-button:hover { color: #fff !important; background: transparent !important; }
      `}</style>
    </div>
  );
};
