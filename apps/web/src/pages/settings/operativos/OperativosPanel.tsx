import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Save, AlertCircle } from 'lucide-react';
import { useOperativosSettings, useUpdateOperativosSettings } from './api';
import type { OperativosSettings } from './types';
import { useToastStore } from '../../../store/toastStore';
import { RequirePermission } from '../../../components/RequirePermission';
import i18n from '../../../i18n/config';
import esLocales from './locales/es.json';
import enLocales from './locales/en.json';

i18n.addResourceBundle('es', 'translation', { settingsOperativos: esLocales }, true, true);
i18n.addResourceBundle('en', 'translation', { settingsOperativos: enLocales }, true, true);

export const OperativosPanel: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const { data: initialData, isLoading, error } = useOperativosSettings();
  const updateMutation = useUpdateOperativosSettings();

  const [formData, setFormData] = useState<OperativosSettings>({
    vehicle_moving_min_speed_kmh: 5,
    location_default_radius_meters: 100,
    destination_arrival_proximity_km: 10,
    broken_loop_threshold_minutes: 6,
    provider_ok_threshold_minutes: 15
  });

  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setIsDirty(false);
      setValidationErrors({});
    }
  }, [initialData]);

  // Dirty guard warning on unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleChange = (key: keyof OperativosSettings, value: string) => {
    const numValue = parseInt(value, 10);
    setFormData(prev => ({ ...prev, [key]: isNaN(numValue) ? 0 : numValue }));
    setIsDirty(true);
    
    // Validate inline
    const errors = { ...validationErrors };
    if (isNaN(numValue) || numValue <= 0) {
      errors[key] = t('settingsOperativos.validation.positive');
    } else if (key === 'vehicle_moving_min_speed_kmh' && numValue > 200) {
      errors[key] = t('settingsOperativos.validation.max_speed');
    } else if (key === 'location_default_radius_meters' && numValue > 5000) {
      errors[key] = t('settingsOperativos.validation.max_radius');
    } else {
      delete errors[key];
    }
    setValidationErrors(errors);
  };

  const handleSave = async () => {
    if (Object.keys(validationErrors).length > 0) return;
    try {
      await updateMutation.mutateAsync(formData);
      addToast(t('settingsOperativos.toasts.success'), 'success');
      setIsDirty(false);
    } catch (err: any) {
      addToast(t('settingsOperativos.toasts.error'), 'error');
    }
  };

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-center">
        Error al cargar los datos. Reintente más tarde.
      </div>
    );
  }

  const fields: { key: keyof OperativosSettings; labelPath: string; tooltipPath: string }[] = [
    { key: 'vehicle_moving_min_speed_kmh', labelPath: 'speed', tooltipPath: 'speed' },
    { key: 'location_default_radius_meters', labelPath: 'radius', tooltipPath: 'radius' },
    { key: 'destination_arrival_proximity_km', labelPath: 'proximity', tooltipPath: 'proximity' },
    { key: 'broken_loop_threshold_minutes', labelPath: 'broken_loop', tooltipPath: 'broken_loop' },
    { key: 'provider_ok_threshold_minutes', labelPath: 'provider_ok', tooltipPath: 'provider_ok' }
  ];

  return (
    <RequirePermission permission="manage_settings">
      <div className="max-w-4xl space-y-6">
        <div className="bg-[#1A2346] p-6 rounded-xl border border-[#2D3B6A] shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-7 h-7 text-green-400" />
            <h2 className="text-xl font-bold text-white tracking-wide">{t('settingsOperativos.title')}</h2>
          </div>
          <p className="text-gray-400 text-sm mb-8">{t('settingsOperativos.subtitle')}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fields.map(field => (
              <div key={field.key} className="relative group">
                <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center justify-between">
                  {t(`settingsOperativos.fields.${field.labelPath}.label`)}
                  <div className="cursor-help text-gray-500 hover:text-green-400 transition-colors">
                    <AlertCircle className="w-4 h-4" />
                    <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-[#0B1120] border border-[#2D3B6A] rounded-lg shadow-xl text-xs text-gray-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 font-normal normal-case text-left">
                      {t(`settingsOperativos.fields.${field.tooltipPath}.tooltip`)}
                      <div className="absolute top-full right-2 border-4 border-transparent border-t-[#2D3B6A]"></div>
                    </div>
                  </div>
                </label>
                {isLoading ? (
                  <div className="h-11 bg-[#2D3B6A] rounded-lg animate-pulse w-full"></div>
                ) : (
                  <input
                    type="number"
                    min="1"
                    className={`w-full bg-[#151B36] border ${validationErrors[field.key] ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : 'border-[#2D3B6A] focus:border-green-500 focus:ring-green-500/20'} rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 transition-colors font-mono text-lg`}
                    value={formData[field.key] || ''}
                    onChange={e => handleChange(field.key, e.target.value)}
                  />
                )}
                {validationErrors[field.key] && (
                  <p className="text-red-400 text-xs mt-1 absolute -bottom-5 left-0">{validationErrors[field.key]}</p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-10 pt-6 border-t border-[#2D3B6A] flex justify-end">
            <button
              onClick={handleSave}
              disabled={!isDirty || Object.keys(validationErrors).length > 0 || updateMutation.isPending}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg ${
                !isDirty 
                  ? 'bg-[#2D3B6A] text-gray-400 cursor-not-allowed shadow-none' 
                  : 'bg-green-500 hover:bg-green-400 text-[#0B1120] shadow-green-500/20 hover:shadow-green-400/40'
              }`}
            >
              {updateMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {t('settingsOperativos.save')}
            </button>
          </div>
        </div>
      </div>
    </RequirePermission>
  );
};
