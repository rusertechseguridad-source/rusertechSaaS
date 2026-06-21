import React, { useEffect, useState } from 'react';
import { Settings, Building, Users, Key, Globe, Plus, Trash2, Edit2, ShieldAlert, Check, X, HelpCircle, Shield, RefreshCw, Leaf, MapPin, ExternalLink, User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { NotificationChannelsTab } from '../../components/Settings/NotificationChannelsTab';
import { translateParameterKey } from '../../utils/labels';
import { useTranslation } from 'react-i18next';

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'users' | 'parameters' | 'notifications' | 'carbon' | 'forwarding'>('profile');
  const navigate = useNavigate();
  
  // Profile
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState('');

  // Users
  const [users, setUsers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('manager');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editEntityRestrictions, setEditEntityRestrictions] = useState<{vehicles: string[], locations: string[]}>({vehicles: [], locations: []});
  
  // Entities for restrictions
  const [allVehicles, setAllVehicles] = useState<any[]>([]);
  const [allLocations, setAllLocations] = useState<any[]>([]);

  const canManageUsers = (user?.role || user?.role_code) === 'account_owner' || (user?.role || user?.role_code) === 'rusertech_admin';

  // Parameters
  const [parameters, setParameters] = useState<any[]>([]);

  // Notifications
  const [smtpConfig, setSmtpConfig] = useState({ host: '', port: 587, user: '', pass: '', from: '' });
  const [fcmConfig, setFcmConfig] = useState({ serverKey: '' });

  // Carbon
  const [climatiqConfig, setClimatiqConfig] = useState({ enabled: false, apiKey: '' });

  // Forwarding
  const [forwarders, setForwarders] = useState<any[]>([]);
  const [newForwarder, setNewForwarder] = useState({ name: '', target_url: '', auth_type: 'none', payload_format: 'rusertech_v1' });

  const fetchProfile = async () => {
    const token = localStorage.getItem('rusertech_token');
    const res = await fetch('http://localhost:3000/api/v1/settings/profile', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setProfile(data);
      setName(data.name);
    }
  };

  const fetchUsers = async () => {
    const token = localStorage.getItem('rusertech_token');
    const res = await fetch('http://localhost:3000/api/v1/settings/users', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      setUsers(await res.json());
    }
  };

  const fetchConfigs = async () => {
    const token = localStorage.getItem('rusertech_token');
    const headers = { Authorization: `Bearer ${token}` };
    
    // Params
    let res = await fetch('http://localhost:3000/api/v1/settings/parameters', { headers });
    if (res.ok) setParameters(await res.json());

    // Notifications
    res = await fetch('http://localhost:3000/api/v1/settings/notifications', { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.smtp) setSmtpConfig(data.smtp);
      if (data.fcm) setFcmConfig(data.fcm);
    }

    // Carbon
    res = await fetch('http://localhost:3000/api/v1/settings/carbon', { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.climatiq) setClimatiqConfig(data.climatiq);
    }

    // Forwarding
    res = await fetch('http://localhost:3000/api/v1/forwarding', { headers });
    if (res.ok) {
      setForwarders(await res.json());
    }

    // Entities
    res = await fetch('http://localhost:3000/api/v1/vehicles', { headers });
    if (res.ok) setAllVehicles(await res.json());

    res = await fetch('http://localhost:3000/api/v1/locations', { headers });
    if (res.ok) setAllLocations(await res.json());
  };

  useEffect(() => {
    fetchProfile();
    const role = user?.role || user?.role_code;
    if (role === 'account_owner' || role === 'manager' || role === 'rusertech_admin' || role === 'admin_master_rusertech') {
      fetchUsers();
      fetchConfigs();
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('rusertech_token');
    const res = await fetch('http://localhost:3000/api/v1/settings/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name })
    });
    if (res.ok) alert('Perfil actualizado');
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('rusertech_token');
    const res = await fetch('http://localhost:3000/api/v1/settings/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: inviteEmail, full_name: inviteName, role_code: inviteRole })
    });
    if (res.ok) {
      alert('Usuario invitado exitosamente con contraseña temporal TempPassword123!');
      setInviteEmail('');
      setInviteName('');
      fetchUsers();
    } else {
      const err = await res.json();
      alert(err.message || 'Error al invitar');
    }
  };

  const toggleUserStatus = async (id: string, isActive: boolean) => {
    const token = localStorage.getItem('rusertech_token');
    const res = await fetch(`http://localhost:3000/api/v1/settings/users/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_active: !isActive })
    });
    if (res.ok) fetchUsers();
  };

  const deleteUser = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este usuario permanentemente?')) return;
    const token = localStorage.getItem('rusertech_token');
    const res = await fetch(`http://localhost:3000/api/v1/settings/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) fetchUsers();
    else alert('Error al eliminar usuario o no tienes permisos.');
  };

  const changeRole = async (id: string, roleCode: string) => {
    const token = localStorage.getItem('rusertech_token');
    const res = await fetch(`http://localhost:3000/api/v1/settings/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role_code: roleCode })
    });
    if (res.ok) fetchUsers();
    else alert('Solo el propietario puede editar usuarios');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const token = localStorage.getItem('rusertech_token');
    const res = await fetch(`http://localhost:3000/api/v1/settings/users/${editingUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role_code: editRole, full_name: editName, entity_restrictions: editEntityRestrictions })
    });
    if (res.ok) {
      setEditingUser(null);
      fetchUsers();
    } else {
      alert('Solo el propietario puede editar usuarios');
    }
  };

  const saveParameter = async (key: string, value: string) => {
    const token = localStorage.getItem('rusertech_token');
    await fetch(`http://localhost:3000/api/v1/settings/parameters`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ key, value })
    });
    fetchConfigs();
  };

  const restoreParameter = async (key: string) => {
    const token = localStorage.getItem('rusertech_token');
    await fetch(`http://localhost:3000/api/v1/settings/parameters/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ key })
    });
    fetchConfigs();
  };

  const saveNotificationsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('rusertech_token');
    await fetch(`http://localhost:3000/api/v1/settings/notifications`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ smtp: smtpConfig, fcm: fcmConfig })
    });
    alert('Configuración de notificaciones guardada');
  };

  const saveCarbonConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('rusertech_token');
    await fetch(`http://localhost:3000/api/v1/settings/carbon`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ climatiq: climatiqConfig })
    });
    alert('Configuración de carbono guardada');
  };

  const createForwarder = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('rusertech_token');
    await fetch('http://localhost:3000/api/v1/forwarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(newForwarder)
    });
    setNewForwarder({ name: '', target_url: '', auth_type: 'none', payload_format: 'rusertech_v1' });
    fetchConfigs();
  };

  const deleteForwarder = async (id: string) => {
    if (!window.confirm('¿Eliminar este reenvío?')) return;
    const token = localStorage.getItem('rusertech_token');
    await fetch(`http://localhost:3000/api/v1/forwarding/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchConfigs();
  };

  const toggleForwarder = async (id: string, isActive: boolean) => {
    const token = localStorage.getItem('rusertech_token');
    await fetch(`http://localhost:3000/api/v1/forwarding/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_active: !isActive })
    });
    fetchConfigs();
  };

  const resetCircuit = async (id: string) => {
    const token = localStorage.getItem('rusertech_token');
    await fetch(`http://localhost:3000/api/v1/forwarding/${id}/reset-circuit`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchConfigs();
  };

  return (
    <div className="p-8 h-full w-full flex flex-col">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <Settings className="w-8 h-8 text-accentBlue" />
          <div>
            <h1 className="text-3xl font-black text-white">{t('settings.title')}</h1>
            <p className="text-sm text-textMuted mt-1">{t('settings.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Tabs sidebar */}
        <div className="w-64 shrink-0 flex flex-col gap-2">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-all ${
              activeTab === 'profile' ? 'bg-accentBlue/20 text-accentBlue border border-accentBlue/50' : 'bg-bgSurface text-textMuted hover:bg-bgSurfaceHigh hover:text-white border border-borderDefault'
            }`}
          >
            <Building className="w-5 h-5" /> Mi Empresa
          </button>
          {((user?.role || user?.role_code) === 'account_owner' || (user?.role || user?.role_code) === 'manager' || (user?.role || user?.role_code) === 'rusertech_admin') && (
            <>
              <button 
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-all ${
                  activeTab === 'users' ? 'bg-accentBlue/20 text-accentBlue border border-accentBlue/50' : 'bg-bgSurface text-textMuted hover:bg-bgSurfaceHigh hover:text-white border border-borderDefault'
                }`}
              >
                <Users className="w-5 h-5" /> Usuarios
              </button>

              <button 
                onClick={() => navigate('/avl')}
                className="flex items-center justify-between px-4 py-3 rounded-lg font-bold transition-all bg-bgSurface text-textMuted hover:bg-bgSurfaceHigh hover:text-white border border-borderDefault"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5" /> Prestadores / AVL
                </div>
                <ExternalLink className="w-4 h-4 opacity-50" />
              </button>

              <button 
                onClick={() => setActiveTab('parameters')}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-all ${
                  activeTab === 'parameters' ? 'bg-accentBlue/20 text-accentBlue border border-accentBlue/50' : 'bg-bgSurface text-textMuted hover:bg-bgSurfaceHigh hover:text-white border border-borderDefault'
                }`}
              >
                <Sliders className="w-5 h-5" /> Parámetros del Sistema
              </button>

              <button 
                onClick={() => setActiveTab('notifications')}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-all ${
                  activeTab === 'notifications' ? 'bg-accentBlue/20 text-accentBlue border border-accentBlue/50' : 'bg-bgSurface text-textMuted hover:bg-bgSurfaceHigh hover:text-white border border-borderDefault'
                }`}
              >
                <Bell className="w-5 h-5" /> Notificaciones
              </button>

              <button 
                onClick={() => setActiveTab('carbon')}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-all ${
                  activeTab === 'carbon' ? 'bg-accentBlue/20 text-accentBlue border border-accentBlue/50' : 'bg-bgSurface text-textMuted hover:bg-bgSurfaceHigh hover:text-white border border-borderDefault'
                }`}
              >
                <Leaf className="w-5 h-5" /> Huella de Carbono
              </button>

              <button 
                onClick={() => setActiveTab('forwarding')}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-all ${
                  activeTab === 'forwarding' ? 'bg-accentBlue/20 text-accentBlue border border-accentBlue/50' : 'bg-bgSurface text-textMuted hover:bg-bgSurfaceHigh hover:text-white border border-borderDefault'
                }`}
              >
                <MapPin className="w-5 h-5" /> Reenvío (Forwarding)
              </button>
            </>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 bg-bgSurface border border-borderDefault rounded-xl shadow-card p-6 min-h-0 overflow-y-auto">
          
          {activeTab === 'profile' && (
            <div className="max-w-xl">
              <h2 className="text-xl font-bold text-white mb-6 border-b border-borderDefault pb-4">Datos de la Empresa</h2>
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-textSecondary mb-2 uppercase tracking-wider">Nombre de la Empresa</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-bgStart border border-borderDefault rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-textSecondary mb-2 uppercase tracking-wider">Identificador (Slug)</label>
                  <input type="text" value={profile?.slug || ''} disabled className="w-full p-3 bg-bgStart border border-borderDefault rounded-lg text-textMuted opacity-50 cursor-not-allowed" />
                  <p className="text-xs text-textMuted mt-1">El identificador único no se puede cambiar.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-textSecondary mb-2 uppercase tracking-wider">Plan Actual</label>
                  <div className="inline-flex items-center px-4 py-2 bg-accentGreen/10 text-accentGreen border border-accentGreen/20 rounded-lg font-bold uppercase text-sm tracking-wider">
                    {profile?.plan || 'Básico'}
                  </div>
                </div>
                <button type="submit" className="px-6 py-2 bg-accentBlue hover:bg-blue-600 text-white font-bold rounded-lg transition-colors">Guardar Cambios</button>
              </form>
            </div>
          )}

          {activeTab === 'users' && (
            <div>
              <div className="flex items-center justify-between mb-6 border-b border-borderDefault pb-4">
                <h2 className="text-xl font-bold text-white">Gestión de Usuarios</h2>
              </div>
              
              <div className="grid grid-cols-3 gap-6">
                {/* Tabla de usuarios */}
                <div className="col-span-2 overflow-hidden border border-borderDefault rounded-xl">
                  <table className="w-full text-left">
                    <thead className="bg-bgStart border-b border-borderDefault text-xs font-bold text-textMuted uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Usuario</th>
                        <th className="px-6 py-4">Rol</th>
                        <th className="px-6 py-4 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} className="border-b border-borderDefault/50 bg-bgSurface hover:bg-bgStart/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-white text-sm">{u.full_name}</div>
                            <div className="text-xs text-textMuted">{u.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <select 
                              value={u.role_code}
                              onChange={e => changeRole(u.id, e.target.value)}
                              disabled={u.email === user?.email || !canManageUsers}
                              className="bg-bgStart border border-borderDefault text-white text-xs rounded p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="account_owner">Propietario</option>
                              <option value="manager">Manager</option>
                              <option value="operator">Operador</option>
                              <option value="viewer">Visualizador</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {canManageUsers && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingUser(u);
                                      setEditName(u.full_name || '');
                                      setEditRole(u.role_code || '');
                                      setEditEntityRestrictions(u.entity_restrictions?.vehicles ? u.entity_restrictions : { vehicles: [], locations: [] });
                                    }}
                                    disabled={u.email === user?.email}
                                    className="p-1.5 text-accentBlue hover:bg-accentBlue/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Editar Usuario"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => toggleUserStatus(u.id, u.status === 'active')}
                                    disabled={u.email === user?.email}
                                    className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                                      u.status === 'active' ? 'bg-orange-500/10 text-orange-500 border-orange-500/30 hover:bg-orange-500/20' : 'bg-green-500/10 text-green-500 border-green-500/30 hover:bg-green-500/20'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                  >
                                    {u.status === 'active' ? 'SUSPENDER' : 'REACTIVAR'}
                                  </button>
                                  <button
                                    onClick={() => deleteUser(u.id)}
                                    disabled={u.email === user?.email}
                                    className="p-1.5 text-red-500 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Eliminar Usuario"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              {!canManageUsers && (
                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                                  u.status === 'active' ? 'text-green-500' : 'text-orange-500'
                                }`}>
                                  {u.status === 'active' ? 'ACTIVO' : 'SUSPENDIDO'}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Formulario de invitación */}
                {canManageUsers && (
                  <div className="col-span-1 bg-bgStart border border-borderDefault rounded-xl p-5 h-fit">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                      <User className="w-4 h-4 text-accentBlue" />
                      Invitar Usuario
                    </h3>
                    <form onSubmit={handleInvite} className="flex flex-col gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-textMuted mb-1">Nombre Completo</label>
                        <input required type="text" value={inviteName} onChange={e => setInviteName(e.target.value)} className="w-full p-2 text-sm bg-bgSurface border border-borderDefault rounded text-white" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-textMuted mb-1">Correo Electrónico</label>
                        <input required type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="w-full p-2 text-sm bg-bgSurface border border-borderDefault rounded text-white" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-textMuted mb-1">Rol</label>
                        <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="w-full p-2 text-sm bg-bgSurface border border-borderDefault rounded text-white">
                          <option value="manager">Manager</option>
                          <option value="operator">Operador</option>
                          <option value="viewer">Visualizador</option>
                        </select>
                      </div>
                      <button type="submit" className="mt-2 w-full py-2 bg-white text-black font-bold text-sm rounded transition-colors hover:bg-gray-200">
                        Enviar Invitación
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'parameters' && (
            <div>
              <div className="flex items-center justify-between mb-6 border-b border-borderDefault pb-4">
                <h2 className="text-xl font-bold text-white">Parámetros del Sistema</h2>
                <p className="text-textMuted text-sm">Cambios aplican de inmediato en el motor. Valores con <span className="text-accentBlue">*</span> son heredados globales.</p>
              </div>
              <div className="space-y-6 max-w-4xl">
                {parameters.map((p) => (
                  <div key={p.parameter_key} className="flex items-center justify-between bg-bgStart border border-borderDefault p-4 rounded-xl">
                    <div className="flex-1">
                      <div className="font-bold text-white mb-0.5 flex items-center gap-2">
                        {translateParameterKey(p.parameter_key)}
                        {!p.has_override && <span className="text-accentBlue text-lg leading-none" title="Valor por defecto">*</span>}
                        {p.description && (
                          <div title={p.description} className="cursor-help text-textMuted hover:text-white transition-colors">
                            <HelpCircle className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <code className="text-[10px] text-accentBlue/50 font-mono">{p.parameter_key}</code>
                    </div>
                    <div className="w-64 flex items-center gap-3">
                      <input 
                        type={p.data_type === 'number' ? 'number' : 'text'}
                        value={p.parameter_value}
                        onChange={(e) => {
                          const newParams = [...parameters];
                          const idx = newParams.findIndex(x => x.parameter_key === p.parameter_key);
                          newParams[idx].parameter_value = e.target.value;
                          setParameters(newParams);
                        }}
                        onBlur={() => saveParameter(p.parameter_key, p.parameter_value)}
                        className="flex-1 bg-bgSurface border border-borderDefault text-white text-sm rounded p-2 focus:border-accentBlue focus:outline-none"
                      />
                      {p.has_override && (
                        <button 
                          onClick={() => restoreParameter(p.parameter_key)}
                          className="text-xs text-textSecondary hover:text-accentBlue underline"
                          title="Restaurar al valor global por defecto"
                        >
                          Restaurar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {parameters.length === 0 && (
                  <div className="text-center p-8 text-textMuted">No hay parámetros configurables disponibles.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <NotificationChannelsTab />
            </div>
          )}

          {activeTab === 'carbon' && (
            <div className="max-w-xl">
              <h2 className="text-xl font-bold text-white mb-6 border-b border-borderDefault pb-4">Integración de Huella de Carbono</h2>
              <form onSubmit={saveCarbonConfig} className="space-y-6">
                <div className="bg-bgStart p-5 border border-borderDefault rounded-xl space-y-4">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Leaf className="w-5 h-5 text-green-500" />
                    Climatiq API
                  </h3>
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="climatiq-enabled" 
                      checked={climatiqConfig.enabled}
                      onChange={e => setClimatiqConfig({...climatiqConfig, enabled: e.target.checked})}
                      className="w-5 h-5 accent-green-500"
                    />
                    <label htmlFor="climatiq-enabled" className="text-white font-bold cursor-pointer">Activar cálculos de emisiones por consumo</label>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-textSecondary mb-2 uppercase mt-4">API Key (Climatiq)</label>
                    <input 
                      type="password" 
                      value={climatiqConfig.apiKey} 
                      onChange={e => setClimatiqConfig({...climatiqConfig, apiKey: e.target.value})} 
                      className="w-full p-2 bg-bgSurface border border-borderDefault rounded text-white" 
                      placeholder="sk_xxxxxxxxxxx"
                    />
                  </div>
                </div>
                <button type="submit" className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors">Guardar Integración</button>
              </form>
            </div>
          )}

          {activeTab === 'forwarding' && (
            <div>
              <div className="flex items-center justify-between mb-6 border-b border-borderDefault pb-4">
                <h2 className="text-xl font-bold text-white">Reenvío de Posiciones (Forwarding)</h2>
              </div>
              
              <div className="grid grid-cols-3 gap-6">
                <div className="col-span-2 overflow-hidden border border-borderDefault rounded-xl">
                  <table className="w-full text-left">
                    <thead className="bg-bgStart border-b border-borderDefault text-xs font-bold text-textMuted uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Nombre y URL</th>
                        <th className="px-6 py-4">Auth / Payload</th>
                        <th className="px-6 py-4">Estado (Circuito)</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forwarders.map(f => (
                        <tr key={f.id} className="border-b border-borderDefault/50 bg-bgSurface hover:bg-bgStart/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-white text-sm">{f.name}</div>
                            <div className="text-xs text-textMuted truncate max-w-[200px]" title={f.target_url}>{f.target_url}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-xs text-white uppercase">{f.auth_type}</div>
                            <div className="text-[10px] text-textMuted">{f.payload_format}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`px-2 py-1 rounded text-xs inline-block font-bold border ${f.circuit_open ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-green-500/10 text-green-500 border-green-500/30'}`}>
                              {f.circuit_open ? 'CIRCUITO ABIERTO' : 'OK'}
                            </div>
                            <div className="text-[10px] text-textMuted mt-1">Fallos: {f.consecutive_failures}</div>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2 flex items-center justify-end">
                            {f.circuit_open && (
                              <button onClick={() => resetCircuit(f.id)} className="text-xs text-blue-400 hover:text-blue-300">Reiniciar</button>
                            )}
                            <button onClick={() => toggleForwarder(f.id, f.is_active)} className={`text-xs ${f.is_active ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}>
                              {f.is_active ? 'Pausar' : 'Activar'}
                            </button>
                            <button onClick={() => deleteForwarder(f.id)} className="text-xs text-textMuted hover:text-white">Borrar</button>
                          </td>
                        </tr>
                      ))}
                      {forwarders.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-textMuted">No hay endpoints de reenvío configurados.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="col-span-1 bg-bgStart border border-borderDefault rounded-xl p-5 h-fit">
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-accentBlue" />
                    Nuevo Reenvío
                  </h3>
                  <form onSubmit={createForwarder} className="flex flex-col gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-textMuted mb-1">Nombre</label>
                      <input required type="text" value={newForwarder.name} onChange={e => setNewForwarder({...newForwarder, name: e.target.value})} className="w-full p-2 text-sm bg-bgSurface border border-borderDefault rounded text-white" placeholder="Ej: Wialon Backup" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-textMuted mb-1">Target URL</label>
                      <input required type="url" value={newForwarder.target_url} onChange={e => setNewForwarder({...newForwarder, target_url: e.target.value})} className="w-full p-2 text-sm bg-bgSurface border border-borderDefault rounded text-white" placeholder="https://api.wialon.com/..." />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-textMuted mb-1">Autenticación</label>
                      <select value={newForwarder.auth_type} onChange={e => setNewForwarder({...newForwarder, auth_type: e.target.value})} className="w-full p-2 text-sm bg-bgSurface border border-borderDefault rounded text-white">
                        <option value="none">Ninguna</option>
                        <option value="bearer">Bearer Token</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-textMuted mb-1">Formato</label>
                      <select value={newForwarder.payload_format} onChange={e => setNewForwarder({...newForwarder, payload_format: e.target.value})} className="w-full p-2 text-sm bg-bgSurface border border-borderDefault rounded text-white">
                        <option value="rusertech_v1">Rusertech V1 (JSON)</option>
                        <option value="wialon_retranslator">Wialon Retranslator</option>
                      </select>
                    </div>
                    <button type="submit" className="mt-2 w-full py-2 bg-accentBlue text-white font-bold text-sm rounded transition-colors hover:bg-blue-600">
                      Crear Reenvío
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-bgOverlay z-[100] flex items-center justify-center p-4">
          <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-md shadow-card overflow-hidden flex flex-col">
            <div className="p-5 border-b border-borderDefault bg-bgStart flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-accentBlue" />
                Editar Usuario
              </h2>
              <button onClick={() => setEditingUser(null)} className="p-2 text-textMuted hover:text-white rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">Nombre Completo</label>
                <input required type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full p-2 bg-bgStart border border-borderDefault rounded text-white text-sm focus:outline-none focus:border-accentBlue" />
              </div>
              <div>
                <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">Correo Electrónico (No Editable)</label>
                <input disabled type="email" value={editingUser.email} className="w-full p-2 bg-bgStart/50 border border-borderDefault rounded text-textMuted text-sm cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">Rol</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)} className="w-full p-2 bg-bgStart border border-borderDefault rounded text-white text-sm focus:outline-none focus:border-accentBlue">
                  <option value="account_owner">Propietario</option>
                  <option value="manager">Manager</option>
                  <option value="operator">Operador</option>
                  <option value="viewer">Visualizador</option>
                </select>
              </div>

              {editRole === 'viewer' && (
                <div className="mt-2 border-t border-borderDefault pt-4">
                  <label className="block text-xs font-bold text-textSecondary mb-2 uppercase">{t('settings.access_restrictions_viewer')}</label>
                  <p className="text-xs text-textMuted mb-3">{t('settings.access_restrictions_desc')}</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-bgStart border border-borderDefault p-3 rounded h-40 overflow-y-auto">
                      <label className="block text-xs font-bold text-white mb-2">{t('settings.allowed_vehicles')}</label>
                      {allVehicles.map(v => (
                        <label key={v.id} className="flex items-center gap-2 mb-1 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={editEntityRestrictions.vehicles.includes(v.id)}
                            onChange={(e) => {
                              const newV = e.target.checked 
                                ? [...editEntityRestrictions.vehicles, v.id]
                                : editEntityRestrictions.vehicles.filter((id: string) => id !== v.id);
                              setEditEntityRestrictions({ ...editEntityRestrictions, vehicles: newV });
                            }}
                            className="accent-accentBlue"
                          />
                          <span className="text-xs text-textMuted">{v.plate}</span>
                        </label>
                      ))}
                    </div>

                    <div className="bg-bgStart border border-borderDefault p-3 rounded h-40 overflow-y-auto">
                      <label className="block text-xs font-bold text-white mb-2">{t('settings.allowed_locations')}</label>
                      {allLocations.map(l => (
                        <label key={l.id} className="flex items-center gap-2 mb-1 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={editEntityRestrictions.locations.includes(l.id)}
                            onChange={(e) => {
                              const newL = e.target.checked 
                                ? [...editEntityRestrictions.locations, l.id]
                                : editEntityRestrictions.locations.filter((id: string) => id !== l.id);
                              setEditEntityRestrictions({ ...editEntityRestrictions, locations: newL });
                            }}
                            className="accent-accentBlue"
                          />
                          <span className="text-xs text-textMuted">{l.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-borderDefault">
                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-textMuted hover:text-white font-bold text-sm">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-accentBlue hover:bg-blue-600 text-white font-bold text-sm rounded shadow-card transition-colors flex items-center gap-2">
                  <Check className="w-4 h-4" /> Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
