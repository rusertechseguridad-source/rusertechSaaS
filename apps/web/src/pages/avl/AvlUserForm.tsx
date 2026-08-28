import React, { useState } from 'react';
import { X, Download } from 'lucide-react';
import { useAvlStore } from '../../store/avlStore';
import { exportToCsv } from '../../utils/export';

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

    operational_contact: (existingUser as any)?.operational_contact || '',
    provider_api_url: existingUser?.provider_api_url || '',

    provider_notes: existingUser?.provider_notes || '',
    is_active: existingUser ? existingUser.is_active : true,
  });

  // Las credenciales del proveedor NO viven en `formData`.
  //
  // El backend ya no las devuelve (se guardan cifradas y sólo se revelan por un
  // endpoint aparte), así que `existingUser?.provider_password || ''` daría ''
  // y guardar sin tocarlas las habría BORRADO. Van en su propio estado con la
  // regla: lo que el operador no escribió, no se manda, y Prisma no toca esa
  // columna.
  const [credenciales, setCredenciales] = useState<{
    provider_password?: string;
    provider_api_key?: string;
  }>({});

  const cambiarCredencial = (campo: 'provider_password' | 'provider_api_key', valor: string) => {
    setCredenciales(prev => ({ ...prev, [campo]: valor }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Sólo se envían las credenciales que el operador efectivamente escribió.
    // Una clave ausente le dice al backend "no toques esa columna".
    const credencialesAEnviar = Object.fromEntries(
      Object.entries(credenciales).filter(([, valor]) => valor !== undefined && valor !== ''),
    );
    const cuerpo = { ...formData, ...credencialesAEnviar };

    if (existingUser) {
      await updateUser(existingUser.id, cuerpo);
    } else {
      await createUser(cuerpo);
    }
    onClose();
  };

  const handleExportDetail = () => {
    if (!existingUser) return;
    const headers = ['Nombre', 'Código HUB', 'Descripción', 'Plataforma', 'Contacto', 'Estado'];
    const row = [
      formData.name,
      formData.user_avl_code,
      formData.description,
      formData.provider_name,
      formData.operational_contact,
      formData.is_active ? 'Activo' : 'Inactivo'
    ];
    exportToCsv(`ProveedorGPS_${formData.user_avl_code}`, headers, [row]);
  };

  return (
    <div className="fixed inset-0 bg-bgStart/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bgSurface border border-borderDefault rounded-xl shadow-card w-full max-w-3xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 py-4 bg-bgStart/50 border-b border-borderDefault flex justify-between items-center rounded-t-xl shrink-0">
          <h2 className="text-xl font-bold text-white">
            {existingUser ? 'Configurar Proveedor GPS' : 'Nuevo Proveedor GPS'}
          </h2>
          <div className="flex items-center gap-3">
            {existingUser && (
              <button 
                type="button"
                onClick={handleExportDetail}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bgSurfaceHigh hover:bg-bgSurface text-textPrimary text-xs font-medium rounded-md border border-borderDefault transition-colors"
              >
                <Download size={14} className="text-accentBlue" />
                Exportar
              </button>
            )}
            <button
              onClick={onClose}
              className="text-textMuted hover:text-white transition-colors rounded-lg p-1 hover:bg-borderDefault"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form body */}
        <div className="p-6 overflow-y-auto flex-grow">
          <form id="avl-form" onSubmit={handleSubmit} className="space-y-8">

            {/* Sección 1: Identificación */}
            <section>
              <h3 className="text-accentGreen font-bold uppercase tracking-wider text-xs border-b border-borderDefault pb-2 mb-4">
                Identificación
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-sm font-medium text-textSecondary mb-1"
                    title="El nombre interno con el que identificamos a este proveedor en nuestra plataforma"
                  >
                    Nombre Descriptivo
                  </label>
                  <input
                    required
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue placeholder-textMuted transition-colors"
                    placeholder="Ej: Flota Norte - Teltonika"
                    title="El nombre interno con el que identificamos a este proveedor en nuestra plataforma"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-textSecondary mb-1"
                    title="El código exacto de cliente o HUB que Rusertech recibirá en el JSON"
                  >
                    Código HUB (User_avl)
                  </label>
                  <input
                    required
                    name="user_avl_code"
                    value={formData.user_avl_code}
                    onChange={handleChange}
                    className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue placeholder-textMuted font-mono transition-colors"
                    placeholder="Ej: PROV_01"
                    title="El código exacto de cliente o HUB que Rusertech recibirá en el JSON"
                  />
                  <p className="text-xs text-textMuted mt-1">El valor exacto enviado por el HUB.</p>
                </div>
                <div className="md:col-span-2">
                  <label
                    className="block text-sm font-medium text-textSecondary mb-1"
                    title="Notas o detalles adicionales de este proveedor"
                  >
                    Descripción
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue placeholder-textMuted transition-colors resize-none"
                    rows={2}
                    title="Notas o detalles adicionales de este proveedor"
                  />
                </div>
              </div>
            </section>

            {/* Sección 2: Credenciales */}
            <section>
              <div className="border-b border-borderDefault pb-2 mb-4">
                <h3 className="text-accentGreen font-bold uppercase tracking-wider text-xs">
                  Repositorio de Acceso (Credenciales)
                </h3>
                <p className="text-xs text-statusWarning mt-2 bg-statusWarning/10 border border-statusWarning/20 px-3 py-2 rounded-lg">
                  Estos datos son solo para consulta manual. No se usan automáticamente en la ingesta.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-sm font-medium text-textSecondary mb-1"
                    title="Software base del proveedor"
                  >
                    Proveedor / Plataforma
                  </label>
                  <input
                    name="provider_name"
                    value={formData.provider_name}
                    onChange={handleChange}
                    className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue placeholder-textMuted transition-colors"
                    placeholder="Ej: Wialon, TrackSolid..."
                    title="Software base del proveedor"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-textSecondary mb-1"
                    title="Contacto Operativo (Nombre/Teléfono)"
                  >
                    Contacto Operativo
                  </label>
                  <input
                    name="operational_contact"
                    value={formData.operational_contact}
                    onChange={handleChange}
                    className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue placeholder-textMuted transition-colors"
                    placeholder="Nombre / Teléfono de Guardia"
                    title="Contacto Operativo (Nombre/Teléfono)"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-textSecondary mb-1"
                    title="Link de acceso al sitio de rastreo de este proveedor"
                  >
                    URL Plataforma
                  </label>
                  <input
                    name="provider_platform_url"
                    value={formData.provider_platform_url}
                    onChange={handleChange}
                    className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue placeholder-textMuted transition-colors"
                    placeholder="https://"
                    title="Link de acceso al sitio de rastreo de este proveedor"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-textSecondary mb-1"
                    title="Usuario que nos proporcionaron para ingresar a su sistema"
                  >
                    Usuario
                  </label>
                  <input
                    name="provider_username"
                    value={formData.provider_username}
                    onChange={handleChange}
                    className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue placeholder-textMuted transition-colors"
                    title="Usuario que nos proporcionaron para ingresar a su sistema"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-textSecondary mb-1"
                    title="Contraseña que nos proporcionaron"
                  >
                    Contraseña
                  </label>
                  <input
                    type="password"
                    name="provider_password"
                    value={credenciales.provider_password ?? ''}
                    onChange={(e) => cambiarCredencial('provider_password', e.target.value)}
                    placeholder={
                      (existingUser as any)?.tiene_password_proveedor
                        ? 'Hay una contraseña guardada — escribí una nueva para reemplazarla'
                        : 'Sin contraseña guardada'
                    }
                    className="w-full bg-bgStart border border-borderDefault rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accentBlue placeholder-textMuted transition-colors"
                    title="Contraseña que nos proporcionaron"
                  />
                  {/* Un input vacío es indistinguible de "no hay credencial": la
                      pantalla lo dice en lugar de dejar que el operador suponga. */}
                  <p className="text-xs text-textMuted mt-1">
                    {(existingUser as any)?.tiene_password_proveedor
                      ? 'Guardada y cifrada. Dejá el campo vacío para conservarla.'
                      : 'No hay contraseña guardada para este proveedor.'}
                  </p>
                </div>
              </div>
            </section>

            {/* Sección 3: Control de Ingesta */}
            <section>
              <h3 className="text-accentGreen font-bold uppercase tracking-wider text-xs border-b border-borderDefault pb-2 mb-4">
                Control de Ingesta
              </h3>

              {existingUser && (
                <div className="mb-6 bg-bgStart border border-borderDefault rounded-lg p-4">
                  <label className="block text-sm font-medium text-textSecondary mb-1">
                    API Key de Rusertech (Header: X-Hub-Api-Key)
                  </label>
                  <p className="text-xs text-textMuted mb-3">
                    Esta API Key es el token de seguridad que el proveedor GPS debe usar cuando envíe datos a{' '}
                    <b className="text-textSecondary">nuestra</b> plataforma (Ingesta vía Webhook). No confundir con el usuario y contraseña que ellos nos dan a nosotros.
                  </p>
                  <div className="flex space-x-2">
                    <input
                      readOnly
                      value={existingUser.api_key}
                      className="flex-grow px-4 py-2.5 font-mono text-textSecondary bg-bgStart/50 border border-borderDefault rounded-lg text-sm focus:outline-none"
                      title="Token de seguridad para la ingesta"
                    />
                    <button
                      type="button"
                      onClick={() => regenerateApiKey(existingUser.id)}
                      className="px-4 py-2 bg-bgSurface border border-borderDefault rounded-lg text-sm font-medium text-textSecondary hover:text-white hover:border-accentBlue transition-colors"
                      title="Genera una nueva clave y desactiva la anterior"
                    >
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
                  className="w-5 h-5 rounded accent-accentBlue cursor-pointer"
                />
                <label htmlFor="is_active" className="text-white font-medium cursor-pointer">
                  Activar recepción de datos para este proveedor
                </label>
              </div>
            </section>

          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-bgStart/50 border-t border-borderDefault flex justify-end space-x-3 rounded-b-xl shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg text-textMuted font-medium hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="avl-form"
            className="px-6 py-2 bg-accentBlue text-bgStart font-bold rounded-lg hover:opacity-90 transition-opacity"
          >
            Guardar
          </button>
        </div>

      </div>
    </div>
  );
};
