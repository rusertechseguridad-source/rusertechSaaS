import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const PublicGuard: React.FC = () => {
  const { token } = useAuthStore();
  
  if (token) {
    return <Navigate to="/map" replace />;
  }
  
  return <Outlet />;
};
