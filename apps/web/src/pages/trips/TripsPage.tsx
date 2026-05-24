import React, { useEffect, useState } from 'react';
import { useTripsStore, type Trip } from '../../store/tripsStore';
import { Map, Plus, Search, Calendar, MapPin, Truck, ChevronRight, Play, CheckCircle } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';
import { Link } from 'react-router-dom';

export const TripsPage: React.FC = () => {
  const { trips, fetchTrips, createTrip, updateTrip, deleteTrip, loading } = useTripsStore();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  
  // Data for selectors
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);

  // Form State
  const [name, setName] = useState('');
  const [tripCode, setTripCode] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [operationId, setOperationId] = useState('');
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');

  useEffect(() => {
    fetchTrips();
    fetchDependencies();
  }, []);

  const fetchDependencies = async () => {
    const token = localStorage.getItem('rusertech_token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [vRes, oRes, lRes, rRes] = await Promise.all([
        fetch('http://localhost:3000/api/v1/vehicles', { headers }),
        fetch('http://localhost:3000/api/v1/operations', { headers }),
        fetch('http://localhost:3000/api/v1/locations', { headers }),
        fetch('http://localhost:3000/api/v1/routes', { headers }),
      ]);
      if (vRes.ok) { const d = await vRes.json(); setVehicles(Array.isArray(d) ? d : (d.data || [])); }
      if (oRes.ok) { const d = await oRes.json(); setOperations(Array.isArray(d) ? d : []); }
      if (lRes.ok) { const d = await lRes.json(); setLocations(Array.isArray(d) ? d : []); }
      if (rRes.ok) { const d = await rRes.json(); setRoutes(Array.isArray(d) ? d : []); }
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = trips.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    (t.trip_code && t.trip_code.toLowerCase().includes(search.toLowerCase())) ||
    (t.vehicle?.plate.toLowerCase().includes(search.toLowerCase()))
  );

  const resetForm = () => {
    setName('');
    setTripCode('');
    setVehicleId('');
    setOperationId('');
    setOriginId('');
    setDestinationId('');
    setRouteId('');
    
    // Set default date to now and 24 hours from now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setScheduledStart(now.toISOString().slice(0, 16));
    
    const tomorrow = new Date(now);
    tomorrow.setHours(tomorrow.getHours() + 24);
    setScheduledEnd(tomorrow.toISOString().slice(0, 16));
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTrip({
      name,
      trip_code: tripCode || null,
      vehicle_id: vehicleId,
      operation_id: operationId || null,
      origin_location_id: originId || null,
      destination_location_id: destinationId || null,
      route_id: routeId || null,
      scheduled_start: new Date(scheduledStart).toISOString(),
      scheduled_end: scheduledEnd ? new Date(scheduledEnd).toISOString() : null,
      status: 'PROGRAMADO'
    });
    setShowModal(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PROGRAMADO': return 'bg-accentBlue/20 text-accentBlue border-accentBlue/30';
      case 'EN_CURSO': return 'bg-accentGreen/20 text-accentGreen border-accentGreen/30';
      case 'FINALIZADO': return 'bg-textMuted/20 text-textMuted border-textMuted/30';
      case 'CANCELADO': return 'bg-statusDanger/20 text-statusDanger border-statusDanger/30';
      default: return 'bg-bgSurfaceHigh text-textSecondary border-borderDefault';
    }
  };

  return (
    <div className="p-8 h-[calc(100vh-4rem)] max-w-7xl mx-auto flex flex-col">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <h1 className="text-3xl font-display font-bold text-white flex items-center">
          <Map className="w-8 h-8 mr-3 text-accentGreen" />
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

      <div className="bg-bgSurface border border-borderDefault rounded-xl overflow-hidden shadow-card flex flex-col flex-1 min-h-0">
        <div className="p-4 border-b border-borderDefault flex justify-between items-center bg-bgStart/50 shrink-0">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, código o patente..."
              className="w-full bg-bgStart border border-borderDefault rounded-lg pl-10 pr-4 py-2 text-textPrimary focus:border-accentGreen focus:outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center text-textMuted">Cargando viajes...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-textMuted">No se encontraron viajes.</div>
          ) : (
            <table className="w-full text-left text-sm text-textSecondary">
              <thead className="bg-bgStart/60 border-b border-borderDefault text-textMuted uppercase sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-medium">Viaje</th>
                  <th className="px-6 py-4 font-medium">Logística</th>
                  <th className="px-6 py-4 font-medium">Programación</th>
                  <th className="px-6 py-4 font-medium">Estado</th>
                  <th className="px-6 py-4 font-medium text-right">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderDefault">
                {filtered.map(trip => (
                  <tr key={trip.id} className="hover:bg-bgSurfaceHigh/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white text-base">{trip.name}</div>
                      <div className="text-textMuted mt-1 flex items-center gap-2">
                        <span className="font-mono bg-bgStart px-1.5 py-0.5 rounded border border-borderDefault text-xs">
                          {trip.trip_code || 'SIN_CODIGO'}
                        </span>
                        {trip.operation && (
                          <span className="text-accentMint/80 text-xs flex items-center">
                            👤 {trip.operation.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-white font-medium mb-1">
                        <Truck className="w-4 h-4 text-accentGreen" />
                        {trip.vehicle?.plate || 'Vehículo Borrado'}
                      </div>
                      <div className="text-xs text-textMuted flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate max-w-[100px]" title={trip.origin_location?.name}>{trip.origin_location?.name || 'Indefinido'}</span>
                        <span className="text-accentBlue mx-1">→</span>
                        <span className="truncate max-w-[100px]" title={trip.destination_location?.name}>{trip.destination_location?.name || 'Indefinido'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-textSecondary">
                        <Calendar className="w-4 h-4 text-textMuted" />
                        <span>{new Date(trip.scheduled_start).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                      {trip.scheduled_end && (
                        <div className="text-xs text-textMuted ml-6 mt-0.5">
                          hasta {new Date(trip.scheduled_end).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(trip.status)}`}>
                        {trip.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/trips/${trip.id}`}
                        className="inline-flex items-center justify-center p-2 rounded bg-bgStart border border-borderDefault hover:border-accentGreen hover:text-accentGreen transition-colors"
                        title="Ver seguimiento"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-bgOverlay z-50 flex items-center justify-center p-4">
          <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-2xl shadow-card flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="p-6 border-b border-borderDefault shrink-0">
              <h2 className="text-2xl font-bold text-white">Programar Nuevo Viaje</h2>
            </div>
            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 overflow-y-auto flex-1 space-y-5">
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-textSecondary mb-1">Nombre del Viaje *</label>
                    <input required type="text" placeholder="Ej: Viaje a Rosario" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={name} onChange={e => setName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm text-textSecondary mb-1">Código de Viaje (Opcional)</label>
                    <input type="text" placeholder="Ej: VJ-2023-001" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white font-mono focus:border-accentGreen focus:outline-none" value={tripCode} onChange={e => setTripCode(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-textSecondary mb-1">Vehículo *</label>
                  <select required className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white font-bold focus:border-accentGreen focus:outline-none" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
                    <option value="">— Seleccionar Vehículo —</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.plate} {v.alias ? `(${v.alias})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="border-t border-borderDefault pt-4">
                  <h3 className="text-sm font-bold text-accentGreen uppercase tracking-wider mb-3">Logística</h3>
                  
                  <div className="mb-3">
                    <label className="block text-sm text-textSecondary mb-1">Cliente / Operación</label>
                    <select className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={operationId} onChange={e => setOperationId(e.target.value)}>
                      <option value="">— Ninguno (Interno) —</option>
                      {operations.map(op => (
                        <option key={op.id} value={op.id}>{op.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-sm text-textSecondary mb-1">Origen</label>
                      <select className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={originId} onChange={e => setOriginId(e.target.value)}>
                        <option value="">— Indefinido —</option>
                        {locations.filter(l => !operationId || l.operation_id === operationId).map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-textSecondary mb-1">Destino</label>
                      <select className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={destinationId} onChange={e => setDestinationId(e.target.value)}>
                        <option value="">— Indefinido —</option>
                        {locations.filter(l => !operationId || l.operation_id === operationId).map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-textSecondary mb-1">Corredor / Ruta (Opcional)</label>
                    <select className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={routeId} onChange={e => setRouteId(e.target.value)}>
                      <option value="">— Sin Control de Desvío —</option>
                      {routes.filter(r => !operationId || r.operation_id === operationId).map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-textMuted mt-1">Si se asigna una ruta, el sistema generará alertas de desvío al salir del corredor.</p>
                  </div>
                </div>

                <div className="border-t border-borderDefault pt-4">
                  <h3 className="text-sm font-bold text-accentGreen uppercase tracking-wider mb-3">Programación Horaria</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-textSecondary mb-1">Inicio Programado *</label>
                      <input required type="datetime-local" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={scheduledStart} onChange={e => setScheduledStart(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm text-textSecondary mb-1">Fin Programado Estimado</label>
                      <input type="datetime-local" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={scheduledEnd} onChange={e => setScheduledEnd(e.target.value)} />
                    </div>
                  </div>
                </div>

              </div>
              <div className="p-6 border-t border-borderDefault flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded text-textSecondary hover:text-white transition-colors">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-accentGreen text-bgStart font-bold rounded hover:bg-accentGreen/90 transition-colors flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" /> Guardar Viaje
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
