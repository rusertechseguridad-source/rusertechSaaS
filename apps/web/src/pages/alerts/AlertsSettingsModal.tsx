import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Save } from 'lucide-react';

interface AlertsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: any;
  onSave: (settings: any) => Promise<void>;
}

export const EVENT_TYPES = [
  { id: 'SPEED_VIOLATION', label: 'EXCESO DE VELOCIDAD' },
  { id: 'HARSH_ACCELERATION', label: 'ACELERACIÓN BRUSCA' },
  { id: 'HARSH_BRAKING', label: 'FRENADA BRUSCA' },
  { id: 'HARSH_CORNERING', label: 'GIRO BRUSCO' },
  { id: 'JAMMING', label: 'INTERFERENCIA DE SEÑAL' },
  { id: 'POWER_CUT', label: 'CORTE DE CORRIENTE' },
  { id: 'TEMPERATURE_HIGH', label: 'TEMPERATURA ALTA' },
  { id: 'TEMPERATURE_LOW', label: 'TEMPERATURA BAJA' },
  { id: 'GEOFENCE_ENTER', label: 'ENTRADA A GEOFENCE' },
  { id: 'GEOFENCE_EXIT', label: 'SALIDA DE GEOFENCE' },
  { id: 'POSITION', label: 'POSICIÓN' },
];

export const SEVERITY_LEVELS = [
  { id: 'none', label: 'Sin Riesgo', colorClass: 'border-green-500 text-green-500 bg-green-500/10' },
  { id: 'low', label: 'Bajo', colorClass: 'border-blue-500 text-blue-500 bg-blue-500/10' },
  { id: 'medium', label: 'Medio', colorClass: 'border-orange-500 text-orange-500 bg-orange-500/10' },
  { id: 'high', label: 'Alto', colorClass: 'border-red-500 text-red-500 bg-red-500/10' },
  { id: 'critical', label: 'Crítico', colorClass: 'border-slate-800 text-white bg-black' },
];

const AlertsSettingsModal: React.FC<AlertsSettingsModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onSave
}) => {
  const [colors, setColors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setColors(currentSettings?.alert_colors || {});
    }
  }, [isOpen, currentSettings]);

  if (!isOpen) return null;

  const handleColorChange = (eventId: string, severityId: string) => {
    setColors(prev => ({
      ...prev,
      [eventId]: severityId
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ alert_colors: colors });
      onClose();
    } catch (err) {
      console.error(err);
      alert('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-bgOverlay z-[100] flex items-center justify-center p-4">
      <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-2xl shadow-card overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-5 border-b border-borderDefault bg-bgStart flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-accentBlue" />
              Configuración de Alertas
            </h2>
            <p className="text-textMuted text-xs mt-1">Configura la criticidad visual para todo el Tenant</p>
          </div>
          <button onClick={onClose} className="text-textMuted hover:text-white transition-colors bg-bgSurface p-2 rounded-lg border border-borderDefault">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm text-textSecondary mb-6">
            Selecciona el nivel de severidad para cada evento. Esto cambiará el color con el que tú y todos tus sub-usuarios ven las alertas en el panel principal.
          </p>
          
          <div className="space-y-4">
            {EVENT_TYPES.map(event => {
              // Default mapped values before user customizes
              let defaultSeverity = 'medium';
              if (['SPEED_VIOLATION', 'HARSH_BRAKING', 'JAMMING', 'POWER_CUT'].includes(event.id)) defaultSeverity = 'high';
              if (['GEOFENCE_ENTER', 'GEOFENCE_EXIT'].includes(event.id)) defaultSeverity = 'low';
              if (event.id === 'POSITION') defaultSeverity = 'none';

              const currentSeverity = colors[event.id] || defaultSeverity;
              
              return (
                <div key={event.id} className="flex items-center justify-between p-3 bg-bgStart/50 border border-borderDefault/50 rounded-lg">
                  <span className="font-bold text-sm text-white">{event.label}</span>
                  
                  <div className="flex gap-2">
                    {SEVERITY_LEVELS.map(level => {
                      const isSelected = currentSeverity === level.id;
                      return (
                        <button
                          key={level.id}
                          onClick={() => handleColorChange(event.id, level.id)}
                          className={`px-3 py-1.5 rounded text-[10px] font-bold tracking-wider transition-all border ${
                            isSelected 
                              ? level.colorClass + ' ring-2 ring-white/20 scale-105'
                              : 'border-borderDefault text-textMuted hover:bg-bgSurfaceHigh bg-bgSurface'
                          }`}
                          title={level.label}
                        >
                          {level.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-borderDefault bg-bgStart flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded text-sm font-bold text-textSecondary hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 rounded text-sm font-bold bg-accentBlue text-white hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {saving ? 'Guardando...' : (
              <>
                <Save className="w-4 h-4" /> Guardar Cambios
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertsSettingsModal;
