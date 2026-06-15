import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import { X, CheckCircle, RefreshCw } from 'lucide-react';
import { useTripsStore, type Trip } from '../../store/tripsStore';

interface TripModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripToEdit?: Trip | null;
  onSaved: () => void;
}

export const TripModal: React.FC<TripModalProps> = ({ isOpen, onClose, tripToEdit, onSaved }) => {
  const { createTrip, updateTrip } = useTripsStore();

  const [name, setName] = useState('');
  const [tripCode, setTripCode] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [operationId, setOperationId] = useState('');
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [carrierId, setCarrierId] = useState('');
  const [loadingDeps, setLoadingDeps] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchDependencies();
      if (tripToEdit) {
        setName(tripToEdit.name || '');
        setTripCode(tripToEdit.trip_code || '');
        setVehicleId(tripToEdit.vehicle_id || '');
        setDriverId((tripToEdit as any).driver_id || '');
        setOperationId(tripToEdit.operation_id || '');
        setOriginId(tripToEdit.origin_location_id || '');
        setDestinationId(tripToEdit.destination_location_id || '');
        setRouteId(tripToEdit.route_id || '');
        setCarrierId((tripToEdit as any).carrier_id || (tripToEdit as any).vehicle?.carrier_id || '');
        if (tripToEdit.scheduled_start) {
          const d = new Date(tripToEdit.scheduled_start);
          setScheduledStart(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
        }
        if (tripToEdit.scheduled_end) {
          const d = new Date(tripToEdit.scheduled_end);
          setScheduledEnd(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
        }
      } else {
        resetForm();
      }
    }
  }, [isOpen, tripToEdit]);

  useEffect(() => {
    if (vehicleId && vehicles.length > 0) {
      const v = vehicles.find((vx: any) => vx.id === vehicleId);
      if (v?.carrier_id && v.carrier_id !== carrierId) {
        setCarrierId(v.carrier_id);
      }
    }
  }, [vehicleId, vehicles]);

  const fetchDependencies = async () => {
    setLoadingDeps(true);
    const token = localStorage.getItem('rusertech_token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [vRes, dRes, oRes, lRes, rRes, cRes] = await Promise.all([
        fetch('http://localhost:3000/api/v1/vehicles', { headers }),
        fetch('http://localhost:3000/api/v1/drivers', { headers }),
        fetch('http://localhost:3000/api/v1/operations', { headers }),
        fetch('http://localhost:3000/api/v1/locations', { headers }),
        fetch('http://localhost:3000/api/v1/routes', { headers }),
        fetch('http://localhost:3000/api/v1/carriers', { headers }),
      ]);
      if (vRes.ok) { const d = await vRes.json(); setVehicles(Array.isArray(d) ? d : (d.data || [])); }
      if (dRes.ok) { const d = await dRes.json(); setDrivers(Array.isArray(d) ? d : []); }
      if (oRes.ok) { const d = await oRes.json(); setOperations(Array.isArray(d) ? d : []); }
      if (lRes.ok) { const d = await lRes.json(); setLocations(Array.isArray(d) ? d : []); }
      if (rRes.ok) { const d = await rRes.json(); setRoutes(Array.isArray(d) ? d : []); }
      if (cRes.ok) { const d = await cRes.json(); setCarriers(Array.isArray(d) ? d : (d.data || [])); }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDeps(false);
    }
  };

  const resetForm = () => {
    setName(''); setTripCode(`VJ-${Date.now().toString().slice(-6)}`); setVehicleId(''); setDriverId(''); setOperationId('');
    setOriginId(''); setDestinationId(''); setRouteId(''); setScheduledStart(''); setScheduledEnd(''); setCarrierId('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      name,
      trip_code: tripCode || undefined,
      vehicle_id: vehicleId || undefined,
      carrier_id: carrierId || undefined,
      driver_id: driverId || undefined,
      operation_id: operationId || undefined,
      origin_location_id: originId || undefined,
      destination_location_id: destinationId || undefined,
      route_id: routeId || undefined,
      scheduled_start: scheduledStart ? new Date(scheduledStart).toISOString() : undefined,
      scheduled_end: scheduledEnd ? new Date(scheduledEnd).toISOString() : undefined,
    };
    try {
      if (tripToEdit) {
        await updateTrip(tripToEdit.id, payload);
        
        const changedFields = [];
        
        const vOld = vehicles.find(v => v.id === tripToEdit.vehicle_id)?.plate || 'Ninguno';
        const vNew = vehicles.find(v => v.id === payload.vehicle_id)?.plate || 'Ninguno';
        if (tripToEdit.vehicle_id !== payload.vehicle_id) changedFields.push(`Vehículo (de ${vOld} a ${vNew})`);
        
        const dOld = drivers.find(d => d.id === (tripToEdit as any).driver_id)?.full_name || 'Ninguno';
        const dNew = drivers.find(d => d.id === payload.driver_id)?.full_name || 'Ninguno';
        if ((tripToEdit as any).driver_id !== payload.driver_id) changedFields.push(`Conductor (de ${dOld} a ${dNew})`);
        
        const rOld = routes.find(r => r.id === tripToEdit.route_id)?.name || 'Ninguno';
        const rNew = routes.find(r => r.id === payload.route_id)?.name || 'Ninguno';
        if (tripToEdit.route_id !== payload.route_id) changedFields.push(`Ruta (de ${rOld} a ${rNew})`);
        
        if (tripToEdit.name !== payload.name) changedFields.push(`Nombre (de ${tripToEdit.name} a ${payload.name})`);
        
        if (changedFields.length > 0) {
           await fetch(`http://localhost:3000/api/v1/trips/${tripToEdit.id}/logs`, {
             method: 'POST',
             headers: { 
               'Content-Type': 'application/json',
               Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`
             },
             body: JSON.stringify({ text: `Viaje modificado. Se cambiaron los campos:\n- ${changedFields.join('\n- ')}`, type: 'note' })
           });
        }
      } else {
        await createTrip(payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      alert('Error al guardar el viaje');
    }
  };

  if (!isOpen) return null;

  const inputCls = "w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accentGreen focus:ring-1 focus:ring-accentGreen transition-colors";
  
  const selectStyles = {
    control: (base: any, state: any) => ({ 
      ...base, 
      backgroundColor: '#1F2A5A', 
      borderColor: state.isFocused ? '#7CFF3C' : 'rgba(124,255,60,0.15)', 
      color: '#E5E7EB',
      boxShadow: state.isFocused ? '0 0 0 1px #7CFF3C' : 'none',
      minHeight: '42px',
      borderRadius: '0.5rem',
      '&:hover': { borderColor: '#7CFF3C' }
    }),
    menu: (base: any) => ({ 
      ...base, 
      backgroundColor: '#2E3578', 
      zIndex: 9999,
      border: '1px solid rgba(124,255,60,0.15)',
      borderRadius: '0.5rem',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      marginTop: '4px'
    }),
    option: (base: any, state: any) => ({ 
      ...base, 
      backgroundColor: state.isSelected ? '#7CFF3C' : state.isFocused ? '#252D6B' : 'transparent', 
      color: state.isSelected ? '#1F2A5A' : '#E5E7EB',
      cursor: 'pointer',
      fontWeight: state.isSelected ? 'bold' : 'normal',
      '&:active': { backgroundColor: '#7CFF3C', color: '#1F2A5A' }
    }),
    singleValue: (base: any) => ({ ...base, color: '#E5E7EB' }),
    input: (base: any) => ({ ...base, color: '#E5E7EB' }),
    placeholder: (base: any) => ({ ...base, color: '#6B7280' }),
    indicatorSeparator: () => ({ display: 'none' }),
    dropdownIndicator: (base: any) => ({ ...base, color: '#9CA3AF', padding: '4px', '&:hover': { color: '#E5E7EB' } }),
    clearIndicator: (base: any) => ({ ...base, color: '#9CA3AF', padding: '4px', '&:hover': { color: '#EF4444' } })
  };

  return (
    <div className="fixed inset-0 bg-bgOverlay z-50 flex items-center justify-center p-4">
      <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-2xl shadow-card flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="p-6 border-b border-borderDefault shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{tripToEdit ? 'Editar Viaje' : 'Programar Nuevo Viaje'}</h2>
            {tripToEdit && <p className="text-xs text-textMuted font-mono mt-1">ID: {tripToEdit.id}</p>}
          </div>
          <button onClick={onClose} className="text-textMuted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 overflow-y-auto flex-1 space-y-5">
            {loadingDeps && <p className="text-sm text-textMuted">Cargando dependencias...</p>}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-textSecondary mb-1">Nombre del Viaje *</label>
                <input required type="text" placeholder="Ej: Viaje a Rosario" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-textSecondary mb-1">Código de Viaje (Opcional)</label>
                <div className="flex gap-2">
                  <input type="text" placeholder="Ej: VJ-2023-001" className={`${inputCls} font-mono`} value={tripCode} onChange={(e) => setTripCode(e.target.value)} />
                  <button type="button" onClick={() => setTripCode(`VJ-${Date.now().toString().slice(-6)}`)} className="bg-bgSurfaceHigh border border-borderDefault text-textSecondary hover:text-white px-3 rounded-lg flex items-center justify-center transition-colors" title="Generar código automático">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-textSecondary mb-1">Operación (Opcional)</label>
                <Select
                  styles={selectStyles}
                  placeholder="— Buscar Operación —"
                  isClearable
                  options={operations.map(o => ({ value: o.id, label: o.name }))}
                  value={operationId ? { value: operationId, label: operations.find(o => o.id === operationId)?.name } : null}
                  onChange={(val) => setOperationId(val ? val.value : '')}
                />
              </div>
              <div>
                <label className="block text-sm text-textSecondary mb-1">Transportista</label>
                <Select
                  styles={selectStyles}
                  placeholder="— Todos los transportistas —"
                  isClearable
                  options={carriers.map(c => ({ value: c.id, label: c.name }))}
                  value={carrierId ? { value: carrierId, label: carriers.find(c => c.id === carrierId)?.name } : null}
                  onChange={(val) => setCarrierId(val ? val.value : '')}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-borderDefault pt-4">
              <div>
                <label className="block text-sm text-textSecondary mb-1">Vehículo Asignado *</label>
                <Select
                  styles={selectStyles}
                  placeholder="— Buscar Vehículo —"
                  isClearable
                  required
                  options={vehicles.filter(v => !carrierId || v.carrier_id === carrierId).map(v => ({ value: v.id, label: `${v.plate} ${v.alias ? `(${v.alias})` : ''}` }))}
                  value={vehicleId ? { value: vehicleId, label: `${vehicles.find(v => v.id === vehicleId)?.plate} ${vehicles.find(v => v.id === vehicleId)?.alias ? `(${vehicles.find(v => v.id === vehicleId)?.alias})` : ''}` } : null}
                  onChange={(val) => setVehicleId(val ? val.value : '')}
                />
              </div>
              <div>
                <label className="block text-sm text-textSecondary mb-1">Chofer Asignado (Opcional)</label>
                <Select
                  styles={selectStyles}
                  placeholder="— Buscar Chofer —"
                  isClearable
                  options={drivers.map(d => ({ value: d.id, label: `${d.full_name} (${d.document})` }))}
                  value={driverId ? { value: driverId, label: `${drivers.find(d => d.id === driverId)?.full_name} (${drivers.find(d => d.id === driverId)?.document})` } : null}
                  onChange={(val) => setDriverId(val ? val.value : '')}
                />
              </div>
            </div>

            <div className="border-t border-borderDefault pt-4">
              <h3 className="text-sm font-bold text-accentGreen uppercase tracking-wider mb-3">Geografía y Control</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-textSecondary mb-1">Origen (Opcional)</label>
                  <Select
                    styles={selectStyles}
                    placeholder="— Buscar Origen —"
                    isClearable
                    options={locations.filter((l) => !operationId || l.operation_id === operationId).map(l => ({ value: l.id, label: l.name }))}
                    value={originId ? { value: originId, label: locations.find(l => l.id === originId)?.name } : null}
                    onChange={(val) => setOriginId(val ? val.value : '')}
                  />
                </div>
                <div>
                  <label className="block text-sm text-textSecondary mb-1">Destino (Opcional)</label>
                  <Select
                    styles={selectStyles}
                    placeholder="— Buscar Destino —"
                    isClearable
                    options={locations.filter((l) => !operationId || l.operation_id === operationId).map(l => ({ value: l.id, label: l.name }))}
                    value={destinationId ? { value: destinationId, label: locations.find(l => l.id === destinationId)?.name } : null}
                    onChange={(val) => setDestinationId(val ? val.value : '')}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-textSecondary mb-1">Corredor / Ruta Asignada (Opcional)</label>
                <Select
                  styles={selectStyles}
                  placeholder="— Buscar Corredor / Ruta —"
                  isClearable
                  options={routes.filter((r) => !operationId || r.operation_id === operationId).map(r => ({ value: r.id, label: r.name }))}
                  value={routeId ? { value: routeId, label: routes.find(r => r.id === routeId)?.name } : null}
                  onChange={(val) => setRouteId(val ? val.value : '')}
                />
              </div>
            </div>

            <div className="border-t border-borderDefault pt-4">
              <h3 className="text-sm font-bold text-accentGreen uppercase tracking-wider mb-3">Programación Horaria</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-textSecondary mb-1">Inicio Programado *</label>
                  <input required type="datetime-local" className={inputCls} value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm text-textSecondary mb-1">Fin Programado Estimado</label>
                  <input type="datetime-local" className={inputCls} value={scheduledEnd} onChange={(e) => setScheduledEnd(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-borderDefault flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded text-textSecondary hover:text-white transition-colors">
              Cancelar
            </button>
            <button type="submit" className="px-6 py-2 bg-accentGreen text-bgStart font-bold rounded hover:bg-accentGreen/90 transition-colors flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" /> {tripToEdit ? 'Guardar Cambios' : 'Guardar Viaje'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
