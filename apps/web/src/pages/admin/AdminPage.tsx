import React, { useEffect, useState } from 'react';
import { ShieldCheck, Plus, Search, Building, Users, Play, Pause, Activity, Shield, Edit2, X, Check, ArrowUpDown } from 'lucide-react';
import { AdminGlobalUsers } from './AdminGlobalUsers';
import { AdminRolesPermissions } from './AdminRolesPermissions';

export const AdminPage: React.FC = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'tenants' | 'users' | 'roles'>('tenants');

  // Sorting
  const [sortColumn, setSortColumn] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const [userSortColumn, setUserSortColumn] = useState<string>('full_name');
  const [userSortDirection, setUserSortDirection] = useState<'asc' | 'desc'>('asc');

  // Form
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [plan, setPlan] = useState('starter');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminFullName, setAdminFullName] = useState('');

  // Edit Form
  const [editingTenant, setEditingTenant] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [editingTenantUsers, setEditingTenantUsers] = useState<any[]>([]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch('http://localhost:3000/api/v1/admin/tenants', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setTenants(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch('http://localhost:3000/api/v1/admin/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name, slug, plan, adminEmail, adminFullName })
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.message || 'Error al crear');
        return;
      }
      alert('Tenant creado. Revisa la consola del backend para la contraseña temporal.');
      setShowModal(false);
      fetchTenants();
    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    }
  };

  const toggleSuspend = async (id: string, currentlyActive: boolean) => {
    if (!window.confirm(`¿Seguro que deseas ${currentlyActive ? 'suspender' : 'activar'} a esta empresa?`)) return;
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch(`http://localhost:3000/api/v1/admin/tenants/${id}/suspend`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ suspend: currentlyActive })
      });
      if (res.ok) {
        fetchTenants();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch(`http://localhost:3000/api/v1/admin/tenants/${editingTenant.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: editName, slug: editSlug, plan: editPlan })
      });
      if (res.ok) {
        setEditingTenant(null);
        fetchTenants();
      } else {
        const errData = await res.json();
        alert(errData.message || 'Error al actualizar el tenant');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    }
  };

  const loadTenantUsers = async (tenantId: string) => {
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch(`http://localhost:3000/api/v1/admin/tenants/${tenantId}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setEditingTenantUsers(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTenantUserSuspend = async (userId: string, currentStatus: string) => {
    if (!window.confirm(`¿Seguro que deseas ${currentStatus === 'active' ? 'suspender' : 'activar'} este usuario?`)) return;
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch(`http://localhost:3000/api/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: currentStatus === 'active' ? 'suspended' : 'active' })
      });
      if (res.ok) {
        if (editingTenant) loadTenantUsers(editingTenant.id);
      } else {
        alert('Error al cambiar el estado del usuario');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = tenants.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.toLowerCase().includes(search.toLowerCase()));

  const sortedTenants = [...filtered].sort((a, b) => {
    let valA = '';
    let valB = '';
    
    if (sortColumn === 'name') {
      valA = a.name.toLowerCase();
      valB = b.name.toLowerCase();
    } else if (sortColumn === 'status') {
      valA = a.status;
      valB = b.status;
    } else if (sortColumn === 'plan') {
      valA = a.plan;
      valB = b.plan;
    } else if (sortColumn === 'users') {
      valA = a.user_count?.toString() || '0';
      valB = b.user_count?.toString() || '0';
    } else if (sortColumn === 'vehicles') {
      valA = a.vehicle_count?.toString() || '0';
      valB = b.vehicle_count?.toString() || '0';
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

  const sortedTenantUsers = [...editingTenantUsers].sort((a, b) => {
    let valA = '';
    let valB = '';
    
    if (userSortColumn === 'full_name') {
      valA = a.full_name || a.email || '';
      valB = b.full_name || b.email || '';
    } else if (userSortColumn === 'role') {
      valA = a.role_code || '';
      valB = b.role_code || '';
    } else if (userSortColumn === 'status') {
      valA = a.status || '';
      valB = b.status || '';
    }
    
    if (valA < valB) return userSortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return userSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleUserSort = (column: string) => {
    if (userSortColumn === column) {
      setUserSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setUserSortColumn(column);
      setUserSortDirection('asc');
    }
  };

  return (
    <div className="p-8 h-full w-full flex flex-col">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 
            className="text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-accentGreen to-accentBlue tracking-wider flex items-center"
            style={{ textShadow: '0 0 10px rgba(42,179,255,0.3)', animation: 'pulse 3s infinite' }}
          >
            <ShieldCheck className="w-8 h-8 mr-3 text-accentGreen" />
            Panel Super Admin
          </h1>
          <p className="text-textMuted mt-2">Gestión global de empresas y subscripciones</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-accentGreen hover:bg-accentGreen/90 text-bgStart px-4 py-2 rounded font-bold flex items-center shadow-lg shadow-accentGreen/20 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" /> Nuevo Cliente
        </button>
      </div>

      {/* TABS NAVEGACIÓN */}
      <div className="flex gap-4 border-b border-borderDefault mb-6 shrink-0">
        <button 
          onClick={() => setActiveTab('tenants')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'tenants' ? 'border-accentBlue text-white' : 'border-transparent text-textMuted hover:text-white'}`}
        >
          <Building className="w-4 h-4 inline mr-2" /> Empresas (Tenants)
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'users' ? 'border-accentBlue text-white' : 'border-transparent text-textMuted hover:text-white'}`}
        >
          <Users className="w-4 h-4 inline mr-2" /> Usuarios Globales
        </button>
        <button 
          onClick={() => setActiveTab('roles')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'roles' ? 'border-accentBlue text-white' : 'border-transparent text-textMuted hover:text-white'}`}
        >
          <Shield className="w-4 h-4 inline mr-2" /> Roles y Permisos
        </button>
      </div>

      {activeTab === 'tenants' && (
        <div className="bg-bgSurface border border-borderDefault rounded-xl shadow-card overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-borderDefault flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
            <input
              type="text"
              placeholder="Buscar cliente por nombre o slug..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-bgStart border border-borderDefault rounded-lg text-white text-sm focus:outline-none focus:border-accentBlue transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto flex-1 bg-bgSurface">
          <table className="w-full text-left">
            <thead className="bg-bgStart border-b border-borderDefault text-xs font-bold text-textMuted uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-2">Empresa / Slug <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-2">Estado <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('plan')}>
                  <div className="flex items-center gap-2">Plan <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('users')}>
                  <div className="flex items-center gap-2">Usuarios <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('vehicles')}>
                  <div className="flex items-center gap-2">Vehículos <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-textMuted">Cargando...</td>
                </tr>
              ) : sortedTenants.map(t => (
                <tr key={t.id} className="border-b border-borderDefault hover:bg-bgStart/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-bgStart border border-borderDefault flex items-center justify-center">
                        <Building className="w-5 h-5 text-textSecondary" />
                      </div>
                      <div>
                        <div className="font-bold text-white">{t.name}</div>
                        <div className="text-xs text-textMuted">@{t.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                      t.status === 'active' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                    }`}>
                      {t.status === 'active' ? 'ACTIVO' : 'SUSPENDIDO'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-textSecondary uppercase">{t.plan}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm text-textSecondary">
                      <Users className="w-4 h-4" /> {t._count?.users || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm text-textSecondary">
                      <Activity className="w-4 h-4" /> {t._count?.vehicles || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingTenant(t);
                          setEditName(t.name);
                          setEditSlug(t.slug);
                          setEditPlan(t.plan);
                          loadTenantUsers(t.id);
                        }}
                        className="p-2 rounded text-accentBlue hover:bg-accentBlue/20 transition-colors"
                        title="Editar Empresa"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleSuspend(t.id, t.status === 'active')}
                        className={`p-2 rounded transition-colors ${t.status !== 'active' ? 'text-statusOnline hover:bg-statusOnline/20 hover:text-white' : 'text-statusDanger hover:bg-statusDanger/20 hover:text-white'}`}
                        title={t.status === 'active' ? 'Suspender' : 'Activar'}
                      >
                        {t.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-statusOnline" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {activeTab === 'users' && <AdminGlobalUsers />}
      {activeTab === 'roles' && <AdminRolesPermissions />}

      {showModal && (
        <div className="fixed inset-0 bg-bgOverlay z-[100] flex items-center justify-center p-4">
          <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-lg shadow-card overflow-hidden flex flex-col">
            <div className="p-5 border-b border-borderDefault bg-bgStart">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-accentBlue" />
                Alta de Cliente (Tenant)
              </h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">Razón Social / Nombre</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 bg-bgStart border border-borderDefault rounded text-white text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">Identificador (Slug)</label>
                  <input required type="text" value={slug} onChange={e => setSlug(e.target.value)} placeholder="mi-empresa" className="w-full p-2 bg-bgStart border border-borderDefault rounded text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">Plan</label>
                  <select value={plan} onChange={e => setPlan(e.target.value)} className="w-full p-2 bg-bgStart border border-borderDefault rounded text-white text-sm">
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 border-t border-borderDefault/50">
                <h3 className="text-sm font-bold text-white mb-3">Datos del Account Owner</h3>
                <div>
                  <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">Nombre Completo</label>
                  <input required type="text" value={adminFullName} onChange={e => setAdminFullName(e.target.value)} className="w-full p-2 bg-bgStart border border-borderDefault rounded text-white text-sm mb-4" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">Correo Electrónico</label>
                  <input required type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} className="w-full p-2 bg-bgStart border border-borderDefault rounded text-white text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-textMuted hover:text-white font-bold text-sm">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-accentBlue hover:bg-blue-600 text-white font-bold text-sm rounded shadow-card transition-colors">Dar de Alta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingTenant && (
        <div className="fixed inset-0 bg-bgOverlay z-[100] flex items-center justify-center p-4">
          <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-2xl shadow-card overflow-hidden flex flex-col">
            <div className="p-5 border-b border-borderDefault bg-bgStart flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-accentBlue" />
                Editar Empresa (Tenant)
              </h2>
              <button onClick={() => setEditingTenant(null)} className="p-2 text-textMuted hover:text-white rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateTenant} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">Razón Social / Nombre</label>
                <input required type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full p-2 bg-bgStart border border-borderDefault rounded text-white text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">Identificador (Slug)</label>
                  <input required type="text" value={editSlug} onChange={e => setEditSlug(e.target.value)} className="w-full p-2 bg-bgStart border border-borderDefault rounded text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">Plan</label>
                  <select value={editPlan} onChange={e => setEditPlan(e.target.value)} className="w-full p-2 bg-bgStart border border-borderDefault rounded text-white text-sm">
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-borderDefault">
                <button type="button" onClick={() => setEditingTenant(null)} className="px-4 py-2 text-textMuted hover:text-white font-bold text-sm">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-accentBlue hover:bg-blue-600 text-white font-bold text-sm rounded shadow-card transition-colors flex items-center gap-2">
                  <Check className="w-4 h-4" /> Guardar
                </button>
              </div>
            </form>

            <div className="p-6 pt-0 border-t border-borderDefault/50">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-accentBlue" />
                Usuarios de la Empresa ({editingTenantUsers.length})
              </h3>
              <div className="max-h-40 overflow-y-auto bg-bgStart border border-borderDefault rounded-lg">
                {editingTenantUsers.length === 0 ? (
                  <div className="p-4 text-center text-textMuted text-xs">No hay usuarios registrados</div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-bgSurface text-textMuted font-bold uppercase sticky top-0">
                      <tr>
                        <th className="px-4 py-2 cursor-pointer hover:text-white transition-colors" onClick={() => handleUserSort('full_name')}>
                          <div className="flex items-center gap-2">Nombre / Email <ArrowUpDown className="w-3 h-3" /></div>
                        </th>
                        <th className="px-4 py-2 cursor-pointer hover:text-white transition-colors" onClick={() => handleUserSort('role')}>
                          <div className="flex items-center gap-2">Rol <ArrowUpDown className="w-3 h-3" /></div>
                        </th>
                        <th className="px-4 py-2 cursor-pointer hover:text-white transition-colors" onClick={() => handleUserSort('status')}>
                          <div className="flex items-center gap-2">Estado <ArrowUpDown className="w-3 h-3" /></div>
                        </th>
                        <th className="px-4 py-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTenantUsers.map(u => (
                        <tr key={u.id} className="border-t border-borderDefault hover:bg-bgSurface transition-colors">
                          <td className="px-4 py-2">
                            <div className="font-bold text-white">{u.full_name || 'Sin nombre'}</div>
                            <div className="text-textMuted">{u.email}</div>
                          </td>
                          <td className="px-4 py-2">
                            <span className="bg-bgSurface border border-borderDefault px-2 py-0.5 rounded text-[10px] uppercase font-bold text-textSecondary">
                              {u.role_code || 'Sin rol'}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                              u.status === 'active' ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-red-500/10 border-red-500/30 text-red-500'
                            }`}>
                              {u.status === 'active' ? 'ACTIVO' : 'SUSPENDIDO'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => toggleTenantUserSuspend(u.id, u.status)}
                                className={`p-1.5 rounded transition-colors ${
                                  u.status === 'active' 
                                    ? 'text-statusDanger hover:bg-red-500/20' 
                                    : 'text-statusSuccess hover:bg-green-500/20'
                                }`}
                                title={u.status === 'active' ? 'Suspender Usuario' : 'Activar Usuario'}
                              >
                                {u.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('users');
                                  setEditingTenant(null);
                                  setSearch(u.email);
                                }}
                                className="p-1.5 text-accentBlue hover:bg-accentBlue/20 rounded transition-colors"
                                title="Editar en Usuarios Globales"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
