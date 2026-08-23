import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SimulatorPanel } from '../components/Simulator/SimulatorPanel';
import { useAuthStore } from '../store/authStore';
import { Map, Bell, Route, Truck, Smartphone, Building2, Users, MapPin, Navigation, Radio, Zap, LogOut, Shield, Thermometer, Leaf, PieChart, Settings, ShieldAlert, Key } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { logout, user } = useAuthStore();
  const userRole = user?.role || user?.role_code || '';
  const isAdmin = userRole === 'SUPERADMIN' || userRole === 'rusertech_admin' || userRole === 'super_admin' || user?.permissions?.includes('admin_global');
  const isManagerOrOwner = userRole === 'TENANT_OWNER' || userRole === 'TENANT_MANAGER' || userRole === 'account_owner' || userRole === 'manager' || user?.permissions?.includes('manage_settings');
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
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
      } catch (e) {
        // No romper el layout si el parseo falla, pero dejar rastro:
        // un catch vacío acá ya ocultó bugs durante semanas en este proyecto.
        console.warn('[AppLayout] No se pudo procesar la configuración de UI:', e);
      }
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
          <div className="flex items-center justify-between h-[64px] w-full">
            
            {/* Left: Brand (flex-1 forces left side to equal right side for perfect center) */}
            <div className="flex-1 flex items-center justify-start min-w-0">
              <a href="/map" className="flex items-center gap-4 shrink-0 group">
                <div
                  className="relative flex items-center justify-center w-14 h-14 rounded-lg transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(42,179,255,0.8)]"
                  style={{ boxShadow: '0 0 15px rgba(42,179,255,0.5)' }}
                >
                  <img src="/logo_forma.png" alt="Rusertech Logo" className="w-full h-full object-cover rounded-lg" />
                </div>
                <div className="flex flex-col leading-none mt-0.5">
                  <span
                    className="text-[1.65rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-accentMint to-accentBlue tracking-wide animate-pulse"
                    style={{ textShadow: '0 0 12px rgba(42,179,255,0.3)' }}
                  >
                    Rusertech
                  </span>
                  <span className="text-xs font-bold text-white/70 tracking-widest hidden xl:block mt-1 animate-pulse">
                    Seguridad &amp; Logística
                  </span>
                </div>
              </a>
            </div>

            {/* Center: Nav links perfectly centered */}
            <div className="flex-auto flex justify-center items-center gap-2 min-w-0 overflow-x-auto no-scrollbar px-2">
              {[
                { path: '/map', label: t('nav.map'), icon: Map, perm: 'view_map' },
                { path: '/alerts', label: t('nav.alerts'), icon: Bell, perm: 'view_alerts' },
                { path: '/trips', label: t('nav.trips'), icon: Route, perm: 'view_trips' },
                { path: '/vehicles', label: t('nav.vehicles'), icon: Truck, perm: 'view_vehicles' },
                { path: '/devices', label: t('nav.devices'), icon: Smartphone, perm: 'view_devices' },
                { path: '/carriers', label: t('nav.carriers'), icon: Building2, perm: 'view_carriers' },
                { path: '/drivers', label: t('nav.drivers'), icon: Users, perm: 'view_drivers' },
                { path: '/locations', label: t('nav.locations'), icon: MapPin, perm: 'view_locations' },
                { path: '/routes', label: t('nav.routes'), icon: Navigation, perm: 'view_locations' },
                { path: '/avl', label: t('nav.avl'), icon: Radio, perm: 'view_avl' },
                { path: '/sensors', label: t('nav.sensors'), icon: Thermometer, perm: 'view_sensors' },
                { path: '/analytics', label: t('nav.analytics'), icon: PieChart, perm: 'view_analytics' },
                { path: '/carbon', label: t('nav.carbon'), icon: Leaf, perm: 'view_carbon' },
                { path: '/simulator', label: t('nav.simulator'), icon: Zap, perm: 'view_simulator' },
                ...(isManagerOrOwner || isAdmin ? [{ path: '/admin/protocols', label: t('nav.protocols') || 'Protocolos', icon: ShieldAlert, perm: 'view_settings' }] : []),
                ...(isManagerOrOwner || isAdmin ? [{ path: '/admin/security-keys', label: t('nav.securityKeys') || 'Claves', icon: Key, perm: 'view_settings' }] : []),
                ...(isManagerOrOwner || isAdmin ? [{ path: '/settings', label: t('nav.settings'), icon: Settings, perm: 'view_settings' }] : []),
                ...(isAdmin ? [{ path: '/admin', label: t('nav.admin'), icon: Shield, perm: 'admin_global' }] : []),
              ].filter(item => {
                if (userRole === 'SUPERADMIN' || userRole === 'super_admin') return true;
                if (!user?.permissions) return false;
                return user.permissions.includes(item.perm);
              }).map(item => {
                const isActive = location.pathname.startsWith(item.path);
                const isAlerts = item.path === '/alerts' && hasAlerts;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex flex-col items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg transition-all duration-150 group relative flex-shrink-0 min-w-[78px] max-w-[86px] ${
                      isAlerts
                        ? 'bg-red-600/40 text-white border border-red-500 shadow-[0_0_14px_rgba(255,0,0,0.7)] animate-pulse'
                        : isActive
                          ? 'bg-accentGreen/10 text-white border border-accentGreen/40 shadow-[0_0_8px_rgba(0,200,100,0.15)] animate-pulse'
                          : 'text-white hover:bg-white/10 border border-transparent hover:border-white/20'
                    }`}
                  >
                    <item.icon
                      className={`w-[18px] h-[18px] transition-transform group-hover:scale-110 ${
                        isAlerts
                          ? 'text-red-400 drop-shadow-[0_0_8px_rgba(255,0,0,1)]'
                          : isActive
                            ? 'text-accentGreen drop-shadow-[0_0_4px_rgba(0,200,100,0.6)]'
                            : 'text-white drop-shadow-[0_0_2px_rgba(255,255,255,0.8)] group-hover:drop-shadow-[0_0_6px_rgba(255,255,255,1)]'
                      }`}
                    />
                    <span className={`text-[9px] font-bold tracking-wide text-center leading-tight drop-shadow-md ${
                      isAlerts ? 'text-white' : isActive ? 'text-white' : 'text-white group-hover:text-white'
                    }`} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Right: User info + Language + Logout (flex-1 keeps symmetry) */}
            <div className="flex-1 flex items-center justify-end gap-3 min-w-0">
              <span className="text-xs font-bold text-white hidden lg:block truncate max-w-[140px] drop-shadow-md">
                {user?.email}
              </span>
              
              {/* Language Switcher */}
              <button
                onClick={() => i18n.changeLanguage(i18n.language.startsWith('es') ? 'en' : 'es')}
                className="flex items-center justify-center w-6 h-6 text-[9px] font-black text-white bg-white/10 hover:bg-accentBlue/20 hover:text-accentMint border border-white/20 rounded-md transition-colors shadow-sm shrink-0"
                title={t('nav.change_language')}
              >
                {i18n.language.startsWith('es') ? 'EN' : 'ES'}
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-1.5 text-white hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10 shrink-0"
                title={t('nav.logout')}
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
