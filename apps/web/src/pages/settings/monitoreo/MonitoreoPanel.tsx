import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Radar, Save, AlertCircle, Info } from 'lucide-react';
import { useMonitoreoSettings, useUpdateMonitoreoSettings } from './api';
import type { MonitoreoSettings } from './types';
import { LIMITES_MONITOREO, MONITOREO_POR_DEFECTO } from './types';
import { useToastStore } from '../../../store/toastStore';
import { RequirePermission, SinPermiso } from '../../../components/RequirePermission';
import i18n from '../../../i18n/config';
import esLocales from './locales/es.json';
import enLocales from './locales/en.json';

i18n.addResourceBundle('es', 'translation', { settingsMonitoreo: esLocales }, true, true);
i18n.addResourceBundle('en', 'translation', { settingsMonitoreo: enLocales }, true, true);

/**
 * PANEL DE MONITOREO — umbrales de frescura y ventana del mapa.
 *
 * Por qué es configurable y no una constante: un reparto urbano reporta cada
 * pocos minutos y una unidad de larga distancia puede pasar media hora sin
 * señal por zona sin cobertura. Con un umbral único, uno de los dos casos vive
 * permanentemente en alerta y el color deja de significar algo.
 *
 * Los mismos colores que usa el mapa se repiten acá a propósito: el operador
 * tiene que poder relacionar lo que configura con lo que después ve.
 */

/** Colores de frescura, espejo de `FRESCURA_COLORS` en MapPage. */
const COLOR_EN_VIVO = '#2BF4B6';
const COLOR_INACTIVO = '#F59E0B';
const COLOR_SIN_SENAL = '#6B7280';
const COLOR_FUERA_DE_MAPA = '#4B5563';

type CampoMonitoreo = keyof MonitoreoSettings;

const CAMPOS: { key: CampoMonitoreo; i18n: string; color: string }[] = [
  { key: 'umbral_en_vivo_minutos', i18n: 'en_vivo', color: COLOR_EN_VIVO },
  { key: 'umbral_inactivo_minutos', i18n: 'inactivo', color: COLOR_INACTIVO },
  { key: 'ventana_mapa_horas', i18n: 'ventana', color: COLOR_FUERA_DE_MAPA },
];

