import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';

import { DriverModal } from './DriverModal';

export const DriversPage: React.FC = () => {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

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
            onClick={() => setShowModal(true)}
            className="px-6 py-2 bg-accentBlue text-bgStart font-medium rounded-lg shadow-sm hover:bg-accentBlue/90 transition"
          >
            + Nuevo Chofer
          </button>
        </RequirePermission>
      </div>

      <DriverModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        onSaved={fetchDrivers} 
      />

      {drivers.length === 0 ? (
        <div className="bg-bgSurface rounded-xl shadow-sm border border-borderDefault p-12 text-center">
          <p className="text-textMuted">No hay choferes registrados todavía.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {drivers.map(driver => (
            <div key={driver.id} className="bg-bgSurface rounded-xl shadow-card border border-borderDefault overflow-hidden flex flex-col">
              <div className="p-6 flex-grow">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold text-white">{driver.full_name}</h3>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${driver.status === 'active' ? 'bg-statusSuccess/10 text-statusSuccess border border-statusSuccess/20' : 'bg-statusDanger/10 text-statusDanger border border-statusDanger/20'}`}>
                      {driver.status === 'active' ? 'Activo' : 'Suspendido'}
                    </span>
                    <RequirePermission permission="drivers:edit">
                      <button 
                        onClick={() => toggleStatus(driver.id, driver.status)}
                        className={`text-xs underline ${driver.status === 'active' ? 'text-statusDanger hover:text-red-400' : 'text-statusSuccess hover:text-green-400'}`}
                      >
                        {driver.status === 'active' ? 'Suspender' : 'Reactivar'}
                      </button>
                    </RequirePermission>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-textSecondary">
                  <div className="flex justify-between">
                    <span>{driver.document_type?.toUpperCase() || 'DOC'}:</span>
                    <span className="font-mono text-white">{driver.document || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Teléfono:</span>
                    <span className="text-white">{driver.phone || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Licencia:</span>
                    <span className="font-mono text-white">{driver.license_number || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-borderDefault">
                    <span>Transportista:</span>
                    <span className="font-medium text-accentGreen bg-accentGreen/10 px-2 py-1 rounded">
                      {driver.carrier?.name || 'Independiente'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
