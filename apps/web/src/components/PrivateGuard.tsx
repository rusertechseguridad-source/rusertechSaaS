import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const PrivateGuard: React.FC = () => {
  const { token, logout, setUser } = useAuthStore();
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setIsValidating(false);
        return;
      }
      try {
        const res = await fetch('http://localhost:3000/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401) {
          logout();
        } else if (res.ok) {
          const user = await res.json();
          setUser(user);
        }
      } catch (e) {
        console.error('Token validation error', e);
      } finally {
        setIsValidating(false);
      }
    };
    validateToken();
  }, [token, logout]);
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isValidating) {
    return <div className="h-screen w-screen flex items-center justify-center bg-bgBase text-white">Validando sesión...</div>;
  }
  
  return <Outlet />;
};
