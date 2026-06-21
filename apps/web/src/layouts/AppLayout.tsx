import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { SimulatorPanel } from '../components/Simulator/SimulatorPanel';
import { useAuthStore } from '../store/authStore';
import { Map, Bell, Route, Truck, Smartphone, Building2, Users, MapPin, Navigation, Radio, Zap, LogOut, Shield, Thermometer, Leaf, PieChart, Settings } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { logout, user } = useAuthStore();
  const userRole = user?.role || user?.role_code || '';
  const isAdmin = userRole === 'rusertech_admin' || userRole === 'super_admin' || user?.permissions?.includes('admin_global');
  const isManagerOrOwner = userRole === 'account_owner' || userRole === 'manager' || user?.permissions?.includes('manage_settings');
  const navigate = useNavigate();
  const location = useLocation();
  const [hasAlerts, setHasAlerts] = useState(false);

  useEffect(() => {
    const checkAlerts = async () => {
      try {
        const token = localStorage.getItem('rusertech_token');
        if (!token) return;
        const res = await fetch('http://localhost:3000/api/v1/alerts', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          // Endpoint might return an array or an object like { data: [...] }
          const alertsArray = Array.isArray(data) ? data : (data.data || []);
          const openAlerts = alertsArray.filter((a: any) => a.status !== 'resolved');
          setHasAlerts(openAlerts.length > 0);
        }
      } catch (e) { }
    };
    
    checkAlerts();
    const interval = setInterval(checkAlerts, 15000); // 15s
    return () => clearInterval(interval);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="h-screen bg-gradient-bg flex flex-col text-textPrimary relative overflow-hidden">
      {/* Navbar */}
      <nav className="bg-bgStart/95 border-b border-borderDefault backdrop-blur-md sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-28">
            <div className="flex items-center gap-10">
              <a href="/map" className="flex items-center gap-5 mr-6 group">
                <div 
                  className="relative flex items-center justify-center w-20 h-20 rounded-xl shadow-[0_0_20px_rgba(42,179,255,0.4)] transition-all duration-300"
                  style={{ animation: 'pulse 3s infinite' }}
                >
                  <img 
                    src="/logo_forma.png" 
                    alt="Rusertech Logo" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col">
                  <h1 
                    className="text-[2.6rem] font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-accentMint to-accentBlue tracking-wide capitalize leading-none"
                    style={{ textShadow: '0 0 15px rgba(42,179,255,0.3)', animation: 'pulse 3s infinite' }}
                  >
                    Rusertech
                  </h1>
                  <span 
                    className="text-[17px] font-medium text-white tracking-widest mt-2"
                  >
                    Seguridad &amp; Logística
                  </span>
                </div>
              </a>
              <div className="flex gap-2 flex-wrap">
                {[
                  { path: '/map', label: 'Mapa Global', icon: Map, perm: 'view_map' },
                  { path: '/alerts', label: 'Alertas', icon: Bell, perm: 'view_alerts' },
                  { path: '/trips', label: 'Viajes', icon: Route, perm: 'view_trips' },
                  { path: '/vehicles', label: 'Vehículos', icon: Truck, perm: 'view_vehicles' },
                  { path: '/devices', label: 'Dispositivos', icon: Smartphone, perm: 'view_devices' },
                  { path: '/carriers', label: 'Transportistas', icon: Building2, perm: 'view_carriers' },
                  { path: '/drivers', label: 'Conductores', icon: Users, perm: 'view_drivers' },
                  { path: '/locations', label: 'Ubicaciones', icon: MapPin, perm: 'view_locations' },
                  { path: '/routes', label: 'Recorridos', icon: Navigation, perm: 'view_locations' },
                  { path: '/avl', label: 'AVL', icon: Radio, perm: 'view_avl' },
                  { path: '/sensors', label: 'Sensores Clima', icon: Thermometer, perm: 'view_sensors' },
                  { path: '/analytics', label: 'Analytics', icon: PieChart, perm: 'view_analytics' },
                  { path: '/carbon', label: 'Emisiones', icon: Leaf, perm: 'view_carbon' },
                  { path: '/simulator', label: 'Simulador', icon: Zap, perm: 'view_simulator' },
                  ...(isManagerOrOwner || isAdmin ? [{ path: '/settings', label: 'Config', icon: Settings, perm: 'view_settings' }] : []),
                  ...(isAdmin ? [{ path: '/admin', label: 'Admin', icon: Shield, perm: 'admin_global' }] : []),
                ].filter(item => {
                  if (userRole === 'super_admin') return true;
                  // Si no hay permisos listados en el usuario, mostramos igual por seguridad temporal o lo bloqueamos
                  if (!user?.permissions) return false;
                  return user.permissions.includes(item.perm);
                }).map(item => {
                  const isActive = location.pathname.startsWith(item.path);
                  const isAlerts = item.path === '/alerts' && hasAlerts;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all group relative ${
                        isAlerts
                          ? 'bg-red-600/40 text-white border border-red-500 shadow-[0_0_20px_rgba(255,0,0,0.8)] animate-pulse'
                          : isActive
                            ? 'bg-accentGreen/10 text-white border border-accentGreen/30 shadow-[0_0_10px_rgba(0,200,100,0.15)]'
                            : 'text-textSecondary hover:text-white hover:bg-bgSurfaceHigh border border-transparent'
                      }`}
                    >
                      <item.icon 
                        className={`w-5 h-5 transition-colors ${
                          isAlerts 
                            ? 'text-[#ff3333] drop-shadow-[0_0_12px_rgba(255,0,0,1)]' 
                            : isActive 
                              ? 'text-accentGreen drop-shadow-[0_0_5px_rgba(0,200,100,0.5)]' 
                              : 'text-textMuted group-hover:text-white'
                        }`} 
                      />
                      <span className={`text-xs font-bold tracking-wide whitespace-nowrap ${
                        isAlerts ? 'text-white drop-shadow-[0_0_5px_rgba(255,0,0,1)]' : isActive ? 'text-white' : 'text-white/70 group-hover:text-white'
                      }`}>
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-textSecondary hidden sm:block">
                {user?.email}
              </span>
              <button 
                onClick={handleLogout}
                className="flex items-center text-textMuted hover:text-statusDanger transition-colors"
                title="Cerrar sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full overflow-y-auto" style={{ minHeight: 0 }}>
        <Outlet />
      </main>
    </div>
  );
};
