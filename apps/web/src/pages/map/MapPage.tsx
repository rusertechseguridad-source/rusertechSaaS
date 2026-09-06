import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Map as MapIcon, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Frescura } from '../../constants/freshness';
import {
  COLOR_ANILLO_VIAJE,
  COLOR_SIN_DATOS,
  FRESCURA_COLORS,
} from '../../constants/freshness';
import { etiquetaFrescura, formatearAntiguedad } from '../../utils/freshness';
import type { LivePosition, LiveResponse, MonitoringSummary, MonitoringThresholds } from '../../types/monitoring';
import { SUMMARY_VACIO, THRESHOLDS_POR_DEFECTO } from '../../types/monitoring';
import { API_URL } from '../../services/api';

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
 * consultando, pero sólo como **contexto**: aportan nombre, código y conductor
 * al popup. Quién tiene viaje en curso lo informa el backend en cada posición
 * (`con_viaje_activo`), que es la misma consulta que decide el alcance.
 *
 * ALCANCE: el backend ya devuelve sólo lo que corresponde al monitoreo activo
 * —vehículos con la app del conductor encendida en la ventana, o con viaje
 * declarado EN_CURSO—. El filtro vive en la consulta y no acá: traer
 * posiciones para descartarlas es trabajo que crece con la flota.
 *
 * El resumen también llega del backend. `sin_datos` (viaje en curso sin ningún
 * punto) no se puede calcular en el frontend: son justamente los vehículos que
 * NO están en `positions`, y restarlos contra el listado completo de la flota
 * inflaba el número de forma permanente.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

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

// Los colores y el formateo de antigüedad viven en `constants/freshness` y
// `utils/freshness`: el detalle de viaje y el monitor de ingesta muestran la
// misma señal y tienen que hablar el mismo idioma visual.

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
  const etiqueta = etiquetaFrescura(pos.freshness, t);

  const patente = pos.plate ?? vehiculo?.plate ?? 'N/A';
  const alias = pos.alias ?? vehiculo?.alias ?? '';
  const velocidad = pos.speed_kmh != null ? `${Math.round(pos.speed_kmh)} ${t('map.km', 'km')}/h` : '--';
  const temp = pos.temperature_c != null ? `${pos.temperature_c}°C` : '--';
  const humedad = pos.humidity_pct != null ? `${pos.humidity_pct}%` : '--';
  const transportista = vehiculo?.carrier?.name ?? '--';
  const momentoAbsoluto = new Date(pos.timestamp).toLocaleString();
  const antiguedad = formatearAntiguedad(
    Math.max(0, Math.floor((Date.now() - new Date(pos.timestamp).getTime()) / 1000)),
    t,
  );

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
    `text-transform:uppercase;letter-spacing:0.05em;">${etiqueta}</span></div>`,

    // Antigüedad del dato: lo primero que hay que saber de una posición
    // Fecha y hora absolutas + tiempo transcurrido. El span del relativo lleva
    // data-reloj con el timestamp: un intervalo global (ver abajo) lo
    // recalcula cada 10 s, así el texto envejece solo aunque el popup quede
    // abierto entre refrescos de datos.
    `<div style="font-size:10px;color:#94A3B8;margin-bottom:8px;">🕑 ${t('map.last_report')}: `,
    `<span style="color:${color};font-weight:600;">${momentoAbsoluto} `,
    `(<span data-reloj="${new Date(pos.timestamp).toISOString()}">${antiguedad}</span>)</span></div>`,

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

const API_BASE = `${API_URL}/api/v1`;

