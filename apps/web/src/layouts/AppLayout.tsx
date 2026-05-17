import React from 'react';
import { Outlet } from 'react-router-dom';
import { SimulatorPanel } from '../components/Simulator/SimulatorPanel';

// Improved SaaS Layout
export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-bgStart flex flex-col text-textPrimary relative">
      {/* Navbar */}
      <nav className="bg-black/80 border-b border-gray-800 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-display font-bold text-brand">Rusertech</h1>
              <div className="flex space-x-4">
                <a href="/vehicles" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Vehículos</a>
                <a href="/locations" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Ubicaciones</a>
                <a href="/routes" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Recorridos</a>
                <a href="/avl" className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium">AVL Users</a>
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
