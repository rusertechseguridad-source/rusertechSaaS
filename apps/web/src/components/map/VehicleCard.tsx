import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Phone } from 'lucide-react';
import { RequirePermission } from '../RequirePermission';
import { avisar } from '../../services/avisos';

interface VehicleCardProps {
  vehicle: any;
  tripId: string;
  onClose?: () => void;
}

export function VehicleCard({ vehicle, tripId, onClose }: VehicleCardProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [called, setCalled] = useState(false);

  const handleCallDriver = async () => {
    if (loading || called) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch(`http://localhost:3000/api/v1/trips/${tripId}/driver-contact-attempt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
      });
      if (res.ok) {
        setCalled(true);
        // Toast o mensaje de confirmación
        avisar.exito(t('vehicle.callDriverSuccess', 'Solicitud de contacto enviada al chofer.'));
        
        // Deshabilitar por 60 segundos
        setTimeout(() => {
          setCalled(false);
        }, 60000);
      } else {
        avisar.error('Error al contactar al chofer');
      }
    } catch (error) {
      console.error(error);
      avisar.error('Error al contactar al chofer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-bgSurface border border-borderDefault rounded-xl p-4 shadow-card text-white relative min-w-[250px]">
      {onClose && (
        <button onClick={onClose} className="absolute top-2 right-2 text-textMuted hover:text-white">
          <X className="w-4 h-4" />
        </button>
      )}
      
      <div className="mb-4">
        <h3 className="text-lg font-bold">{vehicle?.plate || 'Vehículo'}</h3>
        <p className="text-sm text-textSecondary">{vehicle?.alias || ''}</p>
      </div>

      <div className="space-y-2 mb-4 text-xs">
        {/* Aquí irían otros datos del vehículo si los hay */}
      </div>

      {tripId && (
        <RequirePermission permission="manage_trips">
          <button 
            onClick={handleCallDriver}
            disabled={loading || called}
            className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded font-bold transition-colors ${
              called 
                ? 'bg-statusWarning text-bgStart cursor-not-allowed'
                : 'bg-accentBlue text-bgStart hover:bg-opacity-90'
            }`}
          >
            <Phone className="w-4 h-4" />
            {loading ? '...' : (called ? t('vehicle.driverCalled', 'Llamando...') : t('vehicle.callDriver', 'Llamar Chofer'))}
          </button>
        </RequirePermission>
      )}
    </div>
  );
}
