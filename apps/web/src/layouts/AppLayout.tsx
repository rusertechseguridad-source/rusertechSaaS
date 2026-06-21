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
      <nav className="bg-bgStart/98 border-b border-borderDefault backdrop-blur-md sticky top-0 z-40 shadow-[0_2px_20px_rgba(0,0,0,0.4)]">
        <div className="w-full px-3 sm:px-5">
          <div className="flex items-center justify-between h-14">
            {/* Brand */}
            <a href="/map" className="flex items-center gap-3 mr-5 shrink-0 group">
              <div
                className="relative flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-300 group-hover:shadow-[0_0_16px_rgba(42,179,255,0.7)]"
                style={{ boxShadow: '0 0 12px rgba(42,179,255,0.4)' }}
              >
                <img src="/logo_forma.png" alt="Rusertech Logo" className="w-full h-full object-cover rounded-lg" />
              </div>
              <div className="flex flex-col leading-none">
                <span
                  className="text-[1.15rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-accentMint to-accentBlue tracking-wide"
                  style={{ textShadow: '0 0 10px rgba(42,179,255,0.2)' }}
                >
                  Rusertech
                </span>
                <span className="text-[9px] font-medium text-white/50 tracking-widest hidden sm:block mt-0.5">
                  Seguridad &amp; Logística
                </span>
              </div>
            </a>

            {/* Nav links */}
            <div className="flex gap-0.5 flex-wrap flex-1 min-w-0">
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
                ...(isManagerOrOwner || isAdmin ? [{ path: '/settings', label: 'Configuración', icon: Settings, perm: 'view_settings' }] : []),
                ...(isAdmin ? [{ path: '/admin', label: 'Administración', icon: Shield, perm: 'admin_global' }] : []),
              ].filter(item => {
                if (userRole === 'super_admin') return true;
                if (!user?.permissions) return false;
                return user.permissions.includes(item.perm);
              }).map(item => {
                const isActive = location.pathname.startsWith(item.path);
                const isAlerts = item.path === '/alerts' && hasAlerts;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all duration-150 group relative ${
                      isAlerts
                        ? 'bg-red-600/40 text-white border border-red-500 shadow-[0_0_14px_rgba(255,0,0,0.7)] animate-pulse'
                        : isActive
                          ? 'bg-accentGreen/10 text-white border border-accentGreen/40 shadow-[0_0_8px_rgba(0,200,100,0.15)]'
                          : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'
                    }`}
                  >
                    <item.icon
                      className={`w-4 h-4 transition-colors ${
                        isAlerts
                          ? 'text-red-400 drop-shadow-[0_0_8px_rgba(255,0,0,1)]'
                          : isActive
                            ? 'text-accentGreen drop-shadow-[0_0_4px_rgba(0,200,100,0.6)]'
                            : 'text-white/50 group-hover:text-white'
                      }`}
                    />
                    <span className={`text-[10px] font-semibold tracking-wide whitespace-nowrap ${
                      isAlerts ? 'text-white' : isActive ? 'text-white' : 'text-white/60 group-hover:text-white'
                    }`}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* User info + logout */}
            <div className="flex items-center gap-3 shrink-0 ml-3">
              <span className="text-xs text-white/50 hidden lg:block truncate max-w-[140px]">
                {user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-white/40 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
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
