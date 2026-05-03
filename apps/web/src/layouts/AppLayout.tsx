import React from 'react';
import { Outlet } from 'react-router-dom';

// Stub for the SaaS Layout
export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-bgStart flex flex-col items-center justify-center text-textPrimary">
      <h1 className="text-2xl font-display font-bold mb-4">Rusertech SaaS - Zona Segura</h1>
      <Outlet />
    </div>
  );
};
