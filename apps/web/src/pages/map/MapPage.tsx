import React from 'react';
import { useAuthStore } from '../../store/authStore';

export const MapPage: React.FC = () => {
  const { user } = useAuthStore();

  if (user?.role === 'SUPERADMIN') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-bgStart relative overflow-hidden">
        {/* Background grid effect */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        <div className="z-10 flex flex-col items-center animate-fade-in-up">
          <img src="/logo_forma.png" alt="Rusertech Logo" className="w-48 h-48 mb-8 drop-shadow-[0_0_30px_rgba(42,179,255,0.4)]" />
          <h1 
            className="text-6xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-accentMint to-accentBlue tracking-wider text-center"
            style={{ textShadow: '0 0 20px rgba(42,179,255,0.5)', animation: 'pulse 3s infinite' }}
          >
            Rusertech
          </h1>
          <h2 
            className="text-2xl mt-2 font-bold text-transparent bg-clip-text bg-gradient-to-r from-accentGreen to-accentMint tracking-widest uppercase"
            style={{ textShadow: '0 0 10px rgba(42,255,179,0.3)', animation: 'pulse 3s infinite' }}
          >
            Ruta Logística Segura
          </h2>
        </div>
      </div>
    );
  }

  // Non-superadmin view (empty map container for future)
  return (
    <div className="h-full w-full bg-bgStart flex items-center justify-center">
      <div className="text-textMuted text-lg">Espacio Reservado para Mapa Interactivo del Cliente</div>
    </div>
  );
};
