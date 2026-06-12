import React, { useEffect, useState } from 'react';
import { useSimulatorStore } from '../../store/simulatorStore';
import { useAvlStore } from '../../store/avlStore';
import { Activity, Play, Send, AlertTriangle, X, Trash2, Info } from 'lucide-react';

export const SimulatorPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'point' | 'route' | 'alert' | 'status'>('info');
  
  const { activeJobs, fetchStatus, sendPoint, sendAlert, startRoute, deleteRoute, loading } = useSimulatorStore();
  const { users, fetchUsers } = useAvlStore();

  const [avlUserId, setAvlUserId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  
  // Basic Form States
  const [lat, setLat] = useState('-34.6037');
  const [lng, setLng] = useState('-58.3816');
  const [speed, setSpeed] = useState('0');
  const [alertType, setAlertType] = useState('speed_exceeded');

  useEffect(() => {
    fetchUsers();
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSendPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendPoint({
      avlUserId,
      vehicleId,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      speedKmh: parseFloat(speed)
    });
    alert('Punto enviado');
  };

  const handleSendAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendAlert({
      avlUserId,
      vehicleId,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      alertType
    });
    alert('Alerta enviada');
  };

  const handleStartRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    // Dummy route around Buenos Aires
    const routeGeoJson = {
      type: "LineString",
      coordinates: [
        [-58.3816, -34.6037],
        [-58.3820, -34.6040],
        [-58.3830, -34.6050]
      ]
    };
    await startRoute({
      avlUserId,
      vehicleId,
      routeGeoJson,
      intervalSeconds: 5,
      speedKmh: 40
    });
    alert('Ruta iniciada');
    fetchStatus();
  };

  if (import.meta.env.VITE_AVL_SIMULATOR_ENABLED !== 'true') return null;

  return (
    <div className="h-full w-full flex flex-col text-sm text-gray-300 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
      <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-black/50">
        <h2 className="font-bold text-amber-500 flex items-center" title="Herramienta para inyectar datos falsos en el sistema como si fueras un GPS real">
          <Activity className="w-5 h-5 mr-2" />
          AVL SIMULATOR
        </h2>
        {activeJobs.length > 0 && (
          <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full animate-pulse">
            {activeJobs.length} ACTIVO
          </span>
        )}
      </div>

          <div className="flex border-b border-gray-800">
            <button onClick={() => setActiveTab('info')} title="Información y Ayuda" className={`flex-1 py-3 text-center ${activeTab === 'info' ? 'border-b-2 border-amber-500 text-white' : 'hover:bg-gray-800'}`}><Info className="w-4 h-4 mx-auto" /></button>
            <button onClick={() => setActiveTab('point')} title="Enviar Punto Aislado" className={`flex-1 py-3 text-center ${activeTab === 'point' ? 'border-b-2 border-amber-500 text-white' : 'hover:bg-gray-800'}`}><Send className="w-4 h-4 mx-auto" /></button>
            <button onClick={() => setActiveTab('route')} title="Simular Recorrido Completo" className={`flex-1 py-3 text-center ${activeTab === 'route' ? 'border-b-2 border-amber-500 text-white' : 'hover:bg-gray-800'}`}><Play className="w-4 h-4 mx-auto" /></button>
            <button onClick={() => setActiveTab('alert')} title="Simular Alerta/Evento" className={`flex-1 py-3 text-center ${activeTab === 'alert' ? 'border-b-2 border-amber-500 text-white' : 'hover:bg-gray-800'}`}><AlertTriangle className="w-4 h-4 mx-auto" /></button>
            <button onClick={() => setActiveTab('status')} title="Estado de Simulaciones Activas" className={`flex-1 py-3 text-center ${activeTab === 'status' ? 'border-b-2 border-amber-500 text-white' : 'hover:bg-gray-800'}`}><Activity className="w-4 h-4 mx-auto" /></button>
          </div>

          <div className="p-4 flex-1 overflow-y-auto">
            {activeTab === 'info' && (
              <div className="space-y-4 leading-relaxed">
                <h3 className="font-bold text-white text-lg">¿Para qué es esto?</h3>
                <p>El <strong>DEV Simulator</strong> es una herramienta exclusiva de desarrollo para probar el sistema sin requerir vehículos reales conectados.</p>
                <p>Permite <strong>inyectar telemetría ficticia</strong> directamente en la API de ingestión (Kafka/DB) fingiendo ser un proveedor GPS.</p>
                <div className="bg-gray-800 p-3 rounded text-xs space-y-2">
                  <p><strong><Send className="inline w-3 h-3 mr-1"/>Punto Aislado:</strong> Envía una única coordenada para posicionar un vehículo en el mapa.</p>
                  <p><strong><Play className="inline w-3 h-3 mr-1"/>Recorrido:</strong> Crea un "vehículo fantasma" que se moverá automáticamente por la ciudad durante unos minutos reportando posiciones, útil para probar mapas en vivo.</p>
                  <p><strong><AlertTriangle className="inline w-3 h-3 mr-1"/>Alerta:</strong> Finge la activación de un botón SOS o exceso de velocidad.</p>
                  <p><strong><Activity className="inline w-3 h-3 mr-1"/>Estado:</strong> Permite ver y detener los vehículos fantasma (rutas) que están en movimiento.</p>
                </div>
              </div>
            )}

            {activeTab !== 'status' && activeTab !== 'info' && (
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">AVL User (Provider)</label>
                  <select 
                    title="Selecciona a través de qué proveedor vas a inyectar el dato (su API Key se usará)"
                    className="w-full bg-black border border-gray-700 rounded p-2 text-white outline-none focus:border-amber-500"
                    value={avlUserId}
                    onChange={(e) => setAvlUserId(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.user_avl_code} - {u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Vehicle ID</label>
                  <input 
                    type="text" 
                    title="Coloca el ASSET ID o IMEI que quieres simular (debe coincidir con un vehículo creado si quieres verlo)"
                    placeholder="Ej: ASSET_123"
                    className="w-full bg-black border border-gray-700 rounded p-2 text-white outline-none focus:border-amber-500"
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                  />
                </div>
                <div className="flex space-x-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Latitud</label>
                    <input type="text" className="w-full bg-black border border-gray-700 rounded p-2 text-white outline-none" value={lat} onChange={(e) => setLat(e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Longitud</label>
                    <input type="text" className="w-full bg-black border border-gray-700 rounded p-2 text-white outline-none" value={lng} onChange={(e) => setLng(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'point' && (
              <form onSubmit={handleSendPoint} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Velocidad (km/h)</label>
                  <input type="text" className="w-full bg-black border border-gray-700 rounded p-2 text-white outline-none" value={speed} onChange={(e) => setSpeed(e.target.value)} />
                </div>
                <button disabled={loading} type="submit" title="Envía esta posición una sola vez" className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded p-2 font-bold transition-colors">
                  Enviar Punto
                </button>
              </form>
            )}

            {activeTab === 'alert' && (
              <form onSubmit={handleSendAlert} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tipo de Alerta</label>
                  <select className="w-full bg-black border border-gray-700 rounded p-2 text-white outline-none" value={alertType} onChange={(e) => setAlertType(e.target.value)}>
                    <option value="speed_exceeded">Exceso de Velocidad</option>
                    <option value="sos">Botón SOS</option>
                    <option value="geofence_enter">Ingreso a Geocerca</option>
                    <option value="signal_loss">Pérdida de Señal</option>
                  </select>
                </div>
                <button disabled={loading} type="submit" title="Envía un evento de emergencia/alerta" className="w-full bg-red-600 hover:bg-red-500 text-white rounded p-2 font-bold transition-colors">
                  Lanzar Alerta
                </button>
              </form>
            )}

            {activeTab === 'route' && (
              <form onSubmit={handleStartRoute} className="space-y-4">
                <p className="text-xs text-gray-500">Se usará una ruta predefinida de prueba de 3 puntos en Buenos Aires.</p>
                <button disabled={loading} type="submit" title="Arranca un job en background que enviará posiciones cada 5 segundos" className="w-full bg-green-600 hover:bg-green-500 text-white rounded p-2 font-bold transition-colors">
                  Iniciar Simulación de Ruta
                </button>
              </form>
            )}

            {activeTab === 'status' && (
              <div className="space-y-4">
                <h3 className="font-bold text-white mb-2">Trabajos en Curso ({activeJobs.length})</h3>
                {activeJobs.length === 0 ? (
                  <p className="text-gray-500 italic text-xs">No hay simulaciones de rutas corriendo.</p>
                ) : (
                  activeJobs.map(job => (
                    <div key={job.id} className="bg-black border border-gray-800 p-3 rounded text-xs relative group">
                      <p className="text-amber-500 font-bold mb-1">Job ID: {job.id}</p>
                      <p>Vehicle: {job.data.vehicleId.slice(0, 8)}...</p>
                      <p>Index: {job.data.currentIndex} / {job.data.coordinates?.length}</p>
                      <button 
                        onClick={() => { deleteRoute(job.id); fetchStatus(); }}
                        title="Detener y borrar simulación"
                        className="absolute top-2 right-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
    </div>
  );
};
