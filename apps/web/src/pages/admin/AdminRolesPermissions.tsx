import React, { useState, useEffect } from 'react';
import { Plus, Shield, Check, Search, Save } from 'lucide-react';
import { PERMISSION_LIST } from '../../constants/permissions';
import { useTranslation } from 'react-i18next';
import { translateRole } from '../../utils/labels';

export const AdminRolesPermissions: React.FC = () => {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [newRoleCode, setNewRoleCode] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch('http://localhost:3000/api/v1/admin/roles', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        let fetchedRoles = await res.json();
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
    fetchRoles();
  }, []);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch('http://localhost:3000/api/v1/admin/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: newRoleCode, name: newRoleName, permissions: [] })
      });
      if (res.ok) {
        setShowModal(false);
        setNewRoleCode('');
        setNewRoleName('');
        fetchRoles();
      } else {
        const error = await res.json();
        alert(error.message || 'Error al crear rol');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const togglePermission = async (permissionKey: string) => {
    if (!selectedRole) return;
    
    let currentPerms = [...(selectedRole.permissions || [])];
    if (currentPerms.includes(permissionKey)) {
      currentPerms = currentPerms.filter(p => p !== permissionKey);
    } else {
      currentPerms.push(permissionKey);
    }

    setSelectedRole({ ...selectedRole, permissions: currentPerms });
  };

  const handleSaveRole = async () => {
    if (!selectedRole) return;
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch(`http://localhost:3000/api/v1/admin/roles/${selectedRole.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: selectedRole.name, permissions: selectedRole.permissions })
      });
      if (res.ok) {
        setRoles(roles.map(r => r.id === selectedRole.id ? selectedRole : r));
        alert(t('admin_roles.save_success'));
      } else {
        alert(t('admin_roles.save_error'));
      }
    } catch (err) {
      console.error(err);
      alert(t('admin_roles.error_conn'));
    }
  };

  const filteredPermissions = PERMISSION_LIST.filter(p => 
    p.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-full gap-6">
      {/* Lista de Roles */}
      <div className="w-1/3 bg-bgSurface border border-borderDefault rounded-xl shadow-card overflow-hidden flex flex-col min-h-0">
        <div className="p-4 border-b border-borderDefault flex justify-between items-center bg-bgStart">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-accentGreen" /> {t('admin_roles.title')}
          </h2>
          <button onClick={() => setShowModal(true)} className="p-1.5 bg-accentGreen/20 text-accentGreen hover:bg-accentGreen hover:text-white rounded transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {loading ? (
            <p className="text-textMuted text-sm">{t('common.loading')}</p>
          ) : roles.map(role => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selectedRole?.id === role.id 
                  ? 'bg-accentGreen/10 border-accentGreen/50 text-white' 
                  : 'bg-bgStart border-borderDefault text-textSecondary hover:border-borderHighlight'
              }`}
            >
              <div className="font-bold">{translateRole(role.name)}</div>
              <div className="text-xs opacity-70"><code>{role.code}</code></div>
              {role.is_system_role && (
                <span className="inline-block mt-1 px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 text-[10px] uppercase font-bold rounded">{t('admin_roles.system')}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Permisos del Rol Seleccionado */}
      <div className="flex-1 bg-bgSurface border border-borderDefault rounded-xl shadow-card overflow-hidden flex flex-col min-h-0">
        {selectedRole ? (
          <>
            <div className="p-4 border-b border-borderDefault bg-bgStart flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {t('admin_roles.perms_title')} <span className="text-accentGreen">{translateRole(selectedRole.name)}</span>
                </h2>
                <p className="text-textMuted text-sm mt-1">{t('admin_roles.subtitle')}</p>
                
                <div className="mt-4 relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
                  <input
                    type="text"
                    placeholder={t('admin_roles.search')}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-bgSurface border border-borderDefault rounded text-white text-sm focus:outline-none focus:border-accentGreen"
                  />
                </div>
              </div>
              <button 
                onClick={handleSaveRole}
                className="px-6 py-2 bg-accentGreen hover:bg-green-600 text-white font-bold text-sm rounded shadow-card transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> {t('admin_roles.save')}
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredPermissions.map(perm => {
                  const isAdminGlobalPerm = perm.key === 'admin_global';
                  const isRusertechAdmin = selectedRole.code === 'rusertech_admin';
                  
                  // If it's the admin_global perm, force it ON for rusertech_admin, OFF for others.
                  const hasPerm = isAdminGlobalPerm ? isRusertechAdmin : selectedRole.permissions?.includes(perm.key);
                  const isDisabled = isAdminGlobalPerm;

                  return (
                    <div 
                      key={perm.key}
                      onClick={() => {
                        if (!isDisabled) togglePermission(perm.key);
                      }}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                      } ${
                        hasPerm 
                          ? 'bg-green-500/10 border-green-500/30' 
                          : 'bg-bgStart border-borderDefault hover:border-borderHighlight'
                      }`}
                    >
                      <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded flex items-center justify-center border ${
                        hasPerm ? 'bg-green-500 border-green-500 text-bgStart' : 'bg-transparent border-textMuted text-transparent'
                      }`}>
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className={`text-sm font-bold ${hasPerm ? 'text-white' : 'text-textSecondary'}`}>
                          {perm.label}
                        </div>
                        <div className="text-xs text-textMuted mt-0.5">{perm.key}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-textMuted">
            <Shield className="w-16 h-16 opacity-20 mb-4" />
            <p>{t('admin_roles.empty_state')}</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-bgOverlay z-[100] flex items-center justify-center p-4">
          <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-sm shadow-card overflow-hidden">
            <div className="p-4 border-b border-borderDefault bg-bgStart">
              <h2 className="text-lg font-bold text-white">{t('admin_roles.new_role')}</h2>
            </div>
            <form onSubmit={handleCreateRole} className="p-4 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">{t('admin_roles.form_code')}</label>
                <input required type="text" value={newRoleCode} onChange={e => setNewRoleCode(e.target.value)} placeholder="ej. analista_datos" className="w-full p-2 bg-bgStart border border-borderDefault rounded text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">{t('admin_roles.form_name')}</label>
                <input required type="text" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="Analista de Datos" className="w-full p-2 bg-bgStart border border-borderDefault rounded text-white text-sm" />
              </div>
              <div className="flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-textMuted hover:text-white font-bold text-sm">{t('admin_roles.cancel')}</button>
                <button type="submit" className="px-4 py-2 bg-accentGreen hover:bg-green-600 text-white font-bold text-sm rounded">{t('admin_roles.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
