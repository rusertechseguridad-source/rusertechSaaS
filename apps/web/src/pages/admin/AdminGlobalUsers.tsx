import React, { useState, useEffect } from 'react';
import { Search, Edit2, Shield, Check, X, Minus, Pause, Play, Save, Key, RefreshCw, Copy, ArrowUpDown } from 'lucide-react';
import { PERMISSION_LIST } from '../../constants/permissions';
import { useTranslation } from 'react-i18next';
import { translateRole } from '../../utils/labels';
import { avisar } from '../../services/avisos';

export const AdminGlobalUsers: React.FC = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [roleFilter, setRoleFilter] = useState('');
  
  // Sorting State
  const [sortColumn, setSortColumn] = useState<string>('full_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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
        
        let fetchedRoles = await rRes.json();
        const roleOrder = ['rusertech_admin', 'account_owner', 'manager', 'operator', 'viewer', 'driver'];
        fetchedRoles.sort((a: any, b: any) => {
          let idxA = roleOrder.indexOf(a.code);
          let idxB = roleOrder.indexOf(b.code);
          if (idxA === -1) idxA = 999;
          if (idxB === -1) idxB = 999;
          return idxA - idxB;
        });
        setRoles(fetchedRoles);
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
        avisar.error(t('admin.error_save'));
      }
    } catch (err) {
      console.error(err);
      avisar.error(t('admin.error_connection'));
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
        avisar.error(t('admin.error_status'));
      }
    } catch (err) {
      console.error(err);
      avisar.error(t('admin.error_connection'));
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



  const handleResetPassword = async (userId: string, userEmail: string) => {
    if (!window.confirm(t('admin.prompt_reset').replace('{{email}}', userEmail))) return;
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch(`http://localhost:3000/api/v1/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRevealedPasswords(prev => ({ ...prev, [userId]: data.newPassword }));
        avisar.exito(t('admin.reset_success').replace('{{password}}', data.newPassword));
      } else {
        avisar.error(t('admin.error_reset'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    avisar.exito(t('admin.copied'));
  };

  const filtered = users.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(search.toLowerCase()) || 
      (u.full_name && u.full_name.toLowerCase().includes(search.toLowerCase())) ||
      (u.tenant?.name && u.tenant.name.toLowerCase().includes(search.toLowerCase()));
    const matchesRole = roleFilter === '' || u.role_code === roleFilter;
    return matchesSearch && matchesRole;
  });

  const sortedUsers = [...filtered].sort((a, b) => {
    let valA = '';
    let valB = '';
    
    if (sortColumn === 'full_name') {
      valA = a.full_name || a.email || '';
      valB = b.full_name || b.email || '';
    } else if (sortColumn === 'tenant') {
      valA = a.tenant?.name || '';
      valB = b.tenant?.name || '';
    } else if (sortColumn === 'role') {
      valA = a.role?.name || a.role_code || '';
      valB = b.role?.name || b.role_code || '';
    }
    
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-bgSurface border border-borderDefault rounded-xl shadow-card overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-borderDefault flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
            <input
              type="text"
              placeholder={t('admin.search_placeholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-bgStart border border-borderDefault rounded-lg text-white text-sm focus:outline-none focus:border-accentGreen"
            />
          </div>
          
          <div className="flex-1 max-w-xs">
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="w-full px-4 py-2 bg-bgStart border border-borderDefault rounded-lg text-white text-sm focus:outline-none focus:border-accentGreen"
            >
              <option value="">{t('admin.all_roles')}</option>
              {roles.map(r => (
                <option key={r.code} value={r.code}>{translateRole(r.name)}</option>
              ))}
            </select>
          </div>
        </div>


        <div className="overflow-x-auto flex-1 bg-bgSurface">
          <table className="w-full text-left">
            <thead className="bg-bgStart border-b border-borderDefault text-xs font-bold text-textMuted uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('full_name')}>
                  <div className="flex items-center gap-2">{t('admin.user_col')} <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('tenant')}>
                  <div className="flex items-center gap-2">{t('admin.tenant_col')} <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('role')}>
                  <div className="flex items-center gap-2">{t('admin.role_col')} <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-6 py-4">{t('admin.overrides_col')}</th>
                <th className="px-6 py-4 text-right">{t('admin.actions_col')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-textMuted">{t('admin.loading')}</td>
                </tr>
              ) : sortedUsers.map(u => (
                <tr key={u.id} className="border-b border-borderDefault hover:bg-bgStart/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-white">{u.full_name || t('admin.no_name')}</div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        u.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                        {u.status === 'active' ? t('admin.active') : t('admin.suspended')}
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
                      <span className="text-statusDanger font-bold text-xs uppercase px-2 py-1 bg-statusDanger/10 rounded">{t('admin.global_no_tenant')}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded text-xs font-bold bg-accentGreen/10 text-accentGreen border border-accentGreen/20 uppercase">
                      {translateRole(u.role?.name || u.role_code)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {u.granted_permissions?.length > 0 && (
                        <span className="text-xs text-green-400 font-bold">+{u.granted_permissions.length} {t('admin.additional')}</span>
                      )}
                      {u.revoked_permissions?.length > 0 && (
                        <span className="text-xs text-red-400 font-bold">-{u.revoked_permissions.length} {t('admin.revoked')}</span>
                      )}
                      {(!u.granted_permissions?.length && !u.revoked_permissions?.length) && (
                        <span className="text-xs text-textMuted">{t('admin.inheritance_only')}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(u)}
                        className="p-2 rounded text-accentGreen hover:bg-accentGreen/20 transition-colors"
                        title={t('admin.edit_perms')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleUserStatus(u)}
                        className={`p-2 rounded transition-colors ${
                          u.status === 'active' ? 'text-statusDanger hover:bg-statusDanger/20' : 'text-statusOnline hover:bg-statusOnline/20'
                        }`}
                        title={u.status === 'active' ? t('admin.suspend_user') : t('admin.activate_user')}
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

      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-bgOverlay z-[100] flex items-center justify-center p-4">
          <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-4xl shadow-card overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-borderDefault bg-bgStart flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-accentGreen" />
                  {t('admin.modal_title')}{editingUser.full_name || editingUser.email}
                </h2>
                <p className="text-sm text-textMuted mt-1">{t('admin.modal_subtitle')}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-2 text-textMuted hover:text-white rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-textSecondary mb-2 uppercase">{t('admin.base_role_label')}</label>
                  <select 
                    value={editRoleCode} 
                    onChange={e => setEditRoleCode(e.target.value)}
                    className="w-full p-2.5 bg-bgStart border border-borderDefault rounded-lg text-white text-sm"
                  >
                    {roles.map(r => (
                      <option key={r.code} value={r.code}>{translateRole(r.name)} ({r.code})</option>
                    ))}
                  </select>
                  <p className="text-xs text-textMuted mt-2">{t('admin.base_role_help')}</p>
                </div>

                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2">
                    <Key className="w-4 h-4 text-yellow-500" />
                    <label className="text-sm font-bold text-yellow-400 uppercase">{t('admin.credentials_title')}</label>
                  </div>
                  <p className="text-xs text-white/80 mb-3">{t('admin.credentials_help')}</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleResetPassword(editingUser.id, editingUser.email)}
                      className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" /> {t('admin.regenerate_pwd')}
                    </button>
                    {revealedPasswords[editingUser.id] && (
                      <div className="flex items-center gap-2">
                        <code className="text-yellow-400 text-sm bg-yellow-400/10 border border-yellow-400/20 px-3 py-1.5 rounded-lg font-mono">
                          {revealedPasswords[editingUser.id]}
                        </code>
                        <button onClick={() => copyToClipboard(revealedPasswords[editingUser.id])} className="p-2 text-textMuted hover:text-white transition-colors bg-bgStart rounded-lg" title={t('admin.copy_pwd')}>
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-4 border-b border-borderDefault pb-2">{t('admin.overrides_title')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {PERMISSION_LIST.map(perm => {
                    const state = getPermState(perm.key);
                    const selectedRoleObj = roles.find(r => r.code === editRoleCode);
                    const isGrantedInRole = selectedRoleObj?.permissions?.includes(perm.key);
                    
                    let finalStatusText = '';
                    if (state === 'grant') finalStatusText = t('admin.perm_granted');
                    else if (state === 'revoke') finalStatusText = t('admin.perm_revoked');
                    else if (isGrantedInRole) finalStatusText = t('admin.perm_inherited');
                    else finalStatusText = t('admin.perm_default');

                    return (
                      <div key={perm.key} className="bg-bgStart border border-borderDefault rounded-lg p-3">
                        <div className="font-bold text-white text-sm">{perm.label}</div>
                        <div className="text-xs text-textMuted mb-3">{finalStatusText}</div>
                        <div className="flex bg-bgSurface rounded-md border border-borderDefault overflow-hidden text-xs">
                          <button 
                            type="button"
                            onClick={() => setPermState(perm.key, 'inherit')}
                            className={`flex-1 py-1.5 flex justify-center items-center gap-1 ${state === 'inherit' ? 'bg-accentGreen text-white font-bold' : 'text-textMuted hover:bg-bgStart'}`}
                            title={t('admin.inherit_help')}
                          >
                            <Minus className="w-3 h-3" /> {t('admin.inherit_btn')}
                          </button>
                          <button 
                            type="button"
                            onClick={() => setPermState(perm.key, 'grant')}
                            className={`flex-1 py-1.5 flex justify-center items-center gap-1 border-l border-r border-borderDefault ${state === 'grant' ? 'bg-green-600 text-white font-bold' : 'text-textMuted hover:bg-bgStart'}`}
                            title={t('admin.grant_help')}
                          >
                            <Check className="w-3 h-3" /> {t('admin.grant_btn')}
                          </button>
                          <button 
                            type="button"
                            onClick={() => setPermState(perm.key, 'revoke')}
                            className={`flex-1 py-1.5 flex justify-center items-center gap-1 ${state === 'revoke' ? 'bg-red-600 text-white font-bold' : 'text-textMuted hover:bg-bgStart'}`}
                            title={t('admin.revoke_help')}
                          >
                            <X className="w-3 h-3" /> {t('admin.revoke_btn')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-borderDefault bg-bgStart flex justify-end gap-3 shrink-0">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-textMuted hover:text-white font-bold text-sm">{t('admin.cancel')}</button>
              <button onClick={handleSaveUser} className="px-6 py-2 bg-accentGreen hover:bg-green-600 text-white font-bold text-sm rounded shadow-card transition-colors flex items-center gap-2">
                <Save className="w-4 h-4" /> {t('admin.save_perms')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
