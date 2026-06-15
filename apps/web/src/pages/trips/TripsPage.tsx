import React, { useEffect, useState } from 'react';
import { useTripsStore, type Trip } from '../../store/tripsStore';
import {
  Truck, Plus, Search, Calendar, MapPin, User, Building2,
  Radio, ChevronRight, CheckCircle, X, Filter, Thermometer,
  Droplets, AlertTriangle, Clock, Play,
} from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';
import { Link } from 'react-router-dom';
import { TripModal } from './TripModal';

/* ─────────────── helpers ─────────────── */
const STATUS_COLOR: Record<string, string> = {
  EN_CURSO:   'bg-accentGreen/20 text-accentGreen border-accentGreen/30',
  PROGRAMADO: 'bg-accentBlue/20 text-accentBlue border-accentBlue/30',
  FINALIZADO: 'bg-textMuted/20 text-textMuted border-textMuted/30',
  CANCELADO:  'bg-statusDanger/20 text-statusDanger border-statusDanger/30',
};

function statusBadge(status: string) {
  return STATUS_COLOR[status] ?? 'bg-bgSurfaceHigh text-textSecondary border-borderDefault';
}

function fmt(dt: string | null | undefined) {
  if (!dt) return null;
  return new Date(dt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function lastEvent(trip: Trip) {
  if (!trip.events || trip.events.length === 0) return null;
  return [...trip.events].sort(
    (a: any, b: any) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime()
  )[0];
}

function alertCount(trip: Trip) {
  if (!trip.events) return 0;
  return trip.events.filter((e: any) =>
    e.event_type === 'speed_exceeded' || e.event_type === 'temperature_alert'
  ).length;
}

const TripRow: React.FC<{ trip: Trip, onEdit: (trip: Trip) => void }> = ({ trip, onEdit }) => {
  const ev = lastEvent(trip) as any;
  const alerts = alertCount(trip);
  const hasEvents = !!ev;

  return (
    <div
      className="flex items-center min-w-[1100px] w-full bg-bgSurface border-b border-borderDefault/50 hover:bg-bgSurfaceHigh transition-all cursor-pointer group px-4 py-2 gap-4"
    >
      {/* 1. Estado */}
      <div className="w-24 shrink-0">
        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${statusBadge(trip.status)}`}>
          {trip.status === 'EN_CURSO' ? 'En Curso' : trip.status === 'PROGRAMADO' ? 'Programado' : trip.status === 'FINALIZADO' ? 'Finalizado' : trip.status}
        </span>
      </div>

      {/* 2. Viaje */}
      <div className="flex-1 min-w-[150px]">
        <div className="text-white font-bold text-sm truncate">{trip.name}</div>
        <div className="font-bold text-white mt-0.5 truncate">{trip.trip_code ?? 'SIN_CÓDIGO'}</div>
        <div className="text-textMuted text-[9px] font-mono mt-0.5 truncate" title={trip.id}>ID: {trip.id}</div>
      </div>

      {/* 3. Vehículo */}
      <div className="flex-1 min-w-[150px] flex flex-col justify-center">
        {trip.vehicle ? (
          <>
            <div className="text-xs text-white truncate flex items-center gap-1.5">
              <Truck className="w-3 h-3 text-textMuted" />
              {trip.vehicle.plate}{trip.vehicle.alias ? ` (${trip.vehicle.alias})` : ''}
            </div>
            <div className="text-white font-bold text-xs mt-0.5 truncate">
              {(trip as any).carrier?.name || (trip.vehicle as any)?.carrier?.name || 'Sin transportista'}
            </div>
          </>
        ) : (
          <span className="text-white font-bold text-xs italic">Sin Vehículo</span>
        )}
      </div>

      {/* 4. Chofer */}
      <div className="flex-1 min-w-[150px]">
        {(trip as any).driver ? (
          <div className="text-xs text-white truncate flex items-center gap-1.5">
            <User className="w-3 h-3 text-textMuted" />
            {(trip as any).driver.full_name}
          </div>
        ) : (
          <span className="text-xs text-textMuted italic">N/D</span>
        )}
      </div>

      {/* 5. Origen -> Destino */}
      <div className="flex-[1.5] min-w-[200px]">
        <div className="text-white font-bold text-xs truncate flex items-center gap-1.5 mb-0.5">
          <MapPin className="w-3 h-3 text-statusDanger shrink-0" />
          {trip.origin_location?.name ?? 'N/D'}
        </div>
        <div className="text-white font-bold text-xs truncate flex items-center gap-1.5">
          <MapPin className="w-3 h-3 text-accentMint shrink-0" />
          {trip.destination_location?.name ?? 'N/D'}
        </div>
      </div>

      {/* 6. Inicio Plan. */}
      <div className="w-32 shrink-0 flex flex-col justify-center">
        <div className="text-white font-bold text-xs flex items-center gap-1.5">
          <Calendar className="w-3 h-3 text-white/50" />
          {fmt(trip.scheduled_start) ?? '--'}
        </div>
        <div className={`text-xs font-bold mt-0.5 flex items-center gap-1.5 ${trip.actual_start ? 'text-accentBlue' : 'text-white/50'}`}>
          <Play className="w-2.5 h-2.5" />
          {trip.actual_start ? fmt(trip.actual_start) : 'No iniciado'}
        </div>
      </div>

      {/* 7. Telemetría */}
      <div className="flex-[1.5] min-w-[200px]">
        {hasEvents ? (
          <>
            <div className="flex items-center gap-2 text-xs font-bold">
              {ev.speed != null && <span className="text-white"><span className="text-accentGreen">⚡</span> {ev.speed} km/h</span>}
              {ev.temperature_c != null && <span className="text-white"><Thermometer className="w-3 h-3 inline text-statusDanger" /> {ev.temperature_c}°C</span>}
              {ev.humidity_pct != null && <span className="text-white"><Droplets className="w-3 h-3 inline text-accentBlue" /> {ev.humidity_pct}%</span>}
            </div>
            <div className="text-white font-bold text-xs mt-0.5 truncate">
              {ev.address ? `📍 ${ev.address}` : 'Sin dirección'}
            </div>
          </>
        ) : (
          <span className="text-white font-bold text-xs italic">— Sin señal</span>
        )}
      </div>

      {/* 8. Alertas */}
      <div className="w-20 shrink-0 text-center">
        {alerts > 0 ? (
          <span className="inline-flex items-center gap-1 bg-statusDanger/20 text-statusDanger border border-statusDanger/30 px-1.5 py-0.5 rounded text-xs font-bold">
            <AlertTriangle className="w-3 h-3" /> {alerts}
          </span>
        ) : (
          <span className="text-textMuted font-bold text-xs">—</span>
        )}
      </div>

      {/* 9. Acciones */}
      <div className="w-32 shrink-0 text-right flex items-center justify-end gap-2">
        <RequirePermission permission="trips:manage">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(trip); }}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-textMuted hover:text-white bg-bgSurfaceHigh hover:bg-bgSurfaceHigh/80 border border-borderDefault px-2 py-1.5 rounded-lg transition-all duration-150"
          >
            Editar
          </button>
        </RequirePermission>
        <Link
          to={`/trips/${trip.id}`}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-accentBlue hover:text-white
            bg-accentBlue/10 hover:bg-accentBlue/20 border border-accentBlue/20 hover:border-accentBlue/40
            px-3 py-1.5 rounded-lg transition-all duration-150"
        >
          Ver <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
};

/* ─────────────── main page ─────────────── */
export const TripsPage: React.FC = () => {
  const { trips, fetchTrips, createTrip, loading } = useTripsStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [carrierFilter, setCarrierFilter] = useState('');
  const [avlFilter, setAvlFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [tripToEdit, setTripToEdit] = useState<Trip | null>(null);

  useEffect(() => {
    fetchTrips();
  }, []);


  // Unique carrier/avl options from loaded trips
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

  const filtered = trips.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.id.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      (t.trip_code ?? '').toLowerCase().includes(q) ||
      (t.vehicle?.plate ?? '').toLowerCase().includes(q);
    const matchStatus = !statusFilter || t.status === statusFilter;
    const matchCarrier = !carrierFilter || (t.vehicle as any)?.carrier_id === carrierFilter;
    const matchAvl = !avlFilter || (t.vehicle as any)?.avl_user_id === avlFilter;
    return matchSearch && matchStatus && matchCarrier && matchAvl;
  });

  const openCreateModal = () => {
    setTripToEdit(null);
    setShowModal(true);
  };

  const handleEditTrip = (t: Trip) => {
    setTripToEdit(t);
    setShowModal(true);
  };

  const statusTabs = [
    { value: '', label: 'Todos', count: trips.length },
    { value: 'EN_CURSO', label: 'En Curso', count: trips.filter((t) => t.status === 'EN_CURSO').length },
    { value: 'PROGRAMADO', label: 'Programado', count: trips.filter((t) => t.status === 'PROGRAMADO').length },
    { value: 'FINALIZADO', label: 'Finalizado', count: trips.filter((t) => t.status === 'FINALIZADO').length },
  ];

  return (
    <div className="p-8 h-full w-full flex flex-col">

      {/* ── Page header ── */}
      <div className="pb-0 flex justify-between items-center shrink-0">
        <h1 className="text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-accentGreen to-accentBlue tracking-wider flex items-center">
          <Truck className="w-8 h-8 mr-3 text-accentGreen" />
          Viajes y Monitoreo
        </h1>
        <RequirePermission permission="trips:manage">
          <button
            onClick={openCreateModal}
            className="bg-accentGreen hover:bg-accentGreen/90 text-bgStart px-4 py-2 rounded font-bold flex items-center shadow-lg shadow-accentGreen/20 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" /> Programar Viaje
          </button>
        </RequirePermission>
      </div>

      {/* ── Sticky filters bar ── */}
      <div className="pt-4 pb-3 shrink-0 bg-bgStart/95 backdrop-blur-sm border-b border-borderDefault/50 z-10">
        <div className="flex flex-wrap items-center gap-3">

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar nombre, código, placa..."
              className="w-full bg-bgSurface border border-borderDefault rounded-lg pl-9 pr-4 py-1.5 text-sm text-textPrimary focus:border-accentGreen focus:outline-none transition-colors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-textMuted hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status tabs */}
          <div className="flex items-center gap-1 bg-bgSurface border border-borderDefault rounded-lg p-1">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                  statusFilter === tab.value
                    ? 'bg-accentGreen text-bgStart shadow'
                    : 'text-textMuted hover:text-white'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 text-[10px] ${statusFilter === tab.value ? 'text-bgStart/70' : 'text-textMuted'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Carrier dropdown */}
          <select
            value={carrierFilter}
            onChange={(e) => setCarrierFilter(e.target.value)}
            className="bg-bgSurface border border-borderDefault rounded-lg px-3 py-1.5 text-xs text-textPrimary focus:border-accentGreen focus:outline-none"
          >
            <option value="">Todos los Transportistas</option>
            {uniqueCarriers.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* AVL dropdown */}
          <select
            value={avlFilter}
            onChange={(e) => setAvlFilter(e.target.value)}
            className="bg-bgSurface border border-borderDefault rounded-lg px-3 py-1.5 text-xs text-textPrimary focus:border-accentGreen focus:outline-none"
          >
            <option value="">Todos los Proveedores GPS</option>
            {uniqueAvl.map((a: any) => (
              <option key={a.id} value={a.id}>{a.provider_name}</option>
            ))}
          </select>

          {(carrierFilter || avlFilter) && (
            <button
              onClick={() => { setCarrierFilter(''); setAvlFilter(''); }}
              className="text-xs text-statusDanger hover:text-red-400 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Limpiar
            </button>
          )}

          <span className="ml-auto text-xs text-textMuted">
            {filtered.length} viaje{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Table Container ── */}
      <div className="flex-1 overflow-auto flex flex-col relative w-full">
        {/* Table Header (Sticky) */}
        <div className="sticky top-0 bg-bgStart/95 backdrop-blur-md border-b border-borderDefault text-white text-[10px] uppercase tracking-wider font-black px-4 py-3 flex items-center min-w-[1100px] w-full z-10 gap-4">
          <div className="w-24 shrink-0">Estado</div>
          <div className="flex-1 min-w-[150px]">Viaje</div>
          <div className="flex-1 min-w-[150px]">Vehículo</div>
          <div className="flex-1 min-w-[150px]">Chofer</div>
          <div className="flex-[1.5] min-w-[200px]">Origen → Destino</div>
          <div className="w-32 shrink-0">Inicio</div>
          <div className="flex-[1.5] min-w-[200px]">Telemetría (Último evento)</div>
          <div className="w-20 shrink-0 text-center">Alertas</div>
          <div className="w-24 shrink-0 text-right">Acciones</div>
        </div>

        {/* Table Body */}
        <div className="flex-1 flex flex-col w-max min-w-full pb-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 w-full absolute left-0">
              <div className="w-8 h-8 border-2 border-accentGreen/30 border-t-accentGreen rounded-full animate-spin" />
              <p className="text-textMuted text-sm">Cargando viajes...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 w-full absolute left-0">
              <Truck className="w-12 h-12 text-textMuted/30" />
              <p className="text-textMuted">No se encontraron viajes con los filtros aplicados.</p>
            </div>
          ) : (
            filtered.map((trip) => <TripRow key={trip.id} trip={trip} onEdit={handleEditTrip} />)
          )}
        </div>
      </div>
      {/* ── Create / Edit trip modal ── */}
      <TripModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        tripToEdit={tripToEdit}
        onSaved={fetchTrips}
      />
    </div>
  );
};
