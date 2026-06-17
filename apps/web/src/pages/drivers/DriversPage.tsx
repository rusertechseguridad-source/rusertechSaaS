import React, { useEffect, useState } from 'react';
import { Users, Search, UserCheck, UserX, UserPlus } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';

import { DriverModal } from './DriverModal';
import { exportToCsv } from '../../utils/export';
import { Download } from 'lucide-react';

export const DriversPage: React.FC = () => {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [driverToEdit, setDriverToEdit] = useState<any>(null);
  const [search, setSearch] = useState('');

  const fetchDrivers = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/drivers', {
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` }
      });
      if (!res.ok) throw new Error('Error al cargar choferes');
      setDrivers(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    if (!confirm(`¿Estás seguro de ${currentStatus === 'active' ? 'suspender' : 'reactivar'} este chofer?`)) return;
    
    try {
      const res = await fetch(`http://localhost:3000/api/v1/drivers/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` 
        },
        body: JSON.stringify({ status: currentStatus === 'active' ? 'suspended' : 'active' })
      });
      if (!res.ok) throw new Error('Error al actualizar estado');
      await fetchDrivers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExport = () => {
    const headers = ['Nombre Completo', 'Documento', 'Teléfono', 'Email', 'Nacionalidad', 'Estado'];
    const rows = drivers.map(d => [
      d.full_name,
      d.document || '',
      d.phone || '',
      d.email || '',
      d.nationality || '',
      d.status === 'active' ? 'Activo' : 'Suspendido'
    ]);
    exportToCsv('Choferes', headers, rows);
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  if (loading) return <div className="p-8 text-center text-textMuted">Cargando Choferes...</div>;
  if (error) return <div className="p-8 text-center text-statusDanger">{error}</div>;

  return (
    <div className="p-8 w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 
            className="text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-accentBlue to-accentMint tracking-wider flex items-center"
            style={{ textShadow: '0 0 10px rgba(42,179,255,0.3)', animation: 'pulse 3s infinite' }}
          >
            <Users className="w-8 h-8 mr-3 text-accentBlue" />
            Choferes
          </h1>
          <p className="text-textMuted mt-2">Gestiona el personal de conducción y sus asignaciones.</p>
        </div>
        <RequirePermission permission="drivers:edit">
          <button 
            onClick={() => { setDriverToEdit(null); setShowModal(true); }}
            className="px-6 py-2 bg-accentGreen text-bgStart font-medium rounded-lg shadow-sm hover:bg-accentGreen/90 transition flex items-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            <span>Nuevo Chofer</span>
          </button>
        </RequirePermission>
      </div>

      <DriverModal 
        isOpen={showModal} 
        onClose={() => { setShowModal(false); setDriverToEdit(null); }} 
        onSaved={fetchDrivers}
        driverToEdit={driverToEdit}
      />

      {(() => {
        const filtered = drivers.filter(d => 
          d.full_name.toLowerCase().includes(search.toLowerCase()) || 
          (d.document && d.document.toLowerCase().includes(search.toLowerCase()))
        );
        const totalDrivers = drivers.length;
        const activeDrivers = drivers.filter(d => d.status === 'active').length;
        const suspendedDrivers = totalDrivers - activeDrivers;

        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 shrink-0">
              <div className="bg-bgSurface border border-borderDefault rounded-xl p-4 shadow-card flex items-center justify-between">
                <div>
                  <div className="text-textMuted text-xs font-bold uppercase tracking-wider mb-1">Total Choferes</div>
                  <div className="text-3xl font-display font-black text-white">{totalDrivers}</div>
                </div>
                <div className="w-12 h-12 rounded-full bg-accentBlue/10 flex items-center justify-center border border-accentBlue/20">
                  <Users className="w-6 h-6 text-accentBlue" />
                </div>
              </div>
              <div className="bg-bgSurface border border-borderDefault rounded-xl p-4 shadow-card flex items-center justify-between">
                <div>
                  <div className="text-textMuted text-xs font-bold uppercase tracking-wider mb-1">Choferes Activos</div>
                  <div className="text-3xl font-display font-black text-white">{activeDrivers}</div>
                </div>
                <div className="w-12 h-12 rounded-full bg-statusOnline/10 flex items-center justify-center border border-statusOnline/20">
                  <UserCheck className="w-6 h-6 text-statusOnline" />
                </div>
              </div>
              <div className="bg-bgSurface border border-borderDefault rounded-xl p-4 shadow-card flex items-center justify-between">
                <div>
                  <div className="text-textMuted text-xs font-bold uppercase tracking-wider mb-1">Suspendidos</div>
                  <div className="text-3xl font-display font-black text-white">{suspendedDrivers}</div>
                </div>
                <div className="w-12 h-12 rounded-full bg-statusDanger/10 flex items-center justify-center border border-statusDanger/20">
                  <UserX className="w-6 h-6 text-statusDanger" />
                </div>
              </div>
            </div>

            <div className="bg-bgSurface border border-borderDefault rounded-xl overflow-hidden shadow-card flex flex-col min-h-0 flex-1">
              <div className="p-4 border-b border-borderDefault flex justify-between items-center bg-bgStart/50 shrink-0">
                <div className="relative w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o documento..."
                    className="w-full bg-bgStart border border-borderDefault rounded-lg pl-10 pr-4 py-2 text-textPrimary focus:border-accentBlue focus:outline-none"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-textSecondary text-sm">{filtered.length} choferes encontrados</span>
                  <button 
                    onClick={handleExport}
                    className="flex items-center gap-2 bg-bgSurface/80 hover:bg-bgSurfaceHigh text-white px-4 py-1.5 text-sm rounded-lg border border-borderDefault transition-colors"
                  >
                    <Download size={16} className="text-accentBlue" />
                    Exportar CSV
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1">
                {filtered.length === 0 ? (
                  <div className="p-12 text-center text-textMuted">No hay choferes que coincidan con la búsqueda.</div>
                ) : (
                  <table className="w-full text-left text-sm text-textSecondary">
                    <thead className="bg-bgStart/95 backdrop-blur-md border-b border-borderDefault text-white text-[10px] uppercase tracking-wider font-black sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-4">Chofer</th>
                        <th className="px-6 py-4">Contacto</th>
                        <th className="px-6 py-4">Licencia</th>
                        <th className="px-6 py-4">Transportista</th>
                        <th className="px-6 py-4">Estado</th>
                        <th className="px-6 py-4 text-right">
                          <RequirePermission permission="drivers:edit">Acciones</RequirePermission>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderDefault">
                      {filtered.map(driver => (
                        <tr key={driver.id} className="hover:bg-bgSurfaceHigh/40 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-white text-base">{driver.full_name}</div>
                            <div className="text-textMuted text-xs mt-0.5">{driver.document_type?.toUpperCase() || 'DOC'}: {driver.document || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-white">{driver.phone || '—'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-white">{driver.license_number || '—'}</span>
                          </td>
                          <td className="px-6 py-4">
                            {driver.carrier ? (
                              <span className="text-accentGreen bg-accentGreen/10 px-2 py-1 rounded font-medium text-sm">{driver.carrier.name}</span>
                            ) : (
                              <span className="text-textMuted italic">Independiente</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {driver.status === 'active' ? (
                              <div className="inline-flex items-center text-statusOnline bg-statusOnline/10 px-3 py-1 rounded-full text-xs font-bold border border-statusOnline/20">
                                ACTIVO
                              </div>
                            ) : (
                              <div className="inline-flex items-center text-statusDanger bg-statusDanger/10 px-3 py-1 rounded-full text-xs font-bold border border-statusDanger/20">
                                SUSPENDIDO
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <RequirePermission permission="drivers:edit">
                              <div className="flex justify-end gap-3 items-center">
                                <button 
                                  onClick={() => { setDriverToEdit(driver); setShowModal(true); }}
                                  className="text-xs font-bold text-textSecondary hover:text-white transition-colors"
                                >
                                  EDITAR
                                </button>
                                <button 
                                  onClick={() => toggleStatus(driver.id, driver.status)}
                                  className={`text-xs underline font-bold ${driver.status === 'active' ? 'text-statusDanger hover:text-red-400' : 'text-statusOnline hover:text-green-400'}`}
                                >
                                  {driver.status === 'active' ? 'SUSPENDER' : 'REACTIVAR'}
                                </button>
                              </div>
                            </RequirePermission>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
};
