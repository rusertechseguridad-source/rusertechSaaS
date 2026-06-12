import React, { useEffect, useState } from 'react';
import { AlertTriangle, MapPin, Truck, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch('http://localhost:3000/api/v1/alerts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // Auto-refresh every minute
    return () => clearInterval(interval);
  }, []);

  const resolveAlert = async (id: string) => {
    if (!confirm('¿Marcar este incidente como resuelto?')) return;
    try {
      const token = localStorage.getItem('rusertech_token');
      // En el futuro crear endpoint específico o reusar uno general.
      // Por ahora actualizamos UI optimísticamente
      setAlerts(alerts.filter(a => a.id !== id));
      alert('Se requeriría endpoint para cerrar la alerta, UI actualizada optimísticamente.');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-8 w-full max-w-7xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div>
          <h1 
            className="text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400 tracking-wider flex items-center"
            style={{ textShadow: '0 0 10px rgba(239,68,68,0.3)' }}
          >
            <AlertTriangle className="w-8 h-8 mr-3 text-red-500" />
            Alertas e Incidentes
          </h1>
          <p className="text-textMuted mt-2">Monitoreo de eventos críticos activos.</p>
        </div>
        <button
          onClick={fetchAlerts}
          className="bg-bgSurfaceHigh hover:bg-borderDefault text-white px-4 py-2 rounded flex items-center gap-2 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {loading && alerts.length === 0 ? (
          <div className="text-center text-textMuted py-12">Cargando alertas...</div>
        ) : alerts.length === 0 ? (
          <div className="bg-bgSurface border border-borderDefault rounded-xl p-12 text-center shadow-card flex flex-col items-center justify-center h-64">
            <div className="w-16 h-16 rounded-full bg-statusSuccess/10 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-statusSuccess" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Todo en orden</h3>
            <p className="text-textMuted">No hay incidentes críticos abiertos en este momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {alerts.map(alert => (
              <div key={alert.id} className="bg-bgSurface border border-red-500/30 rounded-xl overflow-hidden shadow-[0_4px_20px_-5px_rgba(239,68,68,0.15)] flex flex-col group hover:border-red-500 transition-colors">
                <div className="bg-red-500/10 p-4 border-b border-red-500/20 shrink-0 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <h3 className="font-bold text-white uppercase tracking-wider text-sm">{alert.event_type.replace(/_/g, ' ')}</h3>
                  </div>
                  <span className="text-xs font-mono text-red-400">
                    {new Date(alert.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                <div className="p-4 flex-1 flex flex-col gap-3 text-sm">
                  <div className="flex items-center gap-2 text-white">
                    <Truck className="w-4 h-4 text-textMuted shrink-0" />
                    <span className="font-medium truncate">{alert.vehicle?.plate || 'Vehículo desconocido'}</span>
                  </div>
                  
                  {alert.trip && (
                    <div className="flex items-center gap-2 text-textMuted text-xs">
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <Link to={`/trips/${alert.trip.id}`} className="hover:text-accentBlue hover:underline truncate">
                        {alert.trip.name}
                      </Link>
                    </div>
                  )}

                  {alert.address && (
                    <div className="flex items-start gap-2 text-textSecondary text-xs">
                      <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{alert.address}</span>
                    </div>
                  )}
                  
                  {alert.latitude && alert.longitude && (
                    <div className="mt-1">
                      <a 
                        href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-accentBlue hover:underline flex items-center gap-1"
                      >
                        <MapPin className="w-3 h-3" /> Ver en mapa
                      </a>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-bgStart/50 border-t border-borderDefault shrink-0 flex justify-end">
                  <button 
                    onClick={() => resolveAlert(alert.id)}
                    className="text-xs font-bold bg-bgSurfaceHigh hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded transition-colors"
                  >
                    Marcar Resuelto
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Component helper para renderizar el tick verde.
const CheckCircle = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);
