import React from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { SimulatorPanel } from '../components/Simulator/SimulatorPanel';
import { useAuthStore } from '../store/authStore';
import { Map, Bell, Route, Truck, Smartphone, Building2, Users, MapPin, Navigation, Radio, Zap, LogOut, Shield, Thermometer } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { logout, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

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
              <div className="flex space-x-0.5 flex-wrap">
                {[
                  { path: '/map', label: 'Mapa Global', icon: Map },
                  { path: '/alerts', label: 'Alertas', icon: Bell },
                  { path: '/trips', label: 'Viajes', icon: Route },
                  { path: '/vehicles', label: 'Vehículos', icon: Truck },
                  { path: '/devices', label: 'Dispositivos', icon: Smartphone },
                  { path: '/carriers', label: 'Transportistas', icon: Building2 },
                  { path: '/drivers', label: 'Conductores', icon: Users },
                  { path: '/locations', label: 'Ubicaciones', icon: MapPin },
                  { path: '/routes', label: 'Recorridos', icon: Navigation },
                  { path: '/avl', label: 'AVL', icon: Radio },
                  { path: '/sensors', label: 'Sensores Clima', icon: Thermometer },
                  { path: '/simulator', label: 'Simulador', icon: Zap },
                ].map(item => {
                  const isActive = location.pathname.startsWith(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all group ${
                        isActive
                          ? 'bg-accentGreen/10 text-white border border-accentGreen/30 shadow-[0_0_10px_rgba(0,200,100,0.15)]'
                          : 'text-textSecondary hover:text-white hover:bg-bgSurfaceHigh border border-transparent'
                      }`}
                    >
                      <item.icon className={`w-5 h-5 ${isActive ? 'text-accentGreen drop-shadow-[0_0_5px_rgba(0,200,100,0.5)]' : 'text-textMuted group-hover:text-white transition-colors'}`} />
                      <span className={`text-xs font-bold tracking-wide whitespace-nowrap ${
                        isActive ? 'text-white' : 'text-white/70 group-hover:text-white'
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
