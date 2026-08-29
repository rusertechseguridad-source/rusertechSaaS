import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTripsStore, type Trip } from '../../store/tripsStore';
import { Map as MapIcon, ChevronLeft, Calendar, Truck, User, MapPin, Activity, Clock, Sun, CloudSun, CloudFog, CloudDrizzle, CloudRain, Snowflake, CloudLightning, Cloud, Edit2, FileText, Send, Thermometer, Droplets, Settings, RotateCcw, Download, Link as LinkIcon, X, Copy } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';
import { SensorHistoryModal } from '../sensors/SensorHistoryModal';
import { SensorConfigModal } from '../sensors/SensorConfigModal';
import { TripModal } from './TripModal';
import { LinkVehicleModal } from './LinkVehicleModal';
import { exportToCsv } from '../../utils/export';
import { VehicleCard } from '../../components/map/VehicleCard';
import { PosicionActualCard } from '../../components/monitoring/PosicionActualCard';
import { LineaDeTiempoEstados } from '../../components/monitoring/LineaDeTiempoEstados';
import { BotonInforme } from '../../components/monitoring/BotonInforme';
import type { LivePosition } from '../../types/monitoring';
import { FRESCURA_COLORS } from '../../constants/freshness';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export const TripDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getTrip, updateTrip, getLinkedVehicles, unlinkVehicle } = useTripsStore();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [weather, setWeather] = useState<any>(null);
  const [showTrace, setShowTrace] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [editingActualStart, setEditingActualStart] = useState(false);
  const [newActualStart, setNewActualStart] = useState('');
  
  const [operatorLogs, setOperatorLogs] = useState<any[]>([]);
  const [newLogText, setNewLogText] = useState('');
  // Ídem: la bitácora no muestra su propio estado de carga (Tanda 6).
  const [, setLoadingLogs] = useState(false);

  const [linkedVehicles, setLinkedVehicles] = useState<any[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);

  // Sort / type state for events and logs
  const [eventSort, setEventSort] = useState<'newest' | 'oldest'>('newest');
  const [logSort, setLogSort] = useState<'newest' | 'oldest'>('newest');
  const [logType, setLogType] = useState<'note' | 'alert'>('note');
  
  const [showModal, setShowModal] = useState(false);

  // Sensor Modal State
  const [sensorModalOpen, setSensorModalOpen] = useState(false);
  const [selectedSensorType, setSelectedSensorType] = useState<'temperature' | 'humidity'>('temperature');
  const [configModalOpen, setConfigModalOpen] = useState(false);

  /**
   * CAPA 1 — Posición actual del vehículo (telemetría).
   *
   * Es independiente del viaje: existe mientras el vehículo reporte, tenga o no
   * eventos declarados. Antes esta pantalla mostraba únicamente `trip_events`,
   * así que un viaje sin eventos se veía idéntico a un vehículo desaparecido.
   */
  const [posicionVehiculo, setPosicionVehiculo] = useState<LivePosition | null>(null);
  const [cargandoPosicion, setCargandoPosicion] = useState(false);
  /** Ventana que usó el backend, para redactar el estado vacío con precisión. */
  const [ventanaPosicionHoras, setVentanaPosicionHoras] = useState<number | undefined>();

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const alertMarkers = useRef<maplibregl.Marker[]>([]);
  /** Marcador de la posición actual. Se guarda aparte para poder moverlo. */
  const vehicleMarker = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (id) {
      loadTrip(id);
    }
  }, [id]);

  const loadTrip = async (tripId: string) => {
    setLoading(true);
    try {
      const data = await getTrip(tripId);
      setTrip(data);
      
      // Fetch weather asynchronously (non-blocking)
      if (data) {
        let lat = (data as any).origin_lat;
        let lng = (data as any).origin_lng;
        
        if (data.events && data.events.length > 0) {
           const latestEvent = data.events[data.events.length - 1];
           if (latestEvent.lat && latestEvent.lng) {
              lat = latestEvent.lat;
              lng = latestEvent.lng;
           }
        }
        
        if (lat && lng) {
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`)
            .then(res => res.ok ? res.json() : null)
            .then(wData => {
              if (wData) setWeather(wData.current_weather);
            })
            .catch(e => console.error('Weather fetch error', e));
        }
      }
      
      // Load logs asynchronously
      loadLogs(tripId);
      // Load linked vehicles asynchronously
      loadLinkedVehicles(tripId);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Consulta la última posición del vehículo del viaje.
   *
   * Usa `GET /vehicles/:id`, que devuelve `lastPosition` **sin** el filtro de
   * alcance del mapa: si alguien abrió este viaje, quiere ver dónde está su
   * vehículo aunque el mapa global no lo esté mostrando.
   */
  const loadPosicionVehiculo = async (vehicleId: string) => {
    setCargandoPosicion(true);
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch(`http://localhost:3000/api/v1/vehicles/${vehicleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.warn(`[TripDetails] /vehicles/${vehicleId} respondió ${res.status}`);
        return;
      }
      const data = await res.json();
      setPosicionVehiculo((data?.lastPosition as LivePosition) ?? null);
      if (typeof data?.lastPositionWindowHours === 'number') {
        setVentanaPosicionHoras(data.lastPositionWindowHours);
      }
    } catch (e) {
      // No se vacía la posición ante un error de red: se conserva la última
      // conocida en lugar de mostrar "sin datos", que sería una afirmación
      // falsa sobre el vehículo.
      console.error('[TripDetails] Error consultando la posición del vehículo:', e);
    } finally {
      setCargandoPosicion(false);
    }
  };

  /**
   * Refresco periódico mientras el viaje está EN CURSO. Un viaje finalizado no
   * necesita polling: su vehículo ya no forma parte de esa operación.
   */
  useEffect(() => {
    const vehicleId = (trip as any)?.vehicle?.id ?? (trip as any)?.vehicle_id;
    if (!vehicleId) {
      setPosicionVehiculo(null);
      return;
    }

    loadPosicionVehiculo(vehicleId);
    if (trip?.status !== 'EN_CURSO') return;

    const intervalo = setInterval(() => loadPosicionVehiculo(vehicleId), 30000);
    return () => clearInterval(intervalo);
  }, [(trip as any)?.vehicle?.id, (trip as any)?.vehicle_id, trip?.status]);

  const loadLinkedVehicles = async (tripId: string) => {
    try {
      const data = await getLinkedVehicles(tripId);
      setLinkedVehicles(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnlinkVehicle = async (vehicleId: string) => {
    if (!trip || !window.confirm('¿Está seguro que desea desenlazar este vehículo del viaje?')) return;
    try {
      await unlinkVehicle(trip.id, vehicleId);
      loadLinkedVehicles(trip.id);
    } catch (e) {
      console.error(e);
      alert('Error al desenlazar el vehículo');
    }
  };

  /**
   * Abre el informe del viaje. El endpoint exige el JWT en el header, así que
   * no alcanza con window.open(url): se descarga con fetch y se abre el blob.
   * Si el backend no tiene Chromium, responde HTML imprimible y avisa por
   * header — el operador imprime con Ctrl+P y el resultado es el mismo.
   */
  const handleGenerateMobileCode = async () => {
    if (!trip) return;
    try {
      await useTripsStore.getState().generateMobilePairing(trip.id);
      loadTrip(trip.id); // Reload to get updated metadata
    } catch (e) {
      console.error(e);
      alert('Error al generar código móvil');
    }
  };

  const handleCopyMobileCredentials = () => {
    if (!trip) return;
    const code = (trip as any).metadata_json?.mobile_pairing_code || '';
    const plate = trip.vehicle?.plate || '-';
    const dni = trip.driver?.document || '-';
    
    const text = `*📱 Rusertech Mobile - Credenciales de Viaje*\n\n*Placa:* ${plate}\n*Chofer (DNI):* ${dni}\n*Código de Enlace:* ${code}\n\nIngresa estos datos en la App para activar el GPS.`;
    
    navigator.clipboard.writeText(text).then(() => {
      alert('Credenciales copiadas al portapapeles. Ya puedes pegarlas en WhatsApp.');
    }).catch(err => {
      console.error('Error al copiar: ', err);
      alert('No se pudo copiar al portapapeles.');
    });
  };

  const loadLogs = async (tripId: string) => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`http://localhost:3000/api/v1/trips/${tripId}/logs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` }
      });
      if (res.ok) setOperatorLogs(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoadingLogs(false);
  };

  const handleAddLog = async () => {
    if (!newLogText.trim() || !trip) return;
    try {
      const res = await fetch(`http://localhost:3000/api/v1/trips/${trip.id}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`
        },
        body: JSON.stringify({ text: newLogText, type: logType })
      });
      if (res.ok) {
        setNewLogText('');
        setLogType('note');
        loadLogs(trip.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getWeatherDetails = (code: number) => {
    if (code === 0) return { label: 'Despejado', icon: <Sun className="w-5 h-5 text-yellow-400" /> };
    if (code >= 1 && code <= 3) return { label: 'Parcialmente Nublado', icon: <CloudSun className="w-5 h-5 text-gray-300" /> };
    if (code >= 45 && code <= 48) return { label: 'Niebla', icon: <CloudFog className="w-5 h-5 text-gray-400" /> };
    if (code >= 51 && code <= 55) return { label: 'Llovizna', icon: <CloudDrizzle className="w-5 h-5 text-blue-300" /> };
    if (code >= 61 && code <= 65) return { label: 'Lluvia', icon: <CloudRain className="w-5 h-5 text-blue-400" /> };
    if (code >= 71 && code <= 77) return { label: 'Nieve', icon: <Snowflake className="w-5 h-5 text-white" /> };
    if (code >= 95) return { label: 'Tormenta', icon: <CloudLightning className="w-5 h-5 text-yellow-500" /> };
    return { label: 'Nublado', icon: <Cloud className="w-5 h-5 text-gray-400" /> };
  };

  const handleChangeStatus = async (newStatus: string) => {
    if (!trip) return;
    setUpdating(true);
    await updateTrip(trip.id, { status: newStatus });
    await loadTrip(trip.id);
    setUpdating(false);
  };

  const handleUpdateActualStart = async () => {
    if (!trip || !newActualStart) return;
    setUpdating(true);
    await updateTrip(trip.id, { actual_start: new Date(newActualStart).toISOString() });
    await loadTrip(trip.id);
    setEditingActualStart(false);
    setUpdating(false);
  };

  const exportEventsCSV = () => {
    if (!trip?.events || trip.events.length === 0) return;
    const header = ['Fecha/Hora', 'Tipo', 'Lat', 'Lng', 'Velocidad (km/h)', 'Temperatura (C)', 'Humedad (%)'];
    const rows = trip.events.map((e: any) => [
      new Date(e.generated_at).toLocaleString(),
      e.event_type || 'GPS',
      e.lat, e.lng,
      e.speed || '',
      e.temperature_c || '',
      e.humidity_pct || ''
    ]);
    exportToCsv(`eventos_${trip.id}`, header, rows);
  };

  const exportLogsCSV = () => {
    if (!operatorLogs || operatorLogs.length === 0) return;
    const header = ['Fecha/Hora', 'Tipo', 'Usuario', 'Mensaje'];
    const rows = operatorLogs.map((l: any) => [
      new Date(l.triggered_at).toLocaleString(),
      l.type,
      l.acknowledger?.name || 'Sistema',
      l.metadata_json?.note || l.metadata_json?.alert_message || l.text || ''
    ]);
    exportToCsv(`bitacora_${trip?.id || 'export'}`, header, rows);
  };

  // Initialize map ONCE — use ResizeObserver so we only init when the container
  // actually has real pixel dimensions (avoids the 0×0 race condition with setTimeout)
  useEffect(() => {
    const container = mapContainer.current;
    if (!container) return;

    const initMap = () => {
      if (map.current) return; // already initialized
      if (!mapContainer.current) return;
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: 'https://tiles.openfreemap.org/styles/dark',
        center: [-58.3816, -34.6037],
        zoom: 10
      });
    };

    // Fire immediately if container already has dimensions, otherwise wait
    if (container.clientHeight > 0) {
      initMap();
    } else {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.height > 0) {
            observer.disconnect();
            initMap();
            break;
          }
        }
      });
      observer.observe(container);

      return () => {
        observer.disconnect();
        map.current?.remove();
        map.current = null;
      };
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update route/origin/destination markers when trip changes (identified by trip.id)
  useEffect(() => {
    if (!map.current || !trip) return;

    const applyMarkers = () => {
      if (!map.current || !trip) return;
      const bounds = new maplibregl.LngLatBounds();
      let hasBounds = false;

      // Draw Route (only add if source not already present)
      if (trip.route && trip.route.geojson && !map.current.getSource('route')) {
        map.current.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: trip.route.geojson
          }
        });
        map.current.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#00FF00', 'line-width': 5, 'line-opacity': 0.6 }
        });
      }

      if (trip.route && trip.route.geojson) {
        const coords = trip.route.geojson.type === 'MultiLineString'
          ? trip.route.geojson.coordinates.flat(1)
          : trip.route.geojson.coordinates;
        coords.forEach((c: number[]) => bounds.extend([c[0], c[1]]));
        hasBounds = true;
      }

      // Origin Marker
      const originLat = (trip as any).origin_lat;
      const originLng = (trip as any).origin_lng;
      if (originLat && originLng) {
        new maplibregl.Marker({ color: '#22c55e' })
          .setLngLat([originLng, originLat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML('<h3>Origen</h3>'))
          .addTo(map.current!);
        bounds.extend([originLng, originLat]);
        hasBounds = true;
      }

      // Destination Marker
      const destLat = (trip as any).destination_lat;
      const destLng = (trip as any).destination_lng;
      if (destLat && destLng) {
        new maplibregl.Marker({ color: '#ef4444' })
          .setLngLat([destLng, destLat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML('<h3>Destino</h3>'))
          .addTo(map.current!);
        bounds.extend([destLng, destLat]);
        hasBounds = true;
      }

      if (hasBounds) {
        map.current!.fitBounds(bounds, { padding: 50, maxZoom: 15 });
      }

      // Ensure map resizes properly
      setTimeout(() => map.current?.resize(), 200);
    };

    if (map.current.loaded()) {
      applyMarkers();
    } else {
      map.current.once('load', applyMarkers);
    }
  }, [trip?.id]);

  // Trace effect
  useEffect(() => {
    if (!map.current || !trip) return;

    const applyTrace = () => {
      if (!map.current) return;
      // Cleanup existing trace
      if (map.current.getLayer('trace-line')) map.current.removeLayer('trace-line');
      if (map.current.getSource('trace')) map.current.removeSource('trace');

      if (showTrace && trip.events && trip.events.length > 1) {
        const coords = trip.events
          .filter(e => e.lat && e.lng)
          .sort((a, b) => new Date(a.generated_at).getTime() - new Date(b.generated_at).getTime())
          .map(e => [e.lng, e.lat]);

        if (coords.length > 1) {
          map.current.addSource('trace', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords }
            }
          });
          map.current.addLayer({
            id: 'trace-line',
            type: 'line',
            source: 'trace',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#2ab3ff', 'line-width': 4, 'line-opacity': 0.8, 'line-dasharray': [2, 2] }
          });
        }
      }
    };

    if (map.current.loaded()) {
      applyTrace();
    } else {
      map.current.once('load', applyTrace);
    }
  }, [showTrace, trip]);

  /**
   * Marcador de la posición actual del vehículo.
   *
   * Va en su propio efecto y con su propio ref: se actualiza cada 30 s y no
   * debe recrear ni desplazar los marcadores de origen/destino, que sólo
   * dependen del viaje.
   *
   * El color repite la escala de frescura del mapa global. La primera vez
   * centra el mapa en el vehículo —es lo que el operador vino a ver— pero no
   * en cada refresco, para no pelear con el zoom que el usuario haya elegido.
   */
  useEffect(() => {
    if (!map.current) return;

    if (!posicionVehiculo) {
      vehicleMarker.current?.remove();
      vehicleMarker.current = null;
      return;
    }

    const { longitude, latitude, freshness } = posicionVehiculo;
    const color = FRESCURA_COLORS[freshness];

    const aplicar = () => {
      if (!map.current) return;
      const esPrimera = !vehicleMarker.current;

      if (!vehicleMarker.current) {
        const el = document.createElement('div');
        el.style.cssText = [
          'width:20px', 'height:20px', 'border-radius:50%', 'box-sizing:border-box',
          'border:3px solid #0B1120', `background:${color}`,
          `box-shadow:0 0 0 3px ${color}55`,
        ].join(';');
        el.title = posicionVehiculo.plate ?? '';
        vehicleMarker.current = new maplibregl.Marker({ element: el })
          .setLngLat([longitude, latitude])
          .addTo(map.current);
      } else {
        const el = vehicleMarker.current.getElement();
        el.style.background = color;
        el.style.boxShadow = `0 0 0 3px ${color}55`;
        vehicleMarker.current.setLngLat([longitude, latitude]);
      }

      if (esPrimera) map.current.easeTo({ center: [longitude, latitude], zoom: 13 });
    };

    if (map.current.loaded()) {
      aplicar();
    } else {
      map.current.once('load', aplicar);
    }
  }, [posicionVehiculo]);

  // Alert markers effect
  useEffect(() => {
    if (!map.current) return;

    // Remove existing alert markers
    alertMarkers.current.forEach(m => m.remove());
    alertMarkers.current = [];

    if (!showAlerts || !trip?.events) return;

    const addAlertMarkers = () => {
      if (!map.current) return;
      trip.events!.forEach((evt: any) => {
        const isAlert =
          evt.event_type === 'speed_exceeded' ||
          evt.event_type === 'temperature_alert' ||
          (evt.metadata_json && evt.metadata_json.alert_message != null);

        if (!isAlert || !evt.lat || !evt.lng) return;

        const el = document.createElement('div');
        el.style.cssText = [
          'width:28px', 'height:28px', 'border-radius:50%',
          'background:radial-gradient(circle,#ff4444,#cc0000)',
          'border:2px solid #ff6666', 'display:flex',
          'align-items:center', 'justify-content:center',
          'font-size:14px', 'cursor:pointer',
          'box-shadow:0 0 8px rgba(255,68,68,0.7)'
        ].join(';');
        el.textContent = '⚠';

        const meta = evt.metadata_json || {};
        const popupHtml = `
          <div style="font-family:sans-serif;font-size:12px;color:#fff;background:#1a1a2e;padding:8px;border-radius:6px;min-width:160px">
            <div style="font-weight:bold;color:#ff6666;margin-bottom:4px">⚠ Alerta</div>
            <div><b>Tipo:</b> ${evt.event_type || 'alerta'}</div>
            ${evt.generated_at ? `<div><b>Hora:</b> ${new Date(evt.generated_at).toLocaleString()}</div>` : ''}
            ${meta.alert_message ? `<div><b>Mensaje:</b> ${meta.alert_message}</div>` : ''}
            ${evt.speed != null ? `<div><b>Velocidad:</b> ${evt.speed} km/h</div>` : ''}
          </div>`;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([evt.lng, evt.lat])
          .setPopup(new maplibregl.Popup({ offset: 15, closeButton: false }).setHTML(popupHtml))
          .addTo(map.current!);

        alertMarkers.current.push(marker);
      });
    };

    if (map.current.loaded()) {
      addAlertMarkers();
    } else {
      map.current.once('load', addAlertMarkers);
    }
  }, [showAlerts, trip]);

  if (loading) return <div className="p-8 text-center text-textMuted">Cargando detalles del viaje...</div>;
  if (!trip) return <div className="p-8 text-center text-statusDanger">Viaje no encontrado</div>;

  return (
    <div className="p-8 h-[calc(100vh-4rem)] w-full flex flex-col">
      <div className="mb-6 flex items-center justify-between shrink-0">
        <div className="flex items-center">
          <Link to="/trips" className="mr-4 p-2 bg-bgSurface border border-borderDefault rounded hover:text-white hover:bg-bgSurfaceHigh transition-colors text-textSecondary">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-display font-bold text-white flex items-center">
              {trip.name}
            </h1>
            <p className="text-textMuted text-sm font-mono mt-1">ID: {trip.id} {trip.trip_code ? `| COD: ${trip.trip_code}` : ''}</p>
          </div>
        </div>
        
        {/*
          El informe, donde se ve. La primera versión era un ícono de 16 px sin
          texto adentro del panel de eventos: técnicamente existía,
          operativamente no. Un botón que hay que descubrir no es un botón.
        */}
        <BotonInforme tripId={trip.id} />

        <RequirePermission permission="manage_trips">
          <div className="flex bg-bgSurface border border-borderDefault rounded-lg overflow-hidden p-1 shadow-card">
            {['PROGRAMADO', 'EN_CURSO', 'FINALIZADO', 'CANCELADO'].map(status => (
              <button
                key={status}
                disabled={updating}
                onClick={() => {
                  if (status === 'CANCELADO' && !confirm('¿Estás seguro de cancelar este viaje?')) return;
                  handleChangeStatus(status);
                }}
                className={`px-4 py-1.5 text-xs font-bold uppercase rounded transition-colors ${
                  trip.status === status
                    ? (status === 'CANCELADO' ? 'bg-statusDanger text-bgStart shadow' : 'bg-accentGreen text-bgStart shadow')
                    : (status === 'CANCELADO' ? 'text-statusDanger hover:text-white hover:bg-statusDanger/20' : 'text-textSecondary hover:text-white hover:bg-bgSurfaceHigh')
                } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-bgSurfaceHigh border border-borderDefault rounded text-textSecondary hover:text-white hover:bg-bgSurface transition-colors" title="Editar Viaje">
              <Edit2 className="w-4 h-4" /> <span className="text-sm font-bold">Editar</span>
            </button>
            <button onClick={() => loadTrip(trip.id)} className="text-textMuted hover:text-white transition-colors p-1" title="Recargar">
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </RequirePermission>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* COLUMNA IZQUIERDA: DETALLES */}
        <div className="lg:col-span-3 flex flex-col gap-3 overflow-y-auto pr-2 pb-8">
          {/* Card Resumen */}
          <div className="bg-bgSurface border border-borderDefault rounded-xl p-3 shadow-card">
            <h3 className="text-xs font-bold text-accentGreen uppercase tracking-wider mb-2 border-b border-borderDefault pb-1.5">Logística</h3>
            <div className="space-y-3 text-xs">
              <VehicleCard vehicle={trip.vehicle} tripId={trip.id} />
              <div className="flex items-start gap-3 mt-3">
                <User className="w-5 h-5 text-textMuted mt-0.5" />
                <div>
                  <div className="text-textMuted text-xs">Operación / Cliente</div>
                  <div className="text-white font-medium">{trip.operation?.name || 'Interno (Sin Cliente asignado)'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-bgSurface border border-borderDefault rounded-xl p-3 shadow-card">
            <h3 className="text-xs font-bold text-accentGreen uppercase tracking-wider mb-2 border-b border-borderDefault pb-1.5">Ruta</h3>
            <div className="space-y-2 relative">
              <div className="absolute left-[11px] top-6 bottom-6 w-0.5 bg-borderDefault z-0"></div>
              
              <div className="flex items-start gap-3 relative z-10">
                <div className="bg-bgSurface rounded-full p-1 mt-0.5 border border-textMuted shadow">
                  <div className="w-2.5 h-2.5 bg-textMuted rounded-full"></div>
                </div>
                <div>
                  <div className="text-textMuted text-xs">Origen</div>
                  <div className="text-white font-medium">{trip.origin_location?.name || 'Indefinido'}</div>
                  <div className="text-textSecondary text-xs">{trip.origin_location?.address}</div>
                </div>
              </div>

              <div className="flex items-start gap-3 relative z-10">
                <div className="bg-bgSurface rounded-full p-1 mt-0.5 border border-accentGreen shadow">
                  <div className="w-2.5 h-2.5 bg-accentGreen rounded-full"></div>
                </div>
                <div>
                  <div className="text-textMuted text-xs">Destino</div>
                  <div className="text-white font-medium">{trip.destination_location?.name || 'Indefinido'}</div>
                  <div className="text-textSecondary text-xs">{trip.destination_location?.address}</div>
                </div>
              </div>
            </div>
            {trip.route && (
              <div className="mt-4 pt-4 border-t border-borderDefault">
                <div className="text-textMuted text-xs mb-1">Corredor asignado</div>
                <div className="flex items-center gap-2 text-white text-sm">
                  <MapIcon className="w-4 h-4 text-accentGreen" />
                  {trip.route.name}
                </div>
              </div>
            )}
          </div>

          <div className="bg-bgSurface border border-borderDefault rounded-xl p-3 shadow-card">
            <h3 className="text-xs font-bold text-accentGreen uppercase tracking-wider mb-2 border-b border-borderDefault pb-1.5">Tiempos</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-textSecondary"><Calendar className="w-4 h-4" /> Inicio Programado</div>
                <div className="text-white">{new Date(trip.scheduled_start).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</div>
              </div>
              {trip.scheduled_end && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-textSecondary"><Calendar className="w-4 h-4" /> Fin Programado</div>
                  <div className="text-white">{new Date(trip.scheduled_end).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</div>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-textSecondary"><Clock className="w-4 h-4 text-accentMint" /> Inicio Real</div>
                <div className="text-white text-right">
                  {editingActualStart ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input 
                        type="datetime-local" 
                        value={newActualStart} 
                        onChange={e => setNewActualStart(e.target.value)}
                        className="bg-bgStart border border-borderDefault rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accentBlue"
                      />
                      <button onClick={handleUpdateActualStart} className="text-accentGreen text-xs hover:underline">Guardar</button>
                      <button onClick={() => setEditingActualStart(false)} className="text-textMuted text-xs hover:underline">Cancelar</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      {trip.actual_start ? new Date(trip.actual_start).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : 'No iniciado'}
                      <button onClick={() => setEditingActualStart(true)} className="text-textMuted hover:text-white" title="Establecer Inicio Real manualmente"><Edit2 className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              </div>

              {trip.actual_end && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-textSecondary"><Clock className="w-4 h-4 text-accentBlue" /> Fin Real</div>
                  <div className="text-white">{new Date(trip.actual_end).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</div>
                </div>
              )}
            </div>
          </div>

          {/*
            CAPA 1 — dónde está el vehículo ahora. Va antes del clima y de los
            sensores porque es la pregunta que trae al operador a esta pantalla,
            y porque las otras dos tarjetas se alimentan de `trip_events`, que
            puede estar vacío sin que eso signifique nada malo.
          */}
          <PosicionActualCard
            posicion={posicionVehiculo}
            cargando={cargandoPosicion && !posicionVehiculo}
            tieneVehiculo={Boolean((trip as any)?.vehicle?.id ?? (trip as any)?.vehicle_id)}
            ventanaHoras={ventanaPosicionHoras}
          />

          {/*
            Por qué el viaje está en el estado en el que está. Va junto a la
            posición actual porque son las dos preguntas que trae al operador
            a esta pantalla.
          */}
          <LineaDeTiempoEstados tripId={trip?.id} />

          {weather && (
            <div className="bg-bgSurface border border-borderDefault rounded-xl p-3 shadow-card shrink-0">
              <h3 className="text-xs font-bold text-accentGreen uppercase tracking-wider mb-2 border-b border-borderDefault pb-1.5 flex items-center gap-2" title="El clima mostrado corresponde a la posición actual del vehículo">
                {getWeatherDetails(weather.weathercode).icon}
                Clima en: {trip.events && trip.events.length > 0 && trip.events[trip.events.length - 1].address ? trip.events[trip.events.length - 1].address.substring(0, 30) + '...' : (trip.origin_location?.name || 'Origen')}
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-display font-bold text-white">{weather.temperature}°C</div>
                  <div className="text-textSecondary text-[10px] mt-1">Viento: <span className="font-mono text-white">{weather.windspeed} km/h</span></div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <div className="text-[10px] text-textMuted mb-0.5">Condiciones</div>
                  <div className="text-xs font-bold text-accentBlue uppercase">{getWeatherDetails(weather.weathercode).label}</div>
                </div>
              </div>
            </div>
          )}

          {/* SENSORS PANEL */}
          {(() => {
            // Fix data mapping: resolve temperature/humidity from metadata_json with direct field fallback
            const latestEvent = trip.events && trip.events.length > 0
              ? [...trip.events].sort((a, b) => new Date(b.timestamp ?? b.generated_at).getTime() - new Date(a.timestamp ?? a.generated_at).getTime())[0] as any
              : null;
            const latestTemp = latestEvent ? (latestEvent.metadata_json?.temperature_c ?? latestEvent.temperature_c) : undefined;
            const latestHum  = latestEvent ? (latestEvent.metadata_json?.humidity_pct  ?? latestEvent.humidity_pct)  : undefined;
            if (latestTemp === undefined) return null;
            return (
              <div className="bg-bgSurface border border-borderDefault rounded-xl p-3 shadow-card shrink-0">
                <div className="flex justify-between items-center mb-2 border-b border-borderDefault pb-1.5">
                  <h3 className="text-xs font-bold text-accentMint uppercase tracking-wider flex items-center gap-2">
                    <Thermometer className="w-3 h-3 text-statusWarning" />
                    Sensores del Vehículo
                  </h3>
                  <button
                    onClick={() => setConfigModalOpen(true)}
                    className="text-textMuted hover:text-white"
                    title="Configurar Rangos"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div
                    className="bg-bgStart/50 border border-borderDefault/50 rounded-lg p-2 text-center cursor-pointer hover:border-accentMint/50 transition-colors"
                    onClick={() => { setSelectedSensorType('temperature'); setSensorModalOpen(true); }}
                  >
                    <Thermometer className={`w-4 h-4 mx-auto mb-1 ${latestTemp > 8 ? 'text-statusDanger' : 'text-accentMint'}`} />
                    <div className="text-xl font-display font-bold text-white">{latestTemp}°C</div>
                    <div className="text-[10px] text-textMuted uppercase tracking-wider mt-0.5">Temperatura</div>
                  </div>

                  <div
                    className="bg-bgStart/50 border border-borderDefault/50 rounded-lg p-2 text-center cursor-pointer hover:border-accentBlue/50 transition-colors"
                    onClick={() => { setSelectedSensorType('humidity'); setSensorModalOpen(true); }}
                  >
                    <Droplets className="w-4 h-4 text-accentBlue mx-auto mb-1" />
                    <div className="text-xl font-display font-bold text-white">{latestHum ?? '--'}%</div>
                    <div className="text-[10px] text-textMuted uppercase tracking-wider mt-0.5">Humedad</div>
                  </div>
                </div>
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => { setSelectedSensorType('temperature'); setSensorModalOpen(true); }}
                    className="text-xs font-bold text-accentBlue hover:underline flex items-center gap-1"
                  >
                    Ver Histórico Completo <Activity className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Vehículos Enlazados */}
          <div className="bg-bgSurface border border-borderDefault rounded-xl p-3 shadow-card shrink-0 mt-3">
            <div className="flex justify-between items-center mb-2 border-b border-borderDefault pb-1.5">
              <h3 className="text-xs font-bold text-accentBlue uppercase tracking-wider flex items-center gap-2">
                <LinkIcon className="w-3 h-3 text-accentBlue" />
                Vehículos Enlazados
              </h3>
              <button
                onClick={() => setShowLinkModal(true)}
                className="text-[10px] bg-accentBlue/10 hover:bg-accentBlue/20 text-accentBlue font-bold px-2 py-1 rounded transition-colors"
                title="Enlazar nuevo vehículo"
              >
                + Enlazar
              </button>
            </div>
            
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {linkedVehicles.length === 0 ? (
                <div className="text-center text-textMuted text-xs py-2">
                  No hay vehículos enlazados a este viaje.
                </div>
              ) : (
                linkedVehicles.map(lv => (
                  <div key={lv.id} className="bg-bgStart border border-borderDefault/50 rounded p-2 flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                      <div className="bg-bgSurfaceHigh p-1.5 rounded text-textMuted">
                        <Truck className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white leading-tight">{lv.vehicle?.plate}</div>
                        <div className="text-[9px] text-textSecondary uppercase tracking-wider">{lv.link_type}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleUnlinkVehicle(lv.vehicle_id)}
                      className="text-textMuted hover:text-statusDanger transition-colors p-1 opacity-0 group-hover:opacity-100"
                      title="Desenlazar vehículo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Rusertech Mobile Pairing */}
          <div className="bg-bgSurface border border-borderDefault rounded-xl p-3 shadow-card shrink-0 mt-3">
            <div className="flex justify-between items-center mb-2 border-b border-borderDefault pb-1.5">
              <h3 className="text-xs font-bold text-accentGreen uppercase tracking-wider flex items-center gap-2">
                Servicio Mobile
              </h3>
            </div>
            <div className="space-y-3">
              {(trip as any).metadata_json?.mobile_service_active ? (
                <div className="bg-bgStart border border-borderDefault/50 rounded p-3">
                  <div className="text-xs text-textMuted mb-2">Servicio activo para este viaje. Entregue este código al chofer:</div>
                  <div className="text-center bg-bgSurfaceHigh rounded py-2 px-4 mb-2 select-all">
                    <span className="text-xl font-display font-black text-accentGreen tracking-widest">
                      {(trip as any).metadata_json?.mobile_pairing_code}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-textMuted mt-2 text-center">
                    <div>Placa: <span className="text-white font-bold">{trip.vehicle?.plate || '-'}</span></div>
                    <div>Chofer: <span className="text-white font-bold">{trip.driver?.document || '-'}</span></div>
                  </div>
                  <button 
                    onClick={handleCopyMobileCredentials}
                    className="w-full mt-3 flex items-center justify-center gap-2 bg-accentBlue hover:bg-accentBlue/90 text-bgStart font-bold text-xs py-2 rounded shadow-lg shadow-accentBlue/20 transition-all"
                  >
                    <Copy className="w-3 h-3" /> Copiar para WhatsApp
                  </button>
                  <button 
                    onClick={handleGenerateMobileCode}
                    className="w-full mt-2 text-xs bg-bgSurface border border-borderDefault text-textMuted hover:text-white py-1.5 rounded transition-colors"
                  >
                    Regenerar Código
                  </button>
                </div>
              ) : (
                <div className="text-center p-3 border border-dashed border-borderDefault rounded">
                  <p className="text-xs text-textMuted mb-3">La app móvil no está activada para este viaje.</p>
                  <button 
                    onClick={handleGenerateMobileCode}
                    className="bg-accentGreen hover:bg-accentGreen/90 text-bgStart font-bold text-xs px-4 py-2 rounded shadow-lg shadow-accentGreen/20 transition-all w-full"
                  >
                    Activar Rusertech Mobile
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: EVENTOS Y MAPA */}
        <div className="lg:col-span-9 flex flex-col gap-6 h-full min-h-0">
          <div className="bg-bgStart border border-borderDefault rounded-xl flex-1 relative overflow-hidden flex flex-col items-center justify-center" style={{ minHeight: '500px' }}>
            <div ref={mapContainer} className="absolute inset-0 w-full h-full" style={{ height: '100%', minHeight: '500px' }} />
            
            {/* Map Controls */}
            <div className="absolute top-4 right-4 z-10 bg-bgSurfaceHigh/90 backdrop-blur-sm border border-borderDefault rounded-lg shadow-card p-3 flex flex-col gap-3">
              {/* Switch: Trazar Recorrido GPS */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-white uppercase tracking-wider cursor-pointer select-none" htmlFor="trace-switch">
                  Trazar Recorrido GPS
                </label>
                <button
                  id="trace-switch"
                  onClick={() => setShowTrace(!showTrace)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${showTrace ? 'bg-accentBlue' : 'bg-borderDefault'}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showTrace ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              {/* Switch: Alertas en Mapa */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-white uppercase tracking-wider cursor-pointer select-none" htmlFor="alerts-switch">
                  Alertas en Mapa
                </label>
                <button
                  id="alerts-switch"
                  onClick={() => setShowAlerts(!showAlerts)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${showAlerts ? 'bg-red-500' : 'bg-borderDefault'}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showAlerts ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
            {/*
              Estados vacíos del mapa, separados en dos porque son dos causas
              distintas y antes se confundían en un solo cartel:

               · Sin contexto de viaje NI posición → el mapa está realmente
                 vacío. Es el único caso que tapa el mapa.
               · Sin contexto de viaje PERO con posición → el mapa muestra al
                 vehículo; falta el plan (origen, destino, corredor). Se avisa
                 con una nota al pie, sin bloquear la vista.

              La distinción importa: un viaje en Tracking Libre no tiene plan
              cargado y eso es normal, no una falla que haya que reportar.
            */}
            {(() => {
              const sinContextoViaje =
                !(trip as any).origin_lat &&
                !(trip as any).destination_lat &&
                !trip.route?.geojson &&
                (!trip.events || trip.events.length === 0);

              if (!sinContextoViaje) return null;

              if (!posicionVehiculo) {
                return (
                  <div className="absolute inset-0 bg-bgStart/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center pointer-events-none p-8 text-center">
                    <MapPin className="w-16 h-16 mx-auto text-bgSurfaceHigh mb-4" />
                    <p className="text-white font-bold mb-2">Sin datos para mostrar</p>
                    <p className="text-textMuted text-sm max-w-sm">
                      Este viaje no tiene origen, destino ni corredor cargados, y el vehículo
                      todavía no reportó ninguna posición. El mapa se va a centrar solo en cuanto
                      llegue el primer punto de GPS.
                    </p>
                  </div>
                );
              }

              return (
                <div className="absolute bottom-4 left-4 right-4 z-10 bg-bgSurfaceHigh/90 backdrop-blur-sm border border-borderDefault rounded-lg p-3 pointer-events-none">
                  <p className="text-xs text-textSecondary leading-relaxed">
                    <span className="text-white font-bold">Viaje sin ruta planificada.</span>{' '}
                    Se está mostrando la posición actual del vehículo. No se cargaron origen,
                    destino ni corredor, así que no hay recorrido previsto contra el cual
                    comparar — algo esperable en un seguimiento sin viaje declarado.
                  </p>
                </div>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-56 shrink-0">
            {/* Event Logs */}
            <div className="bg-bgSurface border border-borderDefault rounded-xl shadow-card flex flex-col h-full min-h-0">
              <div className="p-4 border-b border-borderDefault shrink-0 flex items-center justify-between">
                <h3 className="text-sm font-bold text-accentGreen uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Registro de Eventos (Histórico Completo)
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-textMuted">{trip.events?.length || 0} total</span>
                  <button onClick={exportEventsCSV} className="p-1 hover:text-white text-textMuted transition-colors ml-1" title="Exportar a CSV">
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEventSort('newest')}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                      eventSort === 'newest' ? 'bg-accentGreen text-bgStart' : 'bg-bgSurfaceHigh text-textMuted hover:text-white'
                    }`}
                  >
                    Más nuevo ▼
                  </button>
                  <button
                    onClick={() => setEventSort('oldest')}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                      eventSort === 'oldest' ? 'bg-accentGreen text-bgStart' : 'bg-bgSurfaceHigh text-textMuted hover:text-white'
                    }`}
                  >
                    Más antiguo ▲
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {trip.events && trip.events.length > 0 ? (() => {
                  const sortedEvents = [...trip.events].sort((a, b) =>
                    eventSort === 'newest'
                      ? new Date((b as any).timestamp ?? b.generated_at).getTime() - new Date((a as any).timestamp ?? a.generated_at).getTime()
                      : new Date((a as any).timestamp ?? a.generated_at).getTime() - new Date((b as any).timestamp ?? b.generated_at).getTime()
                  ).slice(0, 1000); // Increased render limit to 1000 for performance, export contains all
                  const translateEvent = (eventType: string) => {
                    const types: Record<string, string> = {
                      'SPEED_VIOLATION': 'EXCESO DE VELOCIDAD',
                      'speed_violation': 'EXCESO DE VELOCIDAD',
                      'speed_exceeded': 'EXCESO DE VELOCIDAD',
                      'position': 'POSICIÓN',
                      'harsh_acceleration': 'ACELERACIÓN BRUSCA',
                      'harsh_braking': 'FRENADA BRUSCA',
                      'harsh_cornering': 'GIRO BRUSCO',
                      'jamming': 'INTERFERENCIA DE SEÑAL',
                      'geofence_enter': 'ENTRADA A GEOFENCE',
                      'geofence_exit': 'SALIDA DE GEOFENCE',
                      'power_cut': 'CORTE DE CORRIENTE'
                    };
                    return types[eventType] || eventType.replace(/_/g, ' ').toUpperCase();
                  };
                  return (
                    <div className="space-y-2">
                      {sortedEvents.map((evt: any) => (
                        <div 
                          key={evt.id} 
                          className="flex gap-3 text-xs p-2 bg-bgStart border border-borderDefault rounded cursor-pointer hover:border-accentBlue transition-colors"
                          onClick={() => {
                            if (evt.lat && evt.lng && map.current) {
                              map.current.flyTo({ center: [evt.lng, evt.lat], zoom: 16 });
                            }
                          }}
                        >
                          <div className="text-textMuted w-24 shrink-0 text-[10px] leading-tight">
                            {new Date(evt.timestamp ?? evt.generated_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-white mr-2 truncate">{translateEvent(evt.event_type || evt.event_name || 'Evento')}</span>
                            {evt.speed !== null && <span className="text-[10px] text-accentBlue font-mono">{evt.speed} km/h</span>}
                            {evt.address && <div className="text-textSecondary text-[10px] mt-0.5 truncate">{evt.address}</div>}
                            {evt.lat && evt.lng && <div className="text-textMuted text-[9px] mt-0.5 font-mono">[{Number(evt.lat).toFixed(5)}, {Number(evt.lng).toFixed(5)}]</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })() : (
                  /*
                    CAPA 2 vacía. La frase anterior ("No hay eventos registrados
                    en telemetría todavía") se leía como una falla del sistema.
                    No lo es: los eventos de viaje los genera la app del
                    conductor al declarar paradas, checkpoints y novedades. Un
                    viaje puede estar corriendo perfectamente sin ninguno.
                    El estado se explica, y se aclara que la posición del
                    vehículo es otra cosa y sigue arriba.
                  */
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-2">
                    <Activity className="w-8 h-8 text-bgSurfaceHigh" />
                    <p className="text-textSecondary text-sm font-bold">
                      Todavía no hay eventos declarados
                    </p>
                    <p className="text-textMuted text-xs max-w-xs leading-relaxed">
                      Los eventos los genera la app del conductor cuando declara paradas,
                      checkpoints o novedades. Que no haya ninguno no significa que el viaje
                      esté detenido.
                      {posicionVehiculo
                        ? ' La posición actual del vehículo se muestra arriba y en el mapa.'
                        : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Operator Logs (Bitácora) */}
            <div className="bg-bgSurface border border-borderDefault rounded-xl shadow-card flex flex-col h-full min-h-0">
              <div className="p-4 border-b border-borderDefault shrink-0 flex items-center justify-between bg-bgStart/30">
                <h3 className="text-sm font-bold text-accentBlue uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Bitácora del Operador
                </h3>
                <div className="flex items-center gap-2">
                  <button onClick={exportLogsCSV} className="p-1 hover:text-white text-textMuted transition-colors mr-1" title="Exportar a CSV">
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setLogSort('newest')}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                      logSort === 'newest' ? 'bg-accentBlue text-bgStart' : 'bg-bgSurfaceHigh text-textMuted hover:text-white'
                    }`}
                  >
                    Más nuevo ▼
                  </button>
                  <button
                    onClick={() => setLogSort('oldest')}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                      logSort === 'oldest' ? 'bg-accentBlue text-bgStart' : 'bg-bgSurfaceHigh text-textMuted hover:text-white'
                    }`}
                  >
                    Más antiguo ▲
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {operatorLogs.length > 0 ? (() => {
                  const sortedLogs = [...operatorLogs].sort((a, b) =>
                    logSort === 'newest'
                      ? new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime()
                      : new Date(a.triggered_at).getTime() - new Date(b.triggered_at).getTime()
                  );
                  return sortedLogs.map((log: any) => {
                    const isAlert =
                      log.type === 'alert' ||
                      (log.metadata_json?.note && log.metadata_json.note.startsWith('[ALERTA')) ||
                      log.metadata_json?.alert_type != null;
                    return (
                      <div
                        key={log.id}
                        className={`bg-bgStart rounded p-3 text-sm flex gap-3 border-l-4 ${
                          isAlert ? 'border-orange-400 border border-orange-400/30' : 'border-accentBlue border border-borderDefault'
                        }`}
                      >
                        <div className="shrink-0 flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                            isAlert ? 'bg-orange-400/20 text-orange-400' : 'bg-accentBlue/20 text-accentBlue'
                          }`}>
                            {log.acknowledger?.name ? log.acknowledger.name.charAt(0) : 'U'}
                          </div>
                          <div className="text-[10px] text-textMuted mt-1 text-center">
                            {new Date(log.triggered_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${
                            isAlert ? 'text-orange-400' : 'text-accentBlue'
                          }`}>
                            {isAlert ? '🔔 Alerta Atendida' : '📝 Bitácora'}
                          </div>
                          <div className="font-bold text-white text-xs mb-1">
                            {log.acknowledger?.name || log.acknowledger?.email || 'Usuario'}
                            <span className="font-normal text-textMuted ml-2 text-[10px]">{new Date(log.triggered_at).toLocaleDateString('es-AR')}</span>
                          </div>
                          <div className="text-textSecondary whitespace-pre-wrap break-words">{log.metadata_json?.note || ''}</div>
                        </div>
                      </div>
                    );
                  });
                })() : (
                  <div className="h-full flex items-center justify-center text-textMuted text-sm">
                    Sin anotaciones.
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-borderDefault bg-bgStart/50 shrink-0">
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setLogType('note')}
                    className={`flex-1 px-3 py-1.5 rounded text-xs font-bold transition-colors border ${
                      logType === 'note'
                        ? 'bg-accentBlue/20 border-accentBlue text-accentBlue'
                        : 'border-borderDefault text-textMuted hover:text-white bg-bgStart'
                    }`}
                  >
                    📝 Nota libre
                  </button>
                  <button
                    onClick={() => setLogType('alert')}
                    className={`flex-1 px-3 py-1.5 rounded text-xs font-bold transition-colors border ${
                      logType === 'alert'
                        ? 'bg-orange-400/20 border-orange-400 text-orange-400'
                        : 'border-borderDefault text-textMuted hover:text-white bg-bgStart'
                    }`}
                  >
                    🔔 Alerta atendida
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLogText}
                    onChange={(e) => setNewLogText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddLog()}
                    placeholder={logType === 'alert' ? 'Describir alerta atendida...' : 'Escribir anotación en bitácora...'}
                    className={`flex-1 bg-bgStart border rounded px-3 py-2 text-sm text-white focus:outline-none ${
                      logType === 'alert' ? 'border-orange-400/50 focus:border-orange-400' : 'border-borderDefault focus:border-accentBlue'
                    }`}
                  />
                  <button
                    onClick={handleAddLog}
                    disabled={!newLogText.trim()}
                    className={`text-bgStart p-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      logType === 'alert' ? 'bg-orange-400 hover:bg-orange-400/90' : 'bg-accentBlue hover:bg-accentBlue/90'
                    }`}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {sensorModalOpen && trip.vehicle_id && (
        <SensorHistoryModal 
          vehicle={trip.vehicle}
          token={localStorage.getItem('rusertech_token') || ''}
          sensorType={selectedSensorType}
          onClose={() => setSensorModalOpen(false)}
        />
      )}

      {configModalOpen && trip.vehicle_id && (
        <SensorConfigModal 
          vehicleId={trip.vehicle_id}
          onClose={() => setConfigModalOpen(false)}
        />
      )}

      <TripModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        tripToEdit={trip}
        onSaved={() => loadTrip(trip.id)}
      />
      {showLinkModal && <LinkVehicleModal tripId={trip.id} onClose={() => setShowLinkModal(false)} onSuccess={() => { setShowLinkModal(false); loadLinkedVehicles(trip.id); }} />}
    </div>
  );
};