export const MapPage: React.FC = () => {
  const { t } = useTranslation();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [summary, setSummary] = useState<MonitoringSummary>(SUMMARY_VACIO);
  const [thresholds, setThresholds] = useState<MonitoringThresholds>(THRESHOLDS_POR_DEFECTO);
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
   *  · /vehicles/live → posiciones en alcance + resumen + umbrales (fuente de
   *                     verdad; ya viene filtrado y contado por el backend)
   *  · /vehicles      → catálogo de la flota, sólo para poblar los filtros de
   *                     transportista y proveedor GPS y completar el popup
   *  · /trips         → contexto del viaje declarado (nombre, código, conductor)
   */
  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('rusertech_token');
    const headers = { Authorization: `Bearer ${token}` };

    /** Consulta que espera un arreglo. Devuelve `[]` ante cualquier fallo. */
    const pedirLista = async <T,>(ruta: string): Promise<T[]> => {
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

    /**
     * Posiciones en vivo. Devuelve `null` si no se pudo consultar, para
     * distinguir "no hay nada que mostrar" de "no pudimos preguntar": ante un
     * fallo se conserva la última foto en pantalla en lugar de vaciar el mapa.
     */
    const pedirEnVivo = async (): Promise<LiveResponse | null> => {
      try {
        const res = await fetch(`${API_BASE}/vehicles/live`, { headers });
        if (!res.ok) {
          console.warn(`[MapPage] /vehicles/live respondió ${res.status}`);
          return null;
        }
        const data = await res.json();
        if (!data || !Array.isArray(data.positions)) {
          console.warn('[MapPage] /vehicles/live devolvió un formato inesperado');
          return null;
        }
        return data as LiveResponse;
      } catch (e) {
        console.error('[MapPage] Error consultando /vehicles/live:', e);
        return null;
      }
    };

    const [live, vehs, trps] = await Promise.all([
      pedirEnVivo(),
      pedirLista<VehicleRow>('/vehicles'),
      pedirLista<TripContext>('/trips'),
    ]);

    if (live) {
      setPositions(live.positions);
      setSummary(live.summary ?? SUMMARY_VACIO);
      if (live.thresholds) setThresholds(live.thresholds);
    }
    setVehicles(vehs);
    setTrips(trps);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  /**
   * Reloj de los popups. El HTML del popup es estático (lo genera maplibre a
   * partir de un string), así que el tiempo relativo no puede ser un
   * componente React: se actualiza recorriendo los spans [data-reloj] de los
   * popups abiertos. Sin esto, "hace 41 s" seguiría diciendo 41 segundos dos
   * minutos después — una afirmación falsa en pantalla.
   */
  useEffect(() => {
    const tick = setInterval(() => {
      document.querySelectorAll<HTMLElement>('[data-reloj]').forEach((el) => {
        const ts = new Date(el.dataset.reloj ?? '');
        if (Number.isNaN(ts.getTime())) return;
        const segundos = Math.max(0, Math.floor((Date.now() - ts.getTime()) / 1000));
        el.textContent = formatearAntiguedad(segundos, t);
      });
    }, 10_000);
    return () => clearInterval(tick);
  }, [t]);

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

      // El anillo sale de `con_viaje_activo`, no de la lista de viajes: es la
      // misma consulta que decidió el alcance, así que marcador y filtro nunca
      // se contradicen aunque /trips llegue incompleto o falle.
      const el = createMarkerEl(pos.freshness, pos.con_viaje_activo);
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
  // Ya no se calcula acá. Antes se derivaba restando `positions` contra el
  // listado completo de vehículos, y esa cuenta dejó de tener sentido cuando el
  // mapa pasó a mostrar sólo la flota en monitoreo activo: los vehículos fuera
  // de alcance caían en "sin datos" para siempre. Ahora el backend cuenta con
  // el mismo criterio con el que filtra.

  const filterOpts = [
    { value: '', label: t('map.freshness_all'), color: '#94A3B8' },
    { value: 'en_vivo', label: t('map.freshness_live'), color: FRESCURA_COLORS.en_vivo },
    { value: 'inactivo', label: t('map.freshness_idle'), color: FRESCURA_COLORS.inactivo },
    { value: 'sin_senal', label: t('map.freshness_offline'), color: FRESCURA_COLORS.sin_senal },
  ];

  // Cada fila declara su umbral: sin eso, "Inactivos" es una palabra sin
  // unidad, y peor todavía cuando el valor lo puede cambiar el cliente.
  const legendRows = [
    {
      label: t('map.freshness_live'), color: FRESCURA_COLORS.en_vivo, glow: true,
      count: summary.en_vivo, enMapa: true,
      detalle: t('map.threshold_upto', { n: thresholds.umbral_en_vivo_minutos }),
    },
    {
      label: t('map.freshness_idle'), color: FRESCURA_COLORS.inactivo, glow: false,
      count: summary.inactivo, enMapa: true,
      detalle: t('map.threshold_upto', { n: thresholds.umbral_inactivo_minutos }),
    },
    {
      label: t('map.freshness_offline'), color: FRESCURA_COLORS.sin_senal, glow: false,
      count: summary.sin_senal, enMapa: true,
      detalle: t('map.threshold_over', { n: thresholds.umbral_inactivo_minutos }),
    },
    {
      label: t('map.freshness_nodata'), color: COLOR_SIN_DATOS, glow: false,
      count: summary.sin_datos, enMapa: false,
      detalle: t('map.nodata_detail', { h: thresholds.ventana_mapa_horas }),
    },
  ];

  /**
   * Tamaño de la flota activa. Ya no define el resumen —el alcance del mapa lo
   * decide el backend—, pero sirve como referencia: deja ver cuántos vehículos
   * existen contra cuántos se están monitoreando ahora.
   */
  const totalFlota = useMemo(
    () => vehicles.filter((v) => v.status !== 'inactive').length,
    [vehicles],
  );

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
              <div key={row.label} className="flex items-start justify-between text-[11px] gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      marginTop: '3px',
                      flexShrink: 0,
                      borderRadius: '50%',
                      background: row.color,
                      boxShadow: row.glow ? `0 0 6px ${row.color}` : undefined,
                      // Los que no están en el mapa se dibujan huecos, para que
                      // se lea de un vistazo que son otra cosa.
                      border: row.enMapa ? 'none' : '1px dashed rgba(255,255,255,0.35)',
                      opacity: row.enMapa ? 1 : 0.7,
                    }}
                  />
                  <span className="min-w-0">
                    <span className="text-textSecondary block truncate">{row.label}</span>
                    <span className="text-[9px] text-textMuted block">{row.detalle}</span>
                  </span>
                </div>
                <span style={{ color: row.color }} className="font-bold flex-shrink-0">{row.count}</span>
              </div>
            ))}
          </div>

          <div
            className="text-center text-[11px] rounded-lg py-2 mb-2"
            style={{ background: 'rgba(43,244,182,0.08)', border: '1px solid rgba(43,244,182,0.15)' }}
          >
            <span className="text-accentGreen font-bold text-sm">{summary.con_posicion}</span>
            <span className="text-textMuted"> / </span>
            <span className="text-white font-bold text-sm">{summary.total_en_alcance}</span>
            <span className="text-textMuted"> {t('map.reporting_ratio')}</span>
          </div>

          {/*
            El alcance se explica siempre, no sólo cuando falta alguien: un
            operador que no encuentra un vehículo en el mapa tiene que poder
            leer por qué no está, en lugar de concluir que el sistema falla.
          */}
          <div className="text-[9px] text-textMuted leading-relaxed mb-2">
            {t('map.scope_note')}
          </div>

          {/*
            Denominador honesto: cuántos vehículos tiene el cliente en total,
            para que "8 / 8 reportando" no se confunda con "toda la flota".
          */}
          <div className="text-[9px] text-textMuted text-center mb-1">
            {t('map.fleet_total_note', { n: totalFlota })}
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
