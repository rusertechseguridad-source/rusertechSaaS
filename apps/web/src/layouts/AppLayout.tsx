import React from 'react';
import { Outlet } from 'react-router-dom';
import { SimulatorPanel } from '../components/Simulator/SimulatorPanel';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-bg flex flex-col text-textPrimary relative">
      {/* Navbar */}
      <nav className="bg-bgStart/95 border-b border-borderDefault backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-display font-bold text-accentGreen">Rusertech</h1>
              <div className="flex space-x-1">
                <a href="/vehicles" className="text-textSecondary hover:text-white hover:bg-bgSurfaceHigh px-3 py-2 rounded-md text-sm font-medium transition-colors">Vehículos</a>
                <a href="/locations" className="text-textSecondary hover:text-white hover:bg-bgSurfaceHigh px-3 py-2 rounded-md text-sm font-medium transition-colors">Ubicaciones</a>
                <a href="/routes" className="text-textSecondary hover:text-white hover:bg-bgSurfaceHigh px-3 py-2 rounded-md text-sm font-medium transition-colors">Recorridos</a>
                <a href="/avl" className="text-textSecondary hover:text-white hover:bg-bgSurfaceHigh px-3 py-2 rounded-md text-sm font-medium transition-colors">AVL Users</a>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      <SimulatorPanel />
    </div>
  );
};
