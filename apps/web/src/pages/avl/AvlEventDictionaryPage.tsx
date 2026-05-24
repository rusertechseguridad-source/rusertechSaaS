import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAvlStore } from '../../store/avlStore';

export const AvlEventDictionaryPage: React.FC = () => {
  const { id: userId } = useParams<{ id: string }>();
  const { 
    users, dictionary, unknownCodes, 
    fetchDictionary, fetchUnknownCodes, 
    addDictionaryEntry, updateDictionaryEntry,
    exportDictionary, importDictionary
  } = useAvlStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const user = users.find(u => u.id === userId);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    category: 'event.enum',
    raw_code: '',
    event_type: '',
    description: '',
    triggers_alert: false,
    severity: 'info'
  });

  useEffect(() => {
    if (userId) {
      fetchDictionary(userId);
      fetchUnknownCodes(userId);
    }
  }, [userId, fetchDictionary, fetchUnknownCodes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    await addDictionaryEntry(userId, formData);
    setShowForm(false);
    setFormData({ category: 'event.enum', raw_code: '', event_type: '', description: '', triggers_alert: false, severity: 'info' });
  };

  const handleExport = async () => {
    if (userId) await exportDictionary(userId);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && userId) {
      await importDictionary(userId, file);
    }
    // reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!user) return <div className="p-8 text-textPrimary">Usuario no encontrado</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto flex gap-8 text-textPrimary h-full">
      {/* Columna Principal: Diccionario */}
      <div className="flex-grow flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Diccionario de Eventos</h1>
            <p className="text-textSecondary text-sm mt-1">Mapeo de códigos crudos de <b className="text-accentBlue">{user.name}</b> a eventos estándar.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleExport}
              className="px-4 py-2 border border-borderAccent text-accentGreen rounded-md hover:bg-bgSurfaceHigh font-medium transition-colors"
            >
              📥 Exportar
            </button>
            <button 
              onClick={handleImportClick}
              className="px-4 py-2 border border-borderAccent text-accentGreen rounded-md hover:bg-bgSurfaceHigh font-medium transition-colors"
            >
              📤 Importar
            </button>
            <input 
              type="file" 
              accept=".xlsx" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileChange} 
            />
            <button 
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-gradient-accent text-textOnAccent font-bold rounded-md hover:opacity-90 transition-opacity"
            >
              + Nuevo Mapeo
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 bg-bgSurfaceHigh p-6 rounded-xl border border-borderDefault shadow-card">
            <h3 className="font-semibold mb-4 border-b border-borderDefault pb-2 text-white">Agregar Evento al Diccionario</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div>
                <label className="block text-sm text-textSecondary mb-1" title="Tabla o categoría a la que pertenece este código">Categoría</label>
                <select required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-3 py-1.5 border border-borderDefault rounded bg-bgStart text-textPrimary focus:outline-none focus:border-accentBlue" title="Selecciona la categoría del diccionario">
                  <option value="event.enum">event.enum (Eventos)</option>
                  <option value="report.reason">report.reason (Reportes)</option>
                  <option value="default">default (General)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-textSecondary mb-1">Código Crudo</label>
                <input required value={formData.raw_code} onChange={e => setFormData({...formData, raw_code: e.target.value})} className="w-full px-3 py-1.5 border border-borderDefault rounded bg-bgStart text-textPrimary focus:outline-none focus:border-accentBlue" placeholder="Ej: 01" />
              </div>
              <div>
                <label className="block text-sm text-textSecondary mb-1">Evento Estándar</label>
                <input required value={formData.event_type} onChange={e => setFormData({...formData, event_type: e.target.value})} className="w-full px-3 py-1.5 border border-borderDefault rounded bg-bgStart text-textPrimary focus:outline-none focus:border-accentBlue" placeholder="Ej: ignition_on" />
              </div>
              <div>
                <label className="block text-sm text-textSecondary mb-1" title="Nivel de importancia del evento">Severidad</label>
                <select value={formData.severity} onChange={e => setFormData({...formData, severity: e.target.value})} className="w-full px-3 py-1.5 border border-borderDefault rounded bg-bgStart text-textPrimary focus:outline-none focus:border-accentBlue" title="Define qué tan grave es este evento si ocurre">
                  <option value="info">Info (Informativo, ej: Login)</option>
                  <option value="warning">Warning (Advertencia, ej: Exceso Vel.)</option>
                  <option value="critical">Critical (Crítico, ej: SOS)</option>
                </select>
              </div>
              <div className="flex items-end pb-1.5">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={formData.triggers_alert} onChange={e => setFormData({...formData, triggers_alert: e.target.checked})} className="rounded text-accentGreen bg-bgStart border-borderDefault focus:ring-accentGreen h-4 w-4" />
                  <span className="text-sm text-textPrimary">Genera Alerta</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm text-textSecondary mb-1">Descripción (Opcional)</label>
              <input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-1.5 border border-borderDefault rounded bg-bgStart text-textPrimary focus:outline-none focus:border-accentBlue" />
            </div>
            <div className="mt-4 flex justify-end space-x-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-1.5 border border-borderDefault rounded text-textSecondary hover:text-white transition-colors">Cancelar</button>
              <button type="submit" className="px-4 py-1.5 bg-accentGreen text-textOnAccent font-bold rounded hover:opacity-90 transition-opacity">Guardar</button>
            </div>
          </form>
        )}

        <div className="bg-bgSurface rounded-xl border border-borderDefault overflow-auto flex-grow shadow-card">
          <table className="min-w-full divide-y divide-borderDefault">
            <thead className="bg-bgSurfaceHigh sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-textSecondary uppercase tracking-wider" title="Agrupador o tabla a la que pertenece el código">Categoría</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-textSecondary uppercase tracking-wider" title="El número exacto o string que envía el dispositivo GPS">Código (Raw)</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-textSecondary uppercase tracking-wider" title="Nombre estandarizado interno del evento (ej: ignition_on)">Evento Estándar</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-textSecondary uppercase tracking-wider" title="Nivel de importancia (Info, Warning, Critical)">Severidad</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-textSecondary uppercase tracking-wider" title="Si esto debe disparar una alerta visible en el sistema">Alerta</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-textSecondary uppercase tracking-wider" title="Si la traducción de este código está activa o ignorada">Activo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderDefault">
              {dictionary.map(dict => (
                <tr key={dict.id} className="hover:bg-bgSurfaceHigh/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-textMuted">{dict.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-accentBlue font-bold">{dict.raw_code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{dict.event_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${dict.severity === 'critical' ? 'bg-statusDanger/20 text-statusDanger border-statusDanger/50' : dict.severity === 'warning' ? 'bg-statusWarning/20 text-statusWarning border-statusWarning/50' : 'bg-statusInfo/20 text-statusInfo border-statusInfo/50'}`}>
                      {dict.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-textSecondary">
                    {dict.triggers_alert ? <span className="text-statusWarning font-medium">Sí</span> : 'No'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => updateDictionaryEntry(dict.id, { is_active: !dict.is_active })}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${dict.is_active ? 'bg-statusOnline' : 'bg-bgStart'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${dict.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </td>
                </tr>
              ))}
              {dictionary.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-textMuted">
                    No hay códigos mapeados en el diccionario para este proveedor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Panel Lateral: Códigos Desconocidos */}
      <div className="w-80 flex-shrink-0 flex flex-col">
        <div className="bg-bgSurface rounded-xl border border-borderDefault overflow-hidden flex flex-col flex-grow shadow-card">
          <div className="p-4 border-b border-borderDefault bg-bgSurfaceHigh flex justify-between items-center">
            <h3 className="font-semibold text-white">Códigos Desconocidos</h3>
            {unknownCodes.length > 0 && (
              <span className="bg-statusDanger/20 text-statusDanger border border-statusDanger/50 text-xs font-bold px-2 py-0.5 rounded-full">
                {unknownCodes.length}
              </span>
            )}
          </div>
          <div className="p-4 overflow-y-auto flex-grow bg-bgSurface">
            {unknownCodes.length === 0 ? (
              <p className="text-sm text-textMuted text-center py-8">No hay códigos sin mapear recibidos recientemente.</p>
            ) : (
              <ul className="space-y-3">
                {unknownCodes.map(code => (
                  <li key={code} className="bg-bgStart border border-borderDanger/30 rounded-lg p-3 shadow-sm flex justify-between items-center">
                    <span className="font-mono font-bold text-statusDanger">{code}</span>
                    <button 
                      onClick={() => {
                        setFormData({ ...formData, raw_code: code });
                        setShowForm(true);
                      }}
                      className="text-xs border border-borderDefault hover:bg-bgSurfaceHigh px-2 py-1 rounded text-textSecondary hover:text-white transition-colors font-medium"
                    >
                      + Mapear
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 text-xs text-textMuted border-t border-borderDefault pt-4">
              <p>Estos códigos fueron enviados por el HUB pero no están en el diccionario actual. Agrégalos para interpretarlos correctamente.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
