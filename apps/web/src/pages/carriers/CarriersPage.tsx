import React, { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';

import { CarrierModal } from './CarrierModal';

export const CarriersPage: React.FC = () => {
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

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
            onClick={() => setShowModal(true)}
            className="px-6 py-2 bg-accentGreen text-bgStart font-medium rounded-lg shadow-sm hover:bg-accentGreen/90 transition"
          >
            + Nuevo Transportista
          </button>
        </RequirePermission>
      </div>

      <CarrierModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        onSaved={fetchCarriers} 
      />

      {carriers.length === 0 ? (
        <div className="bg-bgSurface rounded-xl shadow-sm border border-borderDefault p-12 text-center">
          <p className="text-textMuted">No hay transportistas registrados todavía.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {carriers.map(carrier => (
            <div key={carrier.id} className="bg-bgSurface rounded-xl shadow-card border border-borderDefault overflow-hidden flex flex-col">
              <div className="p-6 flex-grow">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold text-white">{carrier.name}</h3>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${carrier.status === 'active' ? 'bg-statusSuccess/10 text-statusSuccess border border-statusSuccess/20' : 'bg-statusDanger/10 text-statusDanger border border-statusDanger/20'}`}>
                      {carrier.status === 'active' ? 'Activo' : 'Suspendido'}
                    </span>
                    <RequirePermission permission="carriers:edit">
                      <button 
                        onClick={() => toggleStatus(carrier.id, carrier.status)}
                        className={`text-xs underline ${carrier.status === 'active' ? 'text-statusDanger hover:text-red-400' : 'text-statusSuccess hover:text-green-400'}`}
                      >
                        {carrier.status === 'active' ? 'Suspender' : 'Reactivar'}
                      </button>
                    </RequirePermission>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-textSecondary">
                  <div className="flex justify-between">
                    <span>CUIT/RUT:</span>
                    <span className="font-mono text-white">{carrier.tax_id || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Email:</span>
                    <span className="text-white">{carrier.contact_email || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vehículos:</span>
                    <span className="font-medium text-white">{carrier._count?.vehicles || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Choferes:</span>
                    <span className="font-medium text-white">{carrier._count?.drivers || 0}</span>
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
