import React, { useState, useEffect } from 'react';
import { X, Search, Link as LinkIcon, Truck } from 'lucide-react';
import { useTripsStore } from '../../store/tripsStore';
import { API_URL } from '../../services/api';

interface LinkVehicleModalProps {
  tripId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const LinkVehicleModal: React.FC<LinkVehicleModalProps> = ({ tripId, onClose, onSuccess }) => {
  const { linkVehicle } = useTripsStore();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [linkType, setLinkType] = useState('support');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/vehicles`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` },
      });
      if (res.ok) {
        setVehicles(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const filteredVehicles = vehicles.filter(v => 
    v.plate?.toLowerCase().includes(search.toLowerCase()) || 
    v.alias?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) {
      setError('Debe seleccionar un vehículo');
      return;
    }
    setSubmitting(true);
    setError('');
    
    try {
      await linkVehicle(tripId, {
        vehicle_id: selectedVehicle,
        link_type: linkType,
        notes
      });
      onSuccess();
    } catch (e: any) {
      setError(e.message || 'Error al enlazar el vehículo');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-bgSurface border border-borderDefault rounded-xl shadow-card w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-borderDefault">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-accentBlue" /> Enlazar Vehículo
          </h2>
          <button onClick={onClose} className="text-textMuted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          {error && (
            <div className="bg-statusDanger/20 border border-statusDanger/50 text-white p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-white/90 uppercase tracking-wider mb-2">
              Buscar Vehículo
            </label>
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" />
              <input
                type="text"
                placeholder="Buscar por patente o alias..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-bgStart border border-borderDefault rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-accentBlue"
              />
            </div>
            
            <div className="bg-bgStart border border-borderDefault rounded-lg max-h-48 overflow-y-auto p-1 space-y-1">
              {loading ? (
                <div className="p-4 text-center text-textMuted text-sm">Cargando vehículos...</div>
              ) : filteredVehicles.length === 0 ? (
                <div className="p-4 text-center text-textMuted text-sm">No se encontraron vehículos</div>
              ) : (
                filteredVehicles.map(v => (
                  <div 
                    key={v.id}
                    onClick={() => setSelectedVehicle(v.id)}
                    className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${selectedVehicle === v.id ? 'bg-accentBlue/20 border border-accentBlue/40' : 'hover:bg-bgSurfaceHigh border border-transparent'}`}
                  >
                    <div className={`p-1.5 rounded-md ${selectedVehicle === v.id ? 'bg-accentBlue/30 text-accentBlue' : 'bg-bgSurface text-textMuted'}`}>
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className={`text-sm font-bold ${selectedVehicle === v.id ? 'text-white' : 'text-textPrimary'}`}>{v.plate}</div>
                      {v.alias && <div className="text-[10px] text-textMuted">{v.alias}</div>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-white/90 uppercase tracking-wider mb-2">
              Tipo de Enlace
            </label>
            <select
              value={linkType}
              onChange={e => setLinkType(e.target.value)}
              className="w-full bg-bgStart border border-borderDefault rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accentBlue"
            >
              <option value="support">Vehículo de Apoyo / Custodia</option>
              <option value="convoy">Parte de Convoy</option>
              <option value="info">Información Secundaria</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-white/90 uppercase tracking-wider mb-2">
              Notas (Opcional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Detalles sobre el enlace..."
              className="w-full bg-bgStart border border-borderDefault rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accentBlue min-h-[60px]"
            />
          </div>

          <div className="flex justify-end gap-3 mt-2 border-t border-borderDefault pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-textMuted hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedVehicle}
              className="bg-accentBlue hover:bg-accentBlue/80 text-black px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-[0_0_15px_rgba(42,179,255,0.4)]"
            >
              {submitting ? 'Enlazando...' : 'Enlazar Vehículo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
