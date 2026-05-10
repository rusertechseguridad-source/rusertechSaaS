import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAvlStore } from '../../store/avlStore';

export const AvlEventDictionaryPage: React.FC = () => {
  const { id: userId } = useParams<{ id: string }>();
  const { 
    users, dictionary, unknownCodes, 
    fetchDictionary, fetchUnknownCodes, 
    addDictionaryEntry, updateDictionaryEntry 
  } = useAvlStore();

  const user = users.find(u => u.id === userId);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
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
    await addDictionaryEntry(userId, formData);
    setShowForm(false);
    setFormData({ raw_code: '', event_type: '', description: '', triggers_alert: false, severity: 'info' });
  };

  if (!user) return <div className="p-8">Usuario no encontrado</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto flex gap-8">
      {/* Columna Principal: Diccionario */}
      <div className="flex-grow">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Diccionario de Eventos</h1>
            <p className="text-gray-500">Mapeo de códigos crudos de <b>{user.name}</b> a eventos estándar.</p>
          </div>
          <button 
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Nuevo Mapeo
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
            <h3 className="font-semibold mb-4 border-b pb-2">Agregar Evento al Diccionario</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm mb-1">Código Crudo</label>
                <input required value={formData.raw_code} onChange={e => setFormData({...formData, raw_code: e.target.value})} className="w-full px-3 py-1.5 border rounded" placeholder="Ej: 01" />
              </div>
              <div>
                <label className="block text-sm mb-1">Evento Estándar</label>
                <input required value={formData.event_type} onChange={e => setFormData({...formData, event_type: e.target.value})} className="w-full px-3 py-1.5 border rounded" placeholder="Ej: ignition_on" />
              </div>
              <div>
                <label className="block text-sm mb-1">Severidad</label>
                <select value={formData.severity} onChange={e => setFormData({...formData, severity: e.target.value})} className="w-full px-3 py-1.5 border rounded bg-white">
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="flex items-end pb-1.5">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" checked={formData.triggers_alert} onChange={e => setFormData({...formData, triggers_alert: e.target.checked})} className="rounded text-blue-600" />
                  <span className="text-sm">Genera Alerta</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1">Descripción (Opcional)</label>
              <input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-1.5 border rounded" />
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-1.5 border rounded text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700">Guardar</button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código (Raw)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evento Estándar</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severidad</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alerta</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activo</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dictionary.map(dict => (
                <tr key={dict.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">{dict.raw_code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dict.event_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${dict.severity === 'critical' ? 'bg-red-100 text-red-800' : dict.severity === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                      {dict.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {dict.triggers_alert ? 'Sí' : 'No'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => updateDictionaryEntry(dict.id, { is_active: !dict.is_active })}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${dict.is_active ? 'bg-green-500' : 'bg-gray-200'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${dict.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </td>
                </tr>
              ))}
              {dictionary.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No hay códigos mapeados en el diccionario.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Panel Lateral: Códigos Desconocidos */}
      <div className="w-80 flex-shrink-0">
        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden flex flex-col max-h-[80vh]">
          <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Códigos Desconocidos</h3>
            {unknownCodes.length > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">
                {unknownCodes.length}
              </span>
            )}
          </div>
          <div className="p-4 overflow-y-auto flex-grow">
            {unknownCodes.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No hay códigos sin mapear recibidos recientemente.</p>
            ) : (
              <ul className="space-y-3">
                {unknownCodes.map(code => (
                  <li key={code} className="bg-white border border-red-100 rounded-lg p-3 shadow-sm flex justify-between items-center">
                    <span className="font-mono font-bold text-red-600">{code}</span>
                    <button 
                      onClick={() => {
                        setFormData({ ...formData, raw_code: code });
                        setShowForm(true);
                      }}
                      className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700 font-medium"
                    >
                      + Mapear
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 text-xs text-gray-400">
              <p>Estos códigos fueron enviados por el HUB pero no están en el diccionario actual. Agrégalos para interpretarlos correctamente.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
