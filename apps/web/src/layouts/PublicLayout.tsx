import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

export const PublicLayout: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col font-body bg-bgStart text-textPrimary">
      {/* HEADER */}
      <header className="h-16 sticky top-0 z-[100] bg-[rgba(31,42,90,0.97)] backdrop-blur-md border-b border-borderDefault">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            {/* Logo */}
            <div className="w-8 h-8 rounded bg-gradient-accent flex items-center justify-center font-display font-extrabold text-iconSymbol">
              R
            </div>
            <span className="font-display font-extrabold text-xl tracking-wide">RUSERTECH</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <NavLink to="/" className={({ isActive }) => `text-sm font-medium transition-colors ${isActive ? 'text-textPrimary border-b-2 border-accentGreen' : 'text-textSecondary hover:text-textPrimary'}`}>Inicio</NavLink>
            <NavLink to="/nosotros" className={({ isActive }) => `text-sm font-medium transition-colors ${isActive ? 'text-textPrimary border-b-2 border-accentGreen' : 'text-textSecondary hover:text-textPrimary'}`}>Nosotros</NavLink>
            <NavLink to="/servicios" className={({ isActive }) => `text-sm font-medium transition-colors ${isActive ? 'text-textPrimary border-b-2 border-accentGreen' : 'text-textSecondary hover:text-textPrimary'}`}>Servicios</NavLink>
            <NavLink to="/contacto" className={({ isActive }) => `text-sm font-medium transition-colors ${isActive ? 'text-textPrimary border-b-2 border-accentGreen' : 'text-textSecondary hover:text-textPrimary'}`}>Contacto</NavLink>
          </nav>

          <button 
            onClick={() => navigate('/login')}
            className="bg-gradient-accent text-textOnAccent font-bold px-5 py-2 rounded-lg text-sm hover:shadow-glow-green transition-shadow"
          >
            Iniciar Sesión
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      {/* FOOTER */}
      <footer className="py-10 bg-bgStart border-t border-borderDefault">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded bg-gradient-accent flex items-center justify-center font-display font-extrabold text-iconSymbol text-xs">
                R
              </div>
              <span className="font-display font-extrabold text-lg">RUSERTECH</span>
            </div>
            <p className="text-textSecondary text-sm">Seguridad & Logística</p>
          </div>
          <div className="flex flex-col gap-2">
            <NavLink to="/" className="text-textMuted text-sm hover:text-textPrimary transition-colors">Inicio</NavLink>
            <NavLink to="/nosotros" className="text-textMuted text-sm hover:text-textPrimary transition-colors">Nosotros</NavLink>
            <NavLink to="/servicios" className="text-textMuted text-sm hover:text-textPrimary transition-colors">Servicios</NavLink>
            <NavLink to="/contacto" className="text-textMuted text-sm hover:text-textPrimary transition-colors">Contacto</NavLink>
          </div>
          <div className="flex flex-col gap-2">
            <a href="mailto:info@rusertech.com" className="text-textMuted text-sm hover:text-textPrimary transition-colors">info@rusertech.com</a>
            <a href="https://rusertech.com" className="text-textMuted text-sm hover:text-textPrimary transition-colors">rusertech.com</a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-8 pt-8 border-t border-[rgba(255,255,255,0.05)] text-center">
          <p className="text-textMuted text-sm">© 2026 Rusertech. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
};
