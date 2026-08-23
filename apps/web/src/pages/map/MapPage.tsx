import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Map as MapIcon, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * MAPA GLOBAL DE FLOTA.
 *
 * Qué muestra: **dónde está cada vehículo ahora**, tenga viaje declarado o no.
 *
 * Antes pintaba los marcadores a partir de `trip_events`, que requieren
 * `trip_id`: los vehículos en Tracking Libre —la mitad de la operación real—
 * nunca aparecían, y un vehículo con telemetría fluyendo pero sin eventos
 * nuevos quedaba congelado en su último evento declarado.
 *
 * Ahora la posición del marcador sale de la telemetría
 * (`GET /api/v1/vehicles/live`, que lee de Postgres). Los viajes se siguen
 * consultando, pero sólo como **contexto**: indican qué vehículo tiene un
 * viaje declarado en curso y aportan datos al popup.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type Frescura = 'en_vivo' | 'inactivo' | 'sin_senal';

/** Respuesta de GET /api/v1/vehicles/live */
interface LivePosition {
  vehicle_id: string;
  plate: string | null;
  alias: string | null;
  timestamp: string;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  heading_degrees: number | null;
  ignition: boolean | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  event_type: string | null;
  provider_code: string | null;
  age_seconds: number;
  freshness: Frescura;
  source: 'postgres' | 'redis';
}

/** Respuesta de GET /api/v1/vehicles */
interface VehicleRow {
  id: string;
  plate: string;
  alias?: string | null;
  status?: string;
  is_blocked?: boolean;
  carrier?: { id: string; name: string } | null;
  avl_user?: { id: string; name: string; user_avl_code?: string } | null;
}

