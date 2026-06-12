import React from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { SimulatorPanel } from '../components/Simulator/SimulatorPanel';
import { useAuthStore } from '../store/authStore';
import { LogOut, Shield } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { logout, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-bg flex flex-col text-textPrimary relative">
      {/* Navbar */}
      <nav className="bg-bgStart/95 border-b border-borderDefault backdrop-blur-md sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-28">
            <div className="flex items-center gap-10">
              <a href="/vehicles" className="flex items-center gap-5 mr-6 group">
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
                    Seguridad & Logística
                  </span>
                </div>
              </a>
              <div className="flex space-x-1">
                {[
                  { path: '/alerts', label: 'Alertas' },
                  { path: '/trips', label: 'Viajes' },
                  { path: '/vehicles', label: 'Vehículos' },
                  { path: '/carriers', label: 'Transportistas' },
                  { path: '/drivers', label: 'Choferes' },
                  { path: '/locations', label: 'Ubicaciones' },
                  { path: '/routes', label: 'Recorridos' },
                  { path: '/avl', label: 'AVL' },
                  { path: '/simulator', label: 'Simulador' }
                ].map(item => {
                  const isActive = location.pathname.startsWith(item.path);
                  return (
                    <Link 
                      key={item.path}
                      to={item.path} 
                      className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive 
                          ? 'font-black text-transparent bg-clip-text bg-gradient-to-r from-accentGreen to-accentBlue tracking-wider' 
                          : 'font-medium text-textSecondary hover:text-white hover:bg-bgSurfaceHigh'
                      }`}
                      style={isActive ? { textShadow: '0 0 10px rgba(42,179,255,0.3)', animation: 'pulse 3s infinite' } : {}}
                    >
                      {item.label}
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

      <main className="flex-1 w-full">
        <Outlet />
      </main>
    </div>
  );
};
