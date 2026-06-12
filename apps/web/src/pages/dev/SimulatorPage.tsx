import React from 'react';
import { SimulatorPanel } from '../../components/Simulator/SimulatorPanel';
import { RequirePermission } from '../../components/RequirePermission';

export const SimulatorPage: React.FC = () => {
  return (
    <div className="p-8 h-[calc(100vh-4rem)] w-full flex flex-col">
      <div className="mb-6">
        <h1 
          className="text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-accentMint to-accentBlue tracking-wider flex items-center"
          style={{ textShadow: '0 0 10px rgba(42,179,255,0.3)', animation: 'pulse 3s infinite' }}
        >
          Simulador Dev
        </h1>
        <p className="text-textMuted mt-2">Generador de eventos GPS y telemetría para pruebas y desarrollo.</p>
      </div>
      <RequirePermission permission="dev:simulator">
        <div className="flex-1 bg-bgSurface rounded-xl overflow-hidden shadow-card border border-borderDefault p-4">
          <SimulatorPanel />
        </div>
      </RequirePermission>
    </div>
  );
};