/** Contexto de viaje (no define la posición del marcador). */
interface TripContext {
  id: string;
  name: string;
  trip_code: string | null;
  status: string;
  vehicle?: { id?: string; plate: string };
  driver?: { full_name: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Frescura: colores y etiquetas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El color del marcador responde "¿está reportando?", que es la señal de
 * seguridad que le importa al operador. El modo operativo (viaje declarado vs
 * Tracking Libre) se distingue con un anillo, sin competir por el color.
 */
const FRESCURA_COLORS: Record<Frescura, string> = {
  en_vivo: '#2BF4B6',
  inactivo: '#F59E0B',
  sin_senal: '#6B7280',
};

/** Color de los vehículos que no reportan hace más de la ventana (no van al mapa). */
const COLOR_SIN_DATOS = '#4B5563';

/** Anillo que marca "este vehículo tiene un viaje declarado en curso". */
const COLOR_ANILLO_VIAJE = '#2AB3FF';

function formatearAntiguedad(segundos: number, t: any): string {
  if (segundos < 60) return t('map.ago_seconds', { n: segundos });
  if (segundos < 3600) return t('map.ago_minutes', { n: Math.floor(segundos / 60) });
  return t('map.ago_hours', { n: Math.floor(segundos / 3600) });
}

/**
 * Crea el elemento del marcador.
 *
 * @param frescura     define el color de relleno
 * @param conViaje     dibuja el anillo exterior si el vehículo tiene viaje declarado
 */
function createMarkerEl(frescura: Frescura, conViaje: boolean): HTMLDivElement {
  const el = document.createElement('div');
  const color = FRESCURA_COLORS[frescura];

  el.style.cssText = [
    'width:18px', 'height:18px', 'border-radius:50%', 'cursor:pointer',
    'position:relative', 'box-sizing:border-box',
    `background:${color}`,
    // El anillo azul indica viaje declarado; el borde tenue es el estilo base.
    // El anillo va con `outline` y no con `box-shadow`: la animación de pulso
    // anima box-shadow y lo borraría en los vehículos en vivo con viaje.
    conViaje
      ? `border:2px solid ${COLOR_ANILLO_VIAJE};outline:2px solid ${COLOR_ANILLO_VIAJE}55;outline-offset:2px`
      : 'border:2px solid rgba(255,255,255,0.3)',
  ].join(';');

  // Sólo pulsa lo que está reportando ahora: si todo pulsa, el pulso no informa.
  if (frescura === 'en_vivo') {
    el.style.animation = 'mapPulse 2s infinite';
    if (!document.getElementById('map-pulse-style')) {
      const s = document.createElement('style');
      s.id = 'map-pulse-style';
      s.textContent =
        '@keyframes mapPulse{0%{box-shadow:0 0 0 0 rgba(43,244,182,0.7)}70%{box-shadow:0 0 0 12px rgba(43,244,182,0)}100%{box-shadow:0 0 0 0 rgba(43,244,182,0)}}';
      document.head.appendChild(s);
    }
  } else if (frescura === 'sin_senal') {
    // Atenuado: sigue estando, pero no compite visualmente con los que reportan.
    el.style.opacity = '0.65';
  }

  return el;
}

function buildPopupHTML(
  pos: LivePosition,
  vehiculo: VehicleRow | undefined,
  viaje: TripContext | undefined,
  t: any,
): string {
  const color = FRESCURA_COLORS[pos.freshness];
  const etiquetaFrescura =
    pos.freshness === 'en_vivo'
      ? t('map.freshness_live')
      : pos.freshness === 'inactivo'
        ? t('map.freshness_idle')
        : t('map.freshness_offline');

  const patente = pos.plate ?? vehiculo?.plate ?? 'N/A';
  const alias = pos.alias ?? vehiculo?.alias ?? '';
  const velocidad = pos.speed_kmh != null ? `${Math.round(pos.speed_kmh)} ${t('map.km', 'km')}/h` : '--';
  const temp = pos.temperature_c != null ? `${pos.temperature_c}°C` : '--';
  const humedad = pos.humidity_pct != null ? `${pos.humidity_pct}%` : '--';
  const transportista = vehiculo?.carrier?.name ?? '--';
  const antiguedad = formatearAntiguedad(pos.age_seconds, t);

  const bloqueViaje = viaje
    ? [
        '<div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;margin-top:4px;">',
        `<div style="font-size:10px;color:${COLOR_ANILLO_VIAJE};font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">`,
        t('map.declared_trip') + '</div>',
        `<div style="font-size:12px;color:#fff;font-weight:600;">${viaje.name}</div>`,
        viaje.trip_code
          ? `<div style="font-size:10px;font-family:monospace;color:#94A3B8;margin-top:2px;">${viaje.trip_code}</div>`
          : '',
        viaje.driver?.full_name
          ? `<div style="font-size:11px;color:#CBD5E1;margin-top:4px;">👤 ${viaje.driver.full_name}</div>`
          : '',
        `<a href="/trips/${viaje.id}" style="display:block;text-align:center;background:${COLOR_ANILLO_VIAJE}22;`,
        `border:1px solid ${COLOR_ANILLO_VIAJE}55;color:${COLOR_ANILLO_VIAJE};padding:5px 12px;border-radius:6px;`,
        `font-size:11px;font-weight:700;text-decoration:none;margin-top:8px;">${t('map.view_details')} →</a>`,
        '</div>',
      ].join('')
    : [
        '<div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;margin-top:4px;">',
        '<div style="font-size:11px;color:#94A3B8;">📡 ' + t('map.free_tracking') + '</div>',
        '</div>',
      ].join('');

  return [
    '<div style="font-family:system-ui,sans-serif;min-width:230px;max-width:290px;padding:12px;',
    'background:#0F1C2E;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#E2E8F0;">',

    // Encabezado: patente + estado de frescura
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:8px;">',
    `<div><span style="font-size:14px;font-weight:800;color:#fff;">${patente}</span>`,
    alias ? `<div style="font-size:10px;color:#94A3B8;margin-top:1px;">${alias}</div>` : '',
    '</div>',
    '<span style="flex-shrink:0;font-size:10px;font-weight:800;padding:2px 7px;border-radius:4px;',
    `background:${color}22;color:${color};border:1px solid ${color}44;`,
    `text-transform:uppercase;letter-spacing:0.05em;">${etiquetaFrescura}</span></div>`,

    // Antigüedad del dato: lo primero que hay que saber de una posición
    `<div style="font-size:10px;color:#94A3B8;margin-bottom:8px;">🕑 ${t('map.last_report')}: `,
    `<span style="color:${color};font-weight:600;">${antiguedad}</span></div>`,

    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:11px;margin-bottom:8px;',
    'border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;">',
    `<div style="color:#94A3B8;">⚡ ${t('map.speed')}</div><div style="color:#2BF4B6;font-weight:600;">${velocidad}</div>`,
    `<div style="color:#94A3B8;">🌡 ${t('map.temperature')}</div><div style="color:#F59E0B;">${temp}</div>`,
    `<div style="color:#94A3B8;">💧 ${t('map.humidity')}</div><div style="color:#60A5FA;">${humedad}</div>`,
    `<div style="color:#94A3B8;">🚚 ${t('carriers.title', 'Transportista')}</div><div style="color:#CBD5E1;font-size:10px;">${transportista}</div>`,
    '</div>',

    bloqueViaje,
    '</div>',
  ].join('');
}

// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:3000/api/v1';

export const MapPage: React.FC = () => {
  const { t } = useTranslation();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [trips, setTrips] = useState<TripContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [freshnessFilter, setFreshnessFilter] = useState<string>('');
  const [carrierFilter, setCarrierFilter] = useState<string>('');
  const [avlFilter, setAvlFilter] = useState<string>('');
  const [mapStyle, setMapStyle] = useState('https://tiles.openfreemap.org/styles/dark');
  const [mapReady, setMapReady] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(true);

  /**
   * Tres consultas con propósitos distintos:
   *  · /vehicles/live → posición del marcador (telemetría, fuente de verdad)
   *  · /vehicles      → flota completa: permite contar los que NO reportan y
   *                     poblar los filtros de transportista y proveedor GPS
   *  · /trips         → contexto: qué vehículo tiene viaje declarado en curso
   */
  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('rusertech_token');
    const headers = { Authorization: `Bearer ${token}` };

    const pedir = async <T,>(ruta: string): Promise<T[]> => {
      try {
        const res = await fetch(`${API_BASE}${ruta}`, { headers });
        if (!res.ok) {
          console.warn(`[MapPage] ${ruta} respondió ${res.status}`);
          return [];
        }
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (e) {
        // Se registra y se sigue: que falle el contexto no debe dejar el mapa
        // en blanco si las posiciones sí llegaron.
        console.error(`[MapPage] Error consultando ${ruta}:`, e);
        return [];
      }
    };

    const [pos, vehs, trps] = await Promise.all([
      pedir<LivePosition>('/vehicles/live'),
      pedir<VehicleRow>('/vehicles'),
      pedir<TripContext>('/trips'),
    ]);

    setPositions(pos);
    setVehicles(vehs);
    setTrips(trps);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

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

  useEffect(() => {
    if (map.current && mapReady) map.current.setStyle(mapStyle);
  }, [mapStyle, mapReady]);

  // ── Índices derivados ──────────────────────────────────────────────────────

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles],
  );

  /** Viaje declarado EN CURSO por vehículo. Sólo aporta contexto al marcador. */
  const viajeActivoPorVehiculo = useMemo(() => {
    const m = new Map<string, TripContext>();
    trips
      .filter((tr) => tr.status === 'EN_CURSO')
      .forEach((tr) => {
        const vid = (tr.vehicle as any)?.id;
        if (vid) m.set(vid, tr);
      });
    return m;
  }, [trips]);

  const filtered = useMemo(
    () =>
      positions.filter((p) => {
        const veh = vehiclesById.get(p.vehicle_id);
        const matchFreshness = !freshnessFilter || p.freshness === freshnessFilter;
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          (p.plate ?? '').toLowerCase().includes(q) ||
          (p.alias ?? '').toLowerCase().includes(q) ||
          (veh?.carrier?.name ?? '').toLowerCase().includes(q);
        const matchCarrier = !carrierFilter || veh?.carrier?.id === carrierFilter;
        const matchAvl = !avlFilter || veh?.avl_user?.id === avlFilter;
        return matchFreshness && matchSearch && matchCarrier && matchAvl;
      }),
    [positions, vehiclesById, freshnessFilter, search, carrierFilter, avlFilter],
  );

  // ── Marcadores ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!map.current || !mapReady) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    filtered.forEach((pos) => {
      if (pos.latitude == null || pos.longitude == null) return;
      const veh = vehiclesById.get(pos.vehicle_id);
      const viaje = viajeActivoPorVehiculo.get(pos.vehicle_id);

      const el = createMarkerEl(pos.freshness, Boolean(viaje));
      const popup = new maplibregl.Popup({
        offset: 14,
        closeButton: true,
        maxWidth: '310px',
        className: 'map-global-popup',
      }).setHTML(buildPopupHTML(pos, veh, viaje, t));

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pos.longitude, pos.latitude])
        .setPopup(popup)
        .addTo(map.current!);
      markersRef.current.push(marker);
    });
  }, [filtered, mapReady, vehiclesById, viajeActivoPorVehiculo, t]);

  // ── Resumen de flota ───────────────────────────────────────────────────────
  // Cuenta VEHÍCULOS por frescura, más la categoría que antes no existía: los
  // que no reportan hace más de la ventana y por eso no están en el mapa. Es el
  // dato operativo más importante del panel ("3 de 15 no reportan").

  const resumen = useMemo(() => {
    const porFrescura = { en_vivo: 0, inactivo: 0, sin_senal: 0 };
    positions.forEach((p) => {
      porFrescura[p.freshness] = (porFrescura[p.freshness] ?? 0) + 1;
    });
    const conPosicion = positions.length;
    // La flota de referencia excluye los vehículos dados de baja: no reportan
    // porque están fuera de servicio, no porque haya un problema.
    const totalFlota = vehicles.filter((v) => v.status !== 'inactive').length;
    // Si el listado de vehículos falló, no se inventa un negativo.
    const sinDatos = Math.max(0, totalFlota - conPosicion);
    return { ...porFrescura, conPosicion, totalFlota, sinDatos };
  }, [positions, vehicles]);

  const filterOpts = [
    { value: '', label: t('map.freshness_all'), color: '#94A3B8' },
    { value: 'en_vivo', label: t('map.freshness_live'), color: FRESCURA_COLORS.en_vivo },
    { value: 'inactivo', label: t('map.freshness_idle'), color: FRESCURA_COLORS.inactivo },
    { value: 'sin_senal', label: t('map.freshness_offline'), color: FRESCURA_COLORS.sin_senal },
  ];

  const legendRows = [
    { label: t('map.freshness_live'), color: FRESCURA_COLORS.en_vivo, glow: true, count: resumen.en_vivo, enMapa: true },
    { label: t('map.freshness_idle'), color: FRESCURA_COLORS.inactivo, glow: false, count: resumen.inactivo, enMapa: true },
    { label: t('map.freshness_offline'), color: FRESCURA_COLORS.sin_senal, glow: false, count: resumen.sin_senal, enMapa: true },
    { label: t('map.freshness_nodata'), color: COLOR_SIN_DATOS, glow: false, count: resumen.sinDatos, enMapa: false },
  ];

  const uniqueCarriers = useMemo(
    () => Array.from(new Map(vehicles.map((v) => v.carrier).filter(Boolean).map((c: any) => [c.id, c])).values()),
    [vehicles],
  );
  const uniqueAvl = useMemo(
    () => Array.from(new Map(vehicles.map((v) => v.avl_user).filter(Boolean).map((a: any) => [a.id, a])).values()),
    [vehicles],
  );

  const panelBg = {
    background: 'rgba(10,18,30,0.85)',
    backdropFilter: 'blur(14px)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  } as const;

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

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

      {/* Panel izquierdo: filtros + resumen de flota */}
      <div
        className={`absolute top-4 left-4 z-20 flex flex-col gap-4 transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : '-translate-x-[150%]'}`}
        style={{ width: '260px' }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ ...panelBg, border: '1px solid rgba(43,244,182,0.25)', boxShadow: '0 4px 30px rgba(0,0,0,0.5)' }}
        >
          <MapIcon className="w-5 h-5 text-accentGreen" />
          <span className="text-base font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-accentGreen to-accentBlue">
            {t('map.title')}
          </span>
        </div>

        {/* Filtros */}
        <div className="flex flex-col gap-3 rounded-xl" style={{ ...panelBg, padding: '16px' }}>
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
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-textMuted hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {filterOpts.map((opt) => (
              <button
                key={opt.value || 'all'}
                onClick={() => setFreshnessFilter(opt.value)}
                className="text-[11px] px-2.5 py-1 rounded-lg transition-colors border"
                style={
                  freshnessFilter === opt.value
                    ? { background: `${opt.color}22`, color: opt.color, borderColor: `${opt.color}55` }
                    : { background: 'transparent', color: '#94A3B8', borderColor: 'rgba(255,255,255,0.08)' }
                }
              >
                {opt.label}
              </button>
            ))}
          </div>

          <select
            value={carrierFilter}
            onChange={(e) => setCarrierFilter(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:border-accentGreen focus:outline-none"
          >
            <option value="">{t('map.all_carriers')}</option>
            {uniqueCarriers.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={avlFilter}
            onChange={(e) => setAvlFilter(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:border-accentGreen focus:outline-none"
          >
            <option value="">{t('map.all_gps')}</option>
            {uniqueAvl.map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {/* Resumen de flota */}
        <div className="rounded-xl" style={{ ...panelBg, padding: '16px' }}>
          <div className="text-[11px] font-bold text-textSecondary uppercase tracking-wider mb-3">
            {t('map.fleet_summary')}
          </div>

          <div className="flex flex-col gap-2 mb-3">
            {legendRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: row.color,
                      boxShadow: row.glow ? `0 0 6px ${row.color}` : undefined,
                      // Los que no están en el mapa se dibujan huecos, para que
                      // se lea de un vistazo que son otra cosa.
                      border: row.enMapa ? 'none' : '1px dashed rgba(255,255,255,0.35)',
                      opacity: row.enMapa ? 1 : 0.7,
                    }}
                  />
                  <span className="text-textSecondary">{row.label}</span>
                </div>
                <span style={{ color: row.color }} className="font-bold">{row.count}</span>
              </div>
            ))}
          </div>

          {resumen.sinDatos > 0 && (
            <div className="text-[9px] text-textMuted mb-2 pl-4 -mt-1">
              {t('map.not_on_map')}
            </div>
          )}

          <div
            className="text-center text-[11px] rounded-lg py-2 mb-2"
            style={{ background: 'rgba(43,244,182,0.08)', border: '1px solid rgba(43,244,182,0.15)' }}
          >
            <span className="text-accentGreen font-bold text-sm">{resumen.conPosicion}</span>
            <span className="text-textMuted"> / </span>
            <span className="text-white font-bold text-sm">{resumen.totalFlota}</span>
            <span className="text-textMuted"> {t('map.reporting_ratio')}</span>
          </div>

          <div className="text-[9px] text-textMuted text-center">
            {loading ? t('map.loading') : t('map.auto_refresh')}
          </div>
        </div>
      </div>

      {/* Selector de estilo de mapa */}
      <div
        className="absolute bottom-6 left-4 z-20 flex gap-2"
        style={{ ...panelBg, borderRadius: '12px', padding: '8px' }}
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