export const MonitoreoPanel: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const { data: inicial, isLoading, error } = useMonitoreoSettings();
  const guardar = useUpdateMonitoreoSettings();

  const [formData, setFormData] = useState<MonitoreoSettings>(MONITOREO_POR_DEFECTO);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!inicial) return;
    setFormData(inicial);
    setIsDirty(false);
  }, [inicial]);

  // Aviso al cerrar con cambios sin guardar: cambiar estos umbrales sin querer
  // altera lo que ve toda la operación.
  useEffect(() => {
    const alSalir = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', alSalir);
    return () => window.removeEventListener('beforeunload', alSalir);
  }, [isDirty]);

  /**
   * Validación local. Repite las reglas del backend a propósito: el backend
   * acota en silencio (nunca rechaza), así que sin esto el usuario guardaría
   * un valor inválido y vería otro distinto sin explicación.
   */
  const errores = useMemo(() => {
    const e: Partial<Record<CampoMonitoreo, string>> = {};

    (Object.keys(LIMITES_MONITOREO) as CampoMonitoreo[]).forEach((key) => {
      const { min, max } = LIMITES_MONITOREO[key];
      const valor = formData[key];
      if (!Number.isFinite(valor) || valor < min || valor > max) {
        e[key] = t('settingsMonitoreo.validation.range', { min, max });
      }
    });

    if (
      !e.umbral_inactivo_minutos &&
      !e.umbral_en_vivo_minutos &&
      formData.umbral_inactivo_minutos <= formData.umbral_en_vivo_minutos
    ) {
      e.umbral_inactivo_minutos = t('settingsMonitoreo.validation.order', {
        n: formData.umbral_en_vivo_minutos,
      });
    }

    return e;
  }, [formData, t]);

  const hayErrores = Object.keys(errores).length > 0;

  const handleChange = (key: CampoMonitoreo, valor: string) => {
    const n = parseInt(valor, 10);
    setFormData((prev) => ({ ...prev, [key]: Number.isNaN(n) ? 0 : n }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (hayErrores) return;
    try {
      const guardado = await guardar.mutateAsync(formData);
      // El backend puede haber ajustado algo: se refleja lo que quedó y se
      // avisa, en lugar de dejar la pantalla mostrando lo que se envió.
      const ajustado =
        guardado.umbral_en_vivo_minutos !== formData.umbral_en_vivo_minutos ||
        guardado.umbral_inactivo_minutos !== formData.umbral_inactivo_minutos ||
        guardado.ventana_mapa_horas !== formData.ventana_mapa_horas;

      setFormData(guardado);
      setIsDirty(false);
      addToast(
        ajustado
          ? `${t('settingsMonitoreo.toasts.success')} — ${t('settingsMonitoreo.notes.adjusted')}`
          : t('settingsMonitoreo.toasts.success'),
        'success',
      );
    } catch {
      addToast(t('settingsMonitoreo.toasts.error'), 'error');
    }
  };

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-center">
        {t('settingsMonitoreo.error_load')}
      </div>
    );
  }

  // Vista previa de la escala resultante. Se calcula sobre `formData` y no
  // sobre lo guardado: muestra el efecto del cambio antes de confirmarlo.
  const previewFilas = [
    {
      color: COLOR_EN_VIVO,
      texto: t('settingsMonitoreo.preview.live', { n: formData.umbral_en_vivo_minutos }),
    },
    {
      color: COLOR_INACTIVO,
      texto: t('settingsMonitoreo.preview.idle', {
        from: formData.umbral_en_vivo_minutos,
        to: formData.umbral_inactivo_minutos,
      }),
    },
    {
      color: COLOR_SIN_SENAL,
      texto: t('settingsMonitoreo.preview.offline', { n: formData.umbral_inactivo_minutos }),
    },
    {
      color: COLOR_FUERA_DE_MAPA,
      texto: t('settingsMonitoreo.preview.window', { h: formData.ventana_mapa_horas }),
      hueco: true,
    },
  ];

  return (
    <RequirePermission permission="manage_settings" fallback={<SinPermiso permission="manage_settings" />}>
      <div className="max-w-4xl space-y-6">
        <div className="bg-[#1A2346] p-6 rounded-xl border border-[#2D3B6A] shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <Radar className="w-7 h-7" style={{ color: COLOR_EN_VIVO }} />
            <h2 className="text-xl font-bold text-white tracking-wide">
              {t('settingsMonitoreo.title')}
            </h2>
          </div>
          <p className="text-gray-400 text-sm mb-8">{t('settingsMonitoreo.subtitle')}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CAMPOS.map((campo) => (
              <div key={campo.key} className="relative group">
                <label className="text-sm font-medium text-gray-300 mb-1 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="flex-shrink-0"
                      style={{
                        width: '8px', height: '8px', borderRadius: '50%', background: campo.color,
                      }}
                    />
                    <span className="truncate">
                      {t(`settingsMonitoreo.fields.${campo.i18n}.label`)}
                    </span>
                  </span>
                  <span className="cursor-help text-gray-500 hover:text-white transition-colors flex-shrink-0">
                    <AlertCircle className="w-4 h-4" />
                    <span className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-[#0B1120] border border-[#2D3B6A] rounded-lg shadow-xl text-xs text-gray-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 font-normal normal-case text-left block">
                      {t(`settingsMonitoreo.fields.${campo.i18n}.tooltip`)}
                    </span>
                  </span>
                </label>

                {isLoading ? (
                  <div className="h-11 bg-[#2D3B6A] rounded-lg animate-pulse w-full" />
                ) : (
                  <input
                    type="number"
                    min={LIMITES_MONITOREO[campo.key].min}
                    max={LIMITES_MONITOREO[campo.key].max}
                    value={formData[campo.key] || ''}
                    onChange={(e) => handleChange(campo.key, e.target.value)}
                    className={`w-full bg-[#151B36] border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 transition-colors font-mono text-lg ${
                      errores[campo.key]
                        ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-[#2D3B6A] focus:border-green-500 focus:ring-green-500/20'
                    }`}
                  />
                )}

                {errores[campo.key] && (
                  <p className="text-red-400 text-xs mt-1">{errores[campo.key]}</p>
                )}
              </div>
            ))}
          </div>

          {/* Vista previa: traduce tres números a la escala que verá el operador. */}
          <div className="mt-8 bg-[#151B36] border border-[#2D3B6A] rounded-xl p-5">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              {t('settingsMonitoreo.preview.title')}
            </div>
            <div className="flex flex-col gap-2">
              {previewFilas.map((fila) => (
                <div key={fila.texto} className="flex items-center gap-3 text-sm text-gray-300">
                  <span
                    className="flex-shrink-0"
                    style={{
                      width: '12px', height: '12px', borderRadius: '50%', background: fila.color,
                      border: fila.hueco ? '1px dashed rgba(255,255,255,0.35)' : 'none',
                      opacity: fila.hueco ? 0.7 : 1,
                    }}
                  />
                  <span>{fila.texto}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {[t('settingsMonitoreo.notes.order'), t('settingsMonitoreo.notes.window_cap')].map((nota) => (
              <div key={nota} className="flex items-start gap-2 text-xs text-gray-500 leading-relaxed">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{nota}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-[#2D3B6A] flex justify-end">
            <button
              onClick={handleSave}
              disabled={!isDirty || hayErrores || guardar.isPending}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg ${
                !isDirty || hayErrores
                  ? 'bg-[#2D3B6A] text-gray-400 cursor-not-allowed shadow-none'
                  : 'bg-green-500 hover:bg-green-400 text-[#0B1120] shadow-green-500/20 hover:shadow-green-400/40'
              }`}
            >
              {guardar.isPending ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {t('settingsMonitoreo.save')}
            </button>
          </div>
        </div>
      </div>
    </RequirePermission>
  );
};
