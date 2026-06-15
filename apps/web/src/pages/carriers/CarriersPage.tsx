import React, { useEffect, useState } from 'react';
import { Truck, Search, Briefcase, CheckCircle, XCircle } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';

import { CarrierModal } from './CarrierModal';

export const CarriersPage: React.FC = () => {
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [carrierToEdit, setCarrierToEdit] = useState<any>(null);
  const [search, setSearch] = useState('');

  const fetchCarriers = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/carriers', {
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` }
      });
      if (!res.ok) throw new Error('Error al cargar transportistas');
      setCarriers(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    if (!confirm(`¿Estás seguro de ${currentStatus === 'active' ? 'suspender' : 'reactivar'} este transportista?`)) return;
    
    try {
      const res = await fetch(`http://localhost:3000/api/v1/carriers/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` 
        },
        body: JSON.stringify({ status: currentStatus === 'active' ? 'suspended' : 'active' })
      });
      if (!res.ok) throw new Error('Error al actualizar estado');
      await fetchCarriers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  useEffect(() => {
    fetchCarriers();
  }, []);

  if (loading) return <div className="p-8 text-center text-textMuted">Cargando Transportistas...</div>;
  if (error) return <div className="p-8 text-center text-statusDanger">{error}</div>;

  return (
    <div className="p-8 w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 
            className="text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-accentGreen to-accentBlue tracking-wider flex items-center"
            style={{ textShadow: '0 0 10px rgba(42,179,255,0.3)', animation: 'pulse 3s infinite' }}
          >
            <Truck className="w-8 h-8 mr-3 text-accentGreen" />
            Transportistas
          </h1>
          <p className="text-textMuted mt-2">Gestiona las empresas de transporte asociadas.</p>
        </div>
        <RequirePermission permission="carriers:edit">
          <button 
            onClick={() => { setCarrierToEdit(null); setShowModal(true); }}
            className="px-6 py-2 bg-accentGreen text-bgStart font-medium rounded-lg shadow-sm hover:bg-accentGreen/90 transition"
          >
            + Nuevo Transportista
          </button>
        </RequirePermission>
      </div>

      <CarrierModal 
        isOpen={showModal} 
        onClose={() => { setShowModal(false); setCarrierToEdit(null); }} 
        onSaved={fetchCarriers}
        carrierToEdit={carrierToEdit}
      />

      {(() => {
        const filtered = carriers.filter(c => 
          c.name.toLowerCase().includes(search.toLowerCase()) || 
          (c.tax_id && c.tax_id.toLowerCase().includes(search.toLowerCase()))
        );
        const totalCarriers = carriers.length;
        const activeCarriers = carriers.filter(c => c.status === 'active').length;
        const suspendedCarriers = totalCarriers - activeCarriers;

        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 shrink-0">
              <div className="bg-bgSurface border border-borderDefault rounded-xl p-4 shadow-card flex items-center justify-between">
                <div>
                  <div className="text-textMuted text-xs font-bold uppercase tracking-wider mb-1">Total Transportistas</div>
                  <div className="text-3xl font-display font-black text-white">{totalCarriers}</div>
                </div>
                <div className="w-12 h-12 rounded-full bg-accentGreen/10 flex items-center justify-center border border-accentGreen/20">
                  <Briefcase className="w-6 h-6 text-accentGreen" />
                </div>
              </div>
              <div className="bg-bgSurface border border-borderDefault rounded-xl p-4 shadow-card flex items-center justify-between">
                <div>
                  <div className="text-textMuted text-xs font-bold uppercase tracking-wider mb-1">Activos</div>
                  <div className="text-3xl font-display font-black text-white">{activeCarriers}</div>
                </div>
                <div className="w-12 h-12 rounded-full bg-statusOnline/10 flex items-center justify-center border border-statusOnline/20">
                  <CheckCircle className="w-6 h-6 text-statusOnline" />
                </div>
              </div>
              <div className="bg-bgSurface border border-borderDefault rounded-xl p-4 shadow-card flex items-center justify-between">
                <div>
                  <div className="text-textMuted text-xs font-bold uppercase tracking-wider mb-1">Suspendidos</div>
                  <div className="text-3xl font-display font-black text-white">{suspendedCarriers}</div>
                </div>
                <div className="w-12 h-12 rounded-full bg-statusDanger/10 flex items-center justify-center border border-statusDanger/20">
                  <XCircle className="w-6 h-6 text-statusDanger" />
                </div>
              </div>
            </div>

            <div className="bg-bgSurface border border-borderDefault rounded-xl overflow-hidden shadow-card flex flex-col min-h-0 flex-1">
              <div className="p-4 border-b border-borderDefault flex justify-between items-center bg-bgStart/50 shrink-0">
                <div className="relative w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o CUIT/RUT..."
                    className="w-full bg-bgStart border border-borderDefault rounded-lg pl-10 pr-4 py-2 text-textPrimary focus:border-accentGreen focus:outline-none"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <span className="text-textSecondary text-sm">{filtered.length} transportistas encontrados</span>
              </div>

              <div className="overflow-y-auto flex-1">
                {filtered.length === 0 ? (
                  <div className="p-12 text-center text-textMuted">No hay transportistas que coincidan con la búsqueda.</div>
                ) : (
                  <table className="w-full text-left text-sm text-textSecondary">
                    <thead className="bg-bgStart/95 backdrop-blur-md border-b border-borderDefault text-white text-[10px] uppercase tracking-wider font-black sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-4">Transportista</th>
                        <th className="px-6 py-4">Contacto</th>
                        <th className="px-6 py-4">Vehículos</th>
                        <th className="px-6 py-4">Choferes</th>
                        <th className="px-6 py-4">Estado</th>
                        <th className="px-6 py-4 text-right">
                          <RequirePermission permission="carriers:edit">Acciones</RequirePermission>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderDefault">
                      {filtered.map(carrier => (
                        <tr key={carrier.id} className="hover:bg-bgSurfaceHigh/40 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-white text-base">{carrier.name}</div>
                            <div className="text-textMuted text-xs mt-0.5">RUT/CUIT: {carrier.tax_id || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-white">{carrier.contact_email || '—'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-medium text-white">{carrier._count?.vehicles || 0}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-medium text-white">{carrier._count?.drivers || 0}</span>
                          </td>
                          <td className="px-6 py-4">
                            {carrier.status === 'active' ? (
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
                            <RequirePermission permission="carriers:edit">
                              <div className="flex justify-end gap-3 items-center">
                                <button 
                                  onClick={() => { setCarrierToEdit(carrier); setShowModal(true); }}
                                  className="text-xs font-bold text-textSecondary hover:text-white transition-colors"
                                >
                                  EDITAR
                                </button>
                                <button 
                                  onClick={() => toggleStatus(carrier.id, carrier.status)}
                                  className={`text-xs underline font-bold ${carrier.status === 'active' ? 'text-statusDanger hover:text-red-400' : 'text-statusOnline hover:text-green-400'}`}
                                >
                                  {carrier.status === 'active' ? 'SUSPENDER' : 'REACTIVAR'}
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
