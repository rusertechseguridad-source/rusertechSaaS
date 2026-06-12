import React, { useState } from 'react';
import { useAvlStore } from '../../store/avlStore';

export const AvlUserForm: React.FC<{
  onClose: () => void;
  userId?: string;
}> = ({ onClose, userId }) => {
  const { users, createUser, updateUser, regenerateApiKey } = useAvlStore();
  const existingUser = userId ? users.find(u => u.id === userId) : null;

  const [formData, setFormData] = useState({
    name: existingUser?.name || '',
    user_avl_code: existingUser?.user_avl_code || '',
    description: existingUser?.description || '',
    provider_name: existingUser?.provider_name || existingUser?.name || '',
    provider_platform_url: existingUser?.provider_platform_url || '',
    provider_username: existingUser?.provider_username || '',
    provider_password: existingUser?.provider_password || '',
    operational_contact: existingUser?.operational_contact || '',
    provider_api_url: existingUser?.provider_api_url || '',
    provider_api_key: existingUser?.provider_api_key || '',
    provider_notes: existingUser?.provider_notes || '',
    is_active: existingUser ? existingUser.is_active : true,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (existingUser) {
      await updateUser(existingUser.id, formData);
    } else {
      await createUser(formData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
          <h2 className="text-xl font-bold text-gray-900">
            {existingUser ? 'Configurar Proveedor GPS' : 'Nuevo Proveedor GPS'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow">
          <form id="avl-form" onSubmit={handleSubmit} className="space-y-8">
            
            {/* Sección 1: Identificación */}
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Identificación</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" title="El nombre interno con el que identificamos a este proveedor en nuestra plataforma">Nombre Descriptivo</label>
                  <input required name="name" value={formData.name} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: Flota Norte - Teltonika" title="El nombre interno con el que identificamos a este proveedor en nuestra plataforma" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" title="El código exacto de cliente o HUB que Rusertech recibirá en el JSON">Código HUB (User_avl)</label>
                  <input required name="user_avl_code" value={formData.user_avl_code} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono" placeholder="Ej: PROV_01" title="El código exacto de cliente o HUB que Rusertech recibirá en el JSON" />
                  <p className="text-xs text-gray-500 mt-1">El valor exacto enviado por el HUB.</p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1" title="Notas o detalles adicionales de este proveedor">Descripción</label>
                  <textarea name="description" value={formData.description} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" rows={2} title="Notas o detalles adicionales de este proveedor" />
                </div>
              </div>
            </section>

            {/* Sección 2: Credenciales */}
            <section>
              <div className="mb-4 border-b pb-2">
                <h3 className="text-lg font-semibold text-gray-900">Repositorio de Acceso (Credenciales)</h3>
                <p className="text-sm text-amber-600 mt-1 bg-amber-50 p-2 rounded">Estos datos son solo para consulta manual. No se usan automáticamente en la ingesta.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" title="Software base del proveedor">Proveedor / Plataforma</label>
                  <input name="provider_name" value={formData.provider_name} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: Wialon, TrackSolid..." title="Software base del proveedor" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" title="Contacto Operativo (Nombre/Teléfono)">Contacto Operativo</label>
                  <input name="operational_contact" value={formData.operational_contact} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nombre / Teléfono de Guardia" title="Contacto Operativo (Nombre/Teléfono)" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" title="Link de acceso al sitio de rastreo de este proveedor">URL Plataforma</label>
                  <input name="provider_platform_url" value={formData.provider_platform_url} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="https://" title="Link de acceso al sitio de rastreo de este proveedor" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" title="Usuario que nos proporcionaron para ingresar a su sistema">Usuario</label>
                  <input name="provider_username" value={formData.provider_username} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" title="Usuario que nos proporcionaron para ingresar a su sistema" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" title="Contraseña que nos proporcionaron">Contraseña</label>
                  <input type="password" name="provider_password" value={formData.provider_password} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" title="Contraseña que nos proporcionaron" />
                </div>
              </div>
            </section>

            {/* Sección 3: Control */}
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Control de Ingesta</h3>
              
              {existingUser && (
                <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">API Key de Rusertech (Header: X-Hub-Api-Key)</label>
                  <p className="text-xs text-gray-600 mb-3">Esta API Key es el token de seguridad que el proveedor GPS debe usar cuando envíe datos a <b>nuestra</b> plataforma (Ingesta vía Webhook). No confundir con el usuario y contraseña que ellos nos dan a nosotros.</p>
                  <div className="flex space-x-2">
                    <input readOnly value={existingUser.api_key} className="flex-grow px-4 py-2 bg-white border border-gray-300 rounded-lg font-mono text-sm text-gray-600" title="Token de seguridad para la ingesta" />
                    <button type="button" onClick={() => regenerateApiKey(existingUser.id)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50" title="Genera una nueva clave y desactiva la anterior">
                      Regenerar
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-3">
                <input 
                  type="checkbox" 
                  id="is_active" 
                  name="is_active" 
                  checked={formData.is_active} 
                  onChange={handleChange}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="is_active" className="text-gray-900 font-medium cursor-pointer">
                  Activar recepción de datos para este proveedor
                </label>
              </div>
            </section>
          </form>
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end space-x-3 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition">
            Cancelar
          </button>
          <button type="submit" form="avl-form" className="px-6 py-2 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-700 transition">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};
