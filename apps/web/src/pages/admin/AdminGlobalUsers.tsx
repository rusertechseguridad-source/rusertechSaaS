import React, { useState, useEffect } from 'react';
import { Users, Search, Edit2, Shield, Check, X, Minus, Pause, Play, Save, Key, RefreshCw, Eye, EyeOff, Copy } from 'lucide-react';
import { PERMISSION_LIST } from '../../constants/permissions';

export const AdminGlobalUsers: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'list' | 'credentials'>('list');
  const [credUsers, setCredUsers] = useState<any[]>([]);
  const [credLoading, setCredLoading] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [searchCred, setSearchCred] = useState('');

  // Edit State
  const [editRoleCode, setEditRoleCode] = useState('');
  const [grantedPerms, setGrantedPerms] = useState<string[]>([]);
  const [revokedPerms, setRevokedPerms] = useState<string[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('rusertech_token');
      const [uRes, rRes] = await Promise.all([
        fetch('http://localhost:3000/api/v1/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:3000/api/v1/admin/roles', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      if (uRes.ok && rRes.ok) {
        setUsers(await uRes.json());
        setRoles(await rRes.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setEditRoleCode(user.role_code);
    setGrantedPerms(user.granted_permissions || []);
    setRevokedPerms(user.revoked_permissions || []);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch(`http://localhost:3000/api/v1/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          role_code: editRoleCode,
          granted_permissions: grantedPerms,
          revoked_permissions: revokedPerms
        })
      });
      if (res.ok) {
        setEditingUser(null);
        fetchData();
      } else {
        alert('Error al guardar el usuario');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    }
  };

  const toggleUserStatus = async (user: any) => {
    try {
      const newStatus = user.status === 'active' ? 'suspended' : 'active';
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch(`http://localhost:3000/api/v1/admin/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchData();
      } else {
        alert('Error al cambiar el estado del usuario');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    }
  };

  const setPermState = (permKey: string, state: 'inherit' | 'grant' | 'revoke') => {
    let newGranted = grantedPerms.filter(k => k !== permKey);
    let newRevoked = revokedPerms.filter(k => k !== permKey);

    if (state === 'grant') newGranted.push(permKey);
    if (state === 'revoke') newRevoked.push(permKey);

    setGrantedPerms(newGranted);
    setRevokedPerms(newRevoked);
  };

  const getPermState = (permKey: string) => {
    if (grantedPerms.includes(permKey)) return 'grant';
    if (revokedPerms.includes(permKey)) return 'revoke';
    return 'inherit';
  };

  const fetchCredentials = async () => {
    setCredLoading(true);
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch('http://localhost:3000/api/v1/admin/users/credentials', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setCredUsers(await res.json());
        setRevealedPasswords({});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCredLoading(false);
    }
  };

  const handleResetPassword = async (userId: string, userEmail: string) => {
    if (!window.confirm(`¿Regenerar contraseña para ${userEmail}? La nueva clave temporal se mostrará aquí.`)) return;
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch(`http://localhost:3000/api/v1/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRevealedPasswords(prev => ({ ...prev, [userId]: data.newPassword }));
        alert(`Contraseña restablecida. Nueva clave: ${data.newPassword}`);
      } else {
        alert('Error al restablecer contraseña');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('¡Copiado al portapapeles!');
  };

  const filteredCreds = credUsers.filter(u =>
    u.email.toLowerCase().includes(searchCred.toLowerCase()) ||
    (u.full_name && u.full_name.toLowerCase().includes(searchCred.toLowerCase()))
  );

  const filtered = users.filter(u => 
    u.email.toLowerCase().includes(search.toLowerCase()) || 
    (u.full_name && u.full_name.toLowerCase().includes(search.toLowerCase())) ||
    (u.tenant?.name && u.tenant.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col">
      <div className="bg-bgSurface border border-borderDefault rounded-xl shadow-card overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-borderDefault flex gap-4 items-center">
          {viewMode === 'list' ? (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
              <input
                type="text"
                placeholder="Buscar por nombre, email o empresa..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-bgStart border border-borderDefault rounded-lg text-white text-sm focus:outline-none focus:border-accentBlue"
              />
            </div>
          ) : (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
              <input
                type="text"
                placeholder="Buscar usuario..."
                value={searchCred}
                onChange={e => setSearchCred(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-bgStart border border-borderDefault rounded-lg text-white text-sm focus:outline-none focus:border-accentBlue"
              />
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${
                viewMode === 'list' ? 'bg-accentBlue text-white' : 'bg-bgStart text-textMuted hover:text-white border border-borderDefault'
              }`}
            >
              <Users className="w-4 h-4" /> Lista de Usuarios
            </button>
            <button
              onClick={() => { setViewMode('credentials'); fetchCredentials(); }}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${
                viewMode === 'credentials' ? 'bg-accentBlue text-white' : 'bg-bgStart text-textMuted hover:text-white border border-borderDefault'
              }`}
            >
              <Key className="w-4 h-4" /> Gestión de Credenciales
            </button>
          </div>
        </div>

        {viewMode === 'credentials' ? (
          <div className="overflow-x-auto flex-1 bg-bgSurface">
            <div className="p-4 bg-yellow-500/5 border-b border-yellow-500/20 flex items-center gap-3">
              <Key className="w-4 h-4 text-yellow-500" />
              <p className="text-yellow-400 text-sm font-bold">Zona Sensible — Solo visible para rusertech_admin. Regenerar contraseña invalida la anterior inmediatamente.</p>
              <button onClick={fetchCredentials} className="ml-auto p-2 text-textMuted hover:text-white rounded transition-colors" title="Refrescar lista"><RefreshCw className="w-4 h-4" /></button>
            </div>
            {credLoading ? (
              <div className="p-8 text-center text-textMuted">Cargando credenciales...</div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-bgStart border-b border-borderDefault text-xs font-bold text-textMuted uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Usuario</th>
                    <th className="px-6 py-4">Empresa</th>
                    <th className="px-6 py-4">Rol</th>
                    <th className="px-6 py-4">Email (User)</th>
                    <th className="px-6 py-4">Último Login</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCreds.map(u => (
                    <tr key={u.id} className="border-b border-borderDefault hover:bg-bgStart/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-white">{u.full_name || 'Sin nombre'}</div>
                        <div className="text-textMuted text-xs">{u.email}</div>
                      </td>
                      <td className="px-6 py-4 text-textSecondary text-sm">{u.tenant?.name || '—'}</td>
                      <td className="px-6 py-4">
                        <span className="bg-accentBlue/10 text-accentBlue border border-accentBlue/30 px-2 py-0.5 rounded text-[10px] uppercase font-bold">
                          {u.role?.name || u.role_code}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="text-accentMint text-xs bg-bgStart px-2 py-1 rounded font-mono">{u.email}</code>
                          <button onClick={() => copyToClipboard(u.email)} className="p-1 text-textMuted hover:text-white transition-colors" title="Copiar email">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        {revealedPasswords[u.id] && (
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-yellow-400 text-xs bg-yellow-400/10 border border-yellow-400/20 px-2 py-1 rounded font-mono">{revealedPasswords[u.id]}</code>
                            <button onClick={() => copyToClipboard(revealedPasswords[u.id])} className="p-1 text-textMuted hover:text-white transition-colors" title="Copiar contraseña">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-textMuted text-xs">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString('es-AR') : 'Nunca'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          u.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                        }`}>{u.status === 'active' ? 'Activo' : 'Suspendido'}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleResetPassword(u.id, u.email)}
                          className="flex items-center gap-1.5 ml-auto px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 rounded text-xs font-bold transition-colors"
                          title="Regenerar contraseña"
                        >
                          <RefreshCw className="w-3 h-3" /> Resetear Clave
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
        <div className="overflow-x-auto flex-1 bg-bgSurface">
          <table className="w-full text-left">
            <thead className="bg-bgStart border-b border-borderDefault text-xs font-bold text-textMuted uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Usuario</th>
                <th className="px-6 py-4">Empresa (Tenant)</th>
                <th className="px-6 py-4">Rol Base</th>
                <th className="px-6 py-4">Permisos Override</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-textMuted">Cargando usuarios globales...</td>
                </tr>
              ) : filtered.map(u => (
                <tr key={u.id} className="border-b border-borderDefault hover:bg-bgStart/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-white">{u.full_name || 'Sin Nombre'}</div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        u.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                        {u.status === 'active' ? 'Activo' : 'Suspendido'}
                      </span>
                    </div>
                    <div className="text-xs text-textMuted">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    {u.tenant ? (
                      <div>
                        <div className="font-bold text-white">{u.tenant.name}</div>
                        <div className="text-xs text-textMuted">@{u.tenant.slug}</div>
                      </div>
                    ) : (
                      <span className="text-statusDanger font-bold text-xs uppercase px-2 py-1 bg-statusDanger/10 rounded">Global (Sin Tenant)</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded text-xs font-bold bg-accentBlue/10 text-accentBlue border border-accentBlue/20 uppercase">
                      {u.role?.name || u.role_code}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {u.granted_permissions?.length > 0 && (
                        <span className="text-xs text-green-400 font-bold">+{u.granted_permissions.length} Adicionales</span>
                      )}
                      {u.revoked_permissions?.length > 0 && (
                        <span className="text-xs text-red-400 font-bold">-{u.revoked_permissions.length} Revocados</span>
                      )}
                      {(!u.granted_permissions?.length && !u.revoked_permissions?.length) && (
                        <span className="text-xs text-textMuted">Solo herencia</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(u)}
                        className="p-2 rounded text-accentBlue hover:bg-accentBlue/20 transition-colors"
                        title="Editar Permisos y Rol"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleUserStatus(u)}
                        className={`p-2 rounded transition-colors ${
                          u.status === 'active' ? 'text-statusDanger hover:bg-statusDanger/20' : 'text-statusOnline hover:bg-statusOnline/20'
                        }`}
                        title={u.status === 'active' ? 'Suspender Usuario' : 'Activar Usuario'}
                      >
                        {u.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-bgOverlay z-[100] flex items-center justify-center p-4">
          <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-4xl shadow-card overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-borderDefault bg-bgStart flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-accentBlue" />
                  Permisos Granulares: {editingUser.full_name || editingUser.email}
                </h2>
                <p className="text-sm text-textMuted mt-1">Modifica el rol base o sobrescribe permisos específicos para este usuario.</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-2 text-textMuted hover:text-white rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              <div>
                <label className="block text-sm font-bold text-textSecondary mb-2 uppercase">Rol Base (Plantilla)</label>
                <select 
                  value={editRoleCode} 
                  onChange={e => setEditRoleCode(e.target.value)}
                  className="w-full max-w-md p-2.5 bg-bgStart border border-borderDefault rounded-lg text-white text-sm"
                >
                  {roles.map(r => (
                    <option key={r.code} value={r.code}>{r.name} ({r.code})</option>
                  ))}
                </select>
                <p className="text-xs text-textMuted mt-2">El usuario heredará todos los permisos de este rol por defecto.</p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-4 border-b border-borderDefault pb-2">Sobrescritura de Permisos (Overrides)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {PERMISSION_LIST.map(perm => {
                    const state = getPermState(perm.key);
                    const selectedRoleObj = roles.find(r => r.code === editRoleCode);
                    const isGrantedInRole = selectedRoleObj?.permissions?.includes(perm.key);
                    
                    // Calculamos el estado final visual
                    let finalStatusText = '';
                    if (state === 'grant') finalStatusText = 'Permitido (Override)';
                    else if (state === 'revoke') finalStatusText = 'Denegado (Override)';
                    else if (isGrantedInRole) finalStatusText = 'Permitido (Heredado)';
                    else finalStatusText = 'Denegado (Por Defecto)';

                    return (
                      <div key={perm.key} className="bg-bgStart border border-borderDefault rounded-lg p-3">
                        <div className="font-bold text-white text-sm">{perm.label}</div>
                        <div className="text-xs text-textMuted mb-3">{finalStatusText}</div>
                        <div className="flex bg-bgSurface rounded-md border border-borderDefault overflow-hidden text-xs">
                          <button 
                            type="button"
                            onClick={() => setPermState(perm.key, 'inherit')}
                            className={`flex-1 py-1.5 flex justify-center items-center gap-1 ${state === 'inherit' ? 'bg-accentBlue text-white font-bold' : 'text-textMuted hover:bg-bgStart'}`}
                            title="Heredar: Mantiene el permiso configurado por defecto en el Rol Base."
                          >
                            <Minus className="w-3 h-3" /> Heredar
                          </button>
                          <button 
                            type="button"
                            onClick={() => setPermState(perm.key, 'grant')}
                            className={`flex-1 py-1.5 flex justify-center items-center gap-1 border-l border-r border-borderDefault ${state === 'grant' ? 'bg-green-600 text-white font-bold' : 'text-textMuted hover:bg-bgStart'}`}
                            title="Permitir: Otorga este permiso al usuario, independientemente de lo que diga el Rol Base."
                          >
                            <Check className="w-3 h-3" /> Permitir
                          </button>
                          <button 
                            type="button"
                            onClick={() => setPermState(perm.key, 'revoke')}
                            className={`flex-1 py-1.5 flex justify-center items-center gap-1 ${state === 'revoke' ? 'bg-red-600 text-white font-bold' : 'text-textMuted hover:bg-bgStart'}`}
                            title="Denegar: Bloquea este permiso al usuario, independientemente de lo que diga el Rol Base."
                          >
                            <X className="w-3 h-3" /> Denegar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-borderDefault bg-bgStart flex justify-end gap-3 shrink-0">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-textMuted hover:text-white font-bold text-sm">Cancelar</button>
              <button onClick={handleSaveUser} className="px-6 py-2 bg-accentBlue hover:bg-blue-600 text-white font-bold text-sm rounded shadow-card transition-colors flex items-center gap-2">
                <Save className="w-4 h-4" /> Guardar Permisos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
