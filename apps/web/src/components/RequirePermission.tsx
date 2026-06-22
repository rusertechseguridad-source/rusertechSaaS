import React from 'react';
import { useAuthStore } from '../store/authStore';

export const RequirePermission: React.FC<{
  permission: string;
  children: React.ReactNode;
}> = ({ permission, children }) => {
  const { user } = useAuthStore();
  
  if (!user) return null;
  
  const userRole = user.role || user.role_code || '';
  
  // Super Admin Bypass
  if (userRole === 'super_admin' || userRole === 'rusertech_admin' || userRole === 'SUPERADMIN') return <>{children}</>;
  
  if (!user.permissions) return null;
  
  const hasPermission = user.permissions.includes('*') || user.permissions.includes(permission);
  
  if (!hasPermission) return null;
  
  return <>{children}</>;
};
