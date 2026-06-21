import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2, Check, X, ShieldAlert } from 'lucide-react';

export const AdminSystemParameters: React.FC = () => {
  const [parameters, setParameters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editingParam, setEditingParam] = useState<any>(null);
  
  // Form State
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [dataType, setDataType] = useState('string');
  const [description, setDescription] = useState('');
  const [isEditable, setIsEditable] = useState(false);

  const fetchParameters = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch('http://localhost:3000/api/v1/admin/parameters', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setParameters(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParameters();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('rusertech_token');
      const payload = {
        parameter_key: key.toUpperCase().trim(),
        parameter_value: value,
        data_type: dataType,
        description,
        is_editable_by_account_owner: isEditable
      };

      const url = editingParam 
        ? `http://localhost:3000/api/v1/admin/parameters/${editingParam.id}`
        : 'http://localhost:3000/api/v1/admin/parameters';
        
      const method = editingParam ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowModal(false);
        fetchParameters();
      } else {
        const error = await res.json();
        alert(`Error: ${error.message}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    }
  };

  const handleDelete = async (id: string, paramKey: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el parámetro ${paramKey}? Esto podría afectar el funcionamiento del sistema.`)) return;
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch(`http://localhost:3000/api/v1/admin/parameters/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchParameters();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openNewModal = () => {
    setEditingParam(null);
    setKey('');
    setValue('');
    setDataType('string');
    setDescription('');
    setIsEditable(false);
    setShowModal(true);
  };

  const openEditModal = (p: any) => {
    setEditingParam(p);
    setKey(p.parameter_key);
    setValue(p.parameter_value);
    setDataType(p.data_type);
    setDescription(p.description || '');
    setIsEditable(p.is_editable_by_account_owner);
    setShowModal(true);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-bgSurface border border-borderDefault rounded-xl shadow-card overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-borderDefault flex justify-between items-center bg-bgStart">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-accentBlue" /> Parámetros Globales del Sistema
            </h2>
            <p className="text-xs text-textMuted mt-1">Configura las constantes y valores por defecto de la plataforma (Telemetría, AVL, Interfaz, etc.)</p>
          </div>
          <button
            onClick={openNewModal}
            className="bg-accentBlue hover:bg-blue-600 text-white px-4 py-2 rounded font-bold flex items-center text-sm shadow-card transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" /> Nuevo Parámetro
          </button>
        </div>

        <div className="overflow-x-auto flex-1 bg-bgSurface">
          <table className="w-full text-left">
            <thead className="bg-bgStart border-b border-borderDefault text-xs font-bold text-textMuted uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Clave (Key)</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Sobrescritura por Cliente</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-textMuted">Cargando parámetros...</td>
                </tr>
              ) : parameters.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-textMuted flex flex-col items-center">
                    <ShieldAlert className="w-8 h-8 mb-2 opacity-50" />
                    No hay parámetros globales configurados.
                  </td>
                </tr>
              ) : parameters.map(p => (
                <tr key={p.id} className="border-b border-borderDefault hover:bg-bgStart/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-mono text-sm font-bold text-accentBlue">{p.parameter_key}</div>
                    {p.description && <div className="text-xs text-textMuted mt-1">{p.description}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <code className="bg-bgStart px-2 py-1 rounded text-yellow-400 text-sm font-bold border border-yellow-400/20">
                      {p.parameter_value.length > 50 ? p.parameter_value.substring(0, 50) + '...' : p.parameter_value}
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs uppercase text-textSecondary bg-bgStart border border-borderDefault px-2 py-1 rounded font-bold">
                      {p.data_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs uppercase font-bold px-2 py-1 rounded border ${p.is_editable_by_account_owner ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
                      {p.is_editable_by_account_owner ? 'Permitido' : 'Denegado'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEditModal(p)} className="p-2 bg-bgStart hover:bg-accentBlue/20 text-textMuted hover:text-accentBlue rounded transition-colors" title="Editar">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(p.id, p.parameter_key)} className="p-2 bg-bgStart hover:bg-red-500/20 text-textMuted hover:text-red-500 rounded transition-colors" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-bgOverlay z-[100] flex items-center justify-center p-4">
          <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-lg shadow-card overflow-hidden flex flex-col">
            <div className="p-5 border-b border-borderDefault bg-bgStart flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {editingParam ? <Edit2 className="w-5 h-5 text-accentBlue" /> : <Plus className="w-5 h-5 text-accentBlue" />}
                {editingParam ? 'Editar Parámetro' : 'Nuevo Parámetro Global'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-textMuted hover:text-white rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">Clave del Parámetro (Key)</label>
                <input 
                  required 
                  type="text" 
                  value={key} 
                  onChange={e => setKey(e.target.value)} 
                  disabled={!!editingParam}
                  placeholder="Ej: TELEMETRY_RETENTION_DAYS"
                  className="w-full p-2 bg-bgStart border border-borderDefault rounded text-white text-sm font-mono uppercase disabled:opacity-50" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">Tipo de Dato</label>
                  <select 
                    value={dataType} 
                    onChange={e => setDataType(e.target.value)} 
                    className="w-full p-2 bg-bgStart border border-borderDefault rounded text-white text-sm"
                  >
                    <option value="string">Texto (String)</option>
                    <option value="number">Número (Number)</option>
                    <option value="boolean">Booleano (True/False)</option>
                    <option value="json">JSON Objeto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">Sobrescritura</label>
                  <label className="flex items-center gap-2 p-2 border border-borderDefault bg-bgStart rounded cursor-pointer hover:border-accentBlue transition-colors">
                    <input 
                      type="checkbox" 
                      checked={isEditable}
                      onChange={e => setIsEditable(e.target.checked)}
                      className="rounded border-borderDefault text-accentBlue focus:ring-accentBlue bg-bgSurface"
                    />
                    <span className="text-sm font-bold text-white">Permitir a Clientes</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">Valor del Parámetro</label>
                {dataType === 'boolean' ? (
                  <select 
                    value={value} 
                    onChange={e => setValue(e.target.value)} 
                    className="w-full p-2 bg-bgStart border border-borderDefault rounded text-white text-sm font-mono"
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <textarea 
                    required 
                    value={value} 
                    onChange={e => setValue(e.target.value)} 
                    rows={3}
                    placeholder={dataType === 'json' ? '{"key": "value"}' : 'Ingresa el valor'}
                    className="w-full p-2 bg-bgStart border border-borderDefault rounded text-white text-sm font-mono" 
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">Descripción (Opcional)</label>
                <input 
                  type="text" 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  placeholder="¿Para qué sirve este parámetro?"
                  className="w-full p-2 bg-bgStart border border-borderDefault rounded text-white text-sm" 
                />
              </div>

              <div className="flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-textMuted hover:text-white font-bold text-sm transition-colors">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-accentBlue hover:bg-blue-600 text-white font-bold text-sm rounded shadow-card transition-colors flex items-center gap-2">
                  <Check className="w-4 h-4" /> Guardar Parámetro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
