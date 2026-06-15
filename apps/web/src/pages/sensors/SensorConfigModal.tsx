import React, { useState, useEffect } from 'react';
import { X, Settings, Thermometer, Droplets } from 'lucide-react';

interface Props {
  vehicleId: string;
  onClose: () => void;
}

export const SensorConfigModal: React.FC<Props> = ({ vehicleId, onClose }) => {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states for Temperature
  const [tempMin, setTempMin] = useState<number | ''>('');
  const [tempMax, setTempMax] = useState<number | ''>(8);
  const [tempActive, setTempActive] = useState(true);

  // Form states for Humidity
  const [humMin, setHumMin] = useState<number | ''>('');
  const [humMax, setHumMax] = useState<number | ''>(60);
  const [humActive, setHumActive] = useState(true);

  useEffect(() => {
    loadConfigs();
  }, [vehicleId]);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/api/v1/sensors/config`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        // filter by vehicleId
        const vehicleConfigs = data.filter((c: any) => c.vehicle_id === vehicleId);
        setConfigs(vehicleConfigs);
        
        const tc = vehicleConfigs.find((c: any) => c.sensor_type === 'temperature');
        if (tc) {
          setTempMin(tc.min_value ?? '');
          setTempMax(tc.max_value ?? '');
          setTempActive(tc.is_active);
        }
        
        const hc = vehicleConfigs.find((c: any) => c.sensor_type === 'humidity');
        if (hc) {
          setHumMin(hc.min_value ?? '');
          setHumMax(hc.max_value ?? '');
          setHumActive(hc.is_active);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    try {
      // Save temperature
      await fetch(`http://localhost:3000/api/v1/sensors/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`
        },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          sensor_type: 'temperature',
          min_value: tempMin === '' ? null : Number(tempMin),
          max_value: tempMax === '' ? null : Number(tempMax),
          is_active: tempActive
        })
      });

      // Save humidity
      await fetch(`http://localhost:3000/api/v1/sensors/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`
        },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          sensor_type: 'humidity',
          min_value: humMin === '' ? null : Number(humMin),
          max_value: humMax === '' ? null : Number(humMax),
          is_active: humActive
        })
      });

      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-bgOverlay z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-lg shadow-card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-borderDefault flex justify-between items-center bg-bgStart/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="text-accentBlue" />
            Configurar Alertas de Sensores
          </h2>
          <button onClick={onClose} className="text-textMuted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-textMuted">Cargando...</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Temperatura */}
            <div className="bg-bgStart border border-borderDefault rounded-lg p-4">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-borderDefault">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-statusWarning" /> Temperatura (°C)
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-textMuted">Activo</span>
                  <input type="checkbox" checked={tempActive} onChange={e => setTempActive(e.target.checked)} className="accent-accentBlue" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-textSecondary mb-1">Mínimo</label>
                  <input 
                    type="number" 
                    value={tempMin} 
                    onChange={e => setTempMin(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-bgSurface border border-borderDefault rounded px-3 py-2 text-white focus:outline-none focus:border-accentBlue"
                    placeholder="Ej: -5"
                  />
                </div>
                <div>
                  <label className="block text-xs text-textSecondary mb-1">Máximo</label>
                  <input 
                    type="number" 
                    value={tempMax} 
                    onChange={e => setTempMax(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-bgSurface border border-borderDefault rounded px-3 py-2 text-white focus:outline-none focus:border-accentBlue"
                    placeholder="Ej: 8"
                  />
                </div>
              </div>
            </div>

            {/* Humedad */}
            <div className="bg-bgStart border border-borderDefault rounded-lg p-4">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-borderDefault">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-accentBlue" /> Humedad (%)
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-textMuted">Activo</span>
                  <input type="checkbox" checked={humActive} onChange={e => setHumActive(e.target.checked)} className="accent-accentBlue" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-textSecondary mb-1">Mínimo</label>
                  <input 
                    type="number" 
                    value={humMin} 
                    onChange={e => setHumMin(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-bgSurface border border-borderDefault rounded px-3 py-2 text-white focus:outline-none focus:border-accentBlue"
                    placeholder="Ej: 0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-textSecondary mb-1">Máximo</label>
                  <input 
                    type="number" 
                    value={humMax} 
                    onChange={e => setHumMax(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-bgSurface border border-borderDefault rounded px-3 py-2 text-white focus:outline-none focus:border-accentBlue"
                    placeholder="Ej: 60"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-borderDefault bg-bgStart/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded text-sm text-textMuted hover:text-white transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-accentBlue text-bgStart font-bold rounded text-sm hover:opacity-90 transition-opacity">
            Guardar Rangos
          </button>
        </div>
      </div>
    </div>
  );
};
