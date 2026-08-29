import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { Map, Bell, Route, Truck, Smartphone, Building2, Users, MapPin, Navigation, Radio, Zap, LogOut, Shield, Thermometer, Leaf, PieChart, Settings, ShieldAlert, Key, Cpu, ChevronDown, BarChart3 } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { logout, user } = useAuthStore();
  const userRole = user?.role || user?.role_code || '';
  const isAdmin = userRole === 'SUPERADMIN' || userRole === 'rusertech_admin' || userRole === 'super_admin' || user?.permissions?.includes('admin_global');
  const isManagerOrOwner = userRole === 'TENANT_OWNER' || userRole === 'TENANT_MANAGER' || userRole === 'account_owner' || userRole === 'manager' || user?.permissions?.includes('manage_settings');
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [hasAlerts, setHasAlerts] = useState(false);
  /** Qué grupo del menú está desplegado. Uno a la vez; null = ninguno. */
  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(null);

  // Navegar cierra el desplegable: el menú no puede quedar colgado sobre la
  // pantalla nueva.
  useEffect(() => { setGrupoAbierto(null); }, [location.pathname]);

  useEffect(() => {
    const checkAlerts = async () => {
      try {
        const token = localStorage.getItem('rusertech_token');
        if (!token) return;
        const res = await fetch('http://localhost:3000/api/v1/alerts', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          // Endpoint might return an array or an object like { data: [...] }
          const alertsArray = Array.isArray(data) ? data : (data.data || []);
          const openAlerts = alertsArray.filter((a: any) => a.status !== 'resolved');
          setHasAlerts(openAlerts.length > 0);
        }
      } catch (e) {
        // No romper el layout si el parseo falla, pero dejar rastro:
        // un catch vacío acá ya ocultó bugs durante semanas en este proyecto.
        console.warn('[AppLayout] No se pudo procesar la configuración de UI:', e);
      }
    };
    
    checkAlerts();
    const interval = setInterval(checkAlerts, 15000); // 15s
    return () => clearInterval(interval);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="h-screen bg-gradient-bg flex flex-col text-textPrimary relative overflow-hidden">
      {/* Navbar */}
      <nav className="bg-bgStart/98 border-b border-borderDefault backdrop-blur-md sticky top-0 z-40 shadow-[0_2px_20px_rgba(0,0,0,0.4)]">
        <div className="w-full px-3 sm:px-5">
          <div className="flex items-center justify-between h-[64px] w-full">
            
            {/* Left: Brand (flex-1 forces left side to equal right side for perfect center) */}
            <div className="flex-1 flex items-center justify-start min-w-0">
              <a href="/map" className="flex items-center gap-4 shrink-0 group">
                <div
                  className="relative flex items-center justify-center w-14 h-14 rounded-lg transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(42,179,255,0.8)]"
                  style={{ boxShadow: '0 0 15px rgba(42,179,255,0.5)' }}
                >
                  <img src="/logo_forma.png" alt="Rusertech Logo" className="w-full h-full object-cover rounded-lg" />
                </div>
                <div className="flex flex-col leading-none mt-0.5">
                  <span
                    className="text-[1.65rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-accentMint to-accentBlue tracking-wide animate-pulse"
                    style={{ textShadow: '0 0 12px rgba(42,179,255,0.3)' }}
                  >
                    Rusertech
                  </span>
                  <span className="text-xs font-bold text-white/70 tracking-widest hidden xl:block mt-1 animate-pulse">
                    Seguridad &amp; Logística
                  </span>
                </div>
              </a>
            </div>

            {/* Center: navegación agrupada */}
            {/*
              REORGANIZACIÓN (correcciones post-Etapa 2): la barra tenía 20
              ítems planos y no escalaba. El criterio de agrupación es de uso,
              no de módulo: lo que se mira todos los días queda arriba (Mapa,
              Alertas); lo que se configura una vez y no se toca más vive
              adentro de Configuración.

              Reglas que implementa este bloque:
               · cada entrada e ítem lleva un tooltip que DESCRIBE, no repite
                 el nombre;
               · los ítems respetan permisos y roles: sin permiso, no aparecen;
               · un grupo sin ningún ítem visible no se muestra (un desplegable
                 vacío es peor que nada);
               · la ruta activa resalta también al grupo padre.
            */}
            <div className="flex-auto flex justify-center items-center gap-1.5 min-w-0 px-2">
              {(() => {
                type Item = { path: string; label: string; icon: any; perm?: string; soloAdminOTenant?: boolean; soloAdmin?: boolean; tooltip: string };
                type Entrada = { id: string; label: string; icon: any; tooltip: string; items?: Item[]; path?: string; perm?: string; soloAdmin?: boolean };

                const puedeVer = (it: { perm?: string; soloAdminOTenant?: boolean; soloAdmin?: boolean }): boolean => {
                  if (it.soloAdmin && !isAdmin) return false;
                  if (it.soloAdminOTenant && !(isManagerOrOwner || isAdmin)) return false;
                  if (userRole === 'SUPERADMIN' || userRole === 'super_admin') return true;
                  if (!it.perm) return true;
                  if (isAdmin) return true;
                  return Boolean(user?.permissions?.includes(it.perm));
                };

                const ENTRADAS: Entrada[] = [
                  { id: 'map', path: '/map', label: t('nav.map'), icon: Map, perm: 'view_map',
                    tooltip: t('nav.tips.map') },
                  { id: 'alerts', path: '/alerts', label: t('nav.alerts'), icon: Bell, perm: 'view_alerts',
                    tooltip: t('nav.tips.alerts') },
                  { id: 'viajes', label: t('nav.trips'), icon: Route, tooltip: t('nav.tips.trips_group'), items: [
                    { path: '/trips', label: t('nav.trips'), icon: Route, perm: 'view_trips', tooltip: t('nav.tips.trips') },
                    { path: '/routes', label: t('nav.routes'), icon: Navigation, perm: 'view_locations', tooltip: t('nav.tips.routes') },
                    // Movida desde Configuración (corrección de producto): un
                    // monitorista consulta ubicaciones todos los días, y no
                    // debería hacerlo desde un menú que dice "Configuración".
                    { path: '/locations', label: t('nav.locations'), icon: MapPin, perm: 'view_locations', tooltip: t('nav.tips.locations') },
                  ]},
                  { id: 'flota', label: t('nav.fleet'), icon: Truck, tooltip: t('nav.tips.fleet_group'), items: [
                    { path: '/vehicles', label: t('nav.vehicles'), icon: Truck, perm: 'view_vehicles', tooltip: t('nav.tips.vehicles') },
                    { path: '/drivers', label: t('nav.drivers'), icon: Users, perm: 'view_drivers', tooltip: t('nav.tips.drivers') },
                    { path: '/carriers', label: t('nav.carriers'), icon: Building2, perm: 'view_carriers', tooltip: t('nav.tips.carriers') },
                    { path: '/devices', label: t('nav.devices'), icon: Smartphone, perm: 'view_devices', tooltip: t('nav.tips.devices') },
                    // Movida desde Configuración: son lecturas de los
                    // vehículos, dato operativo, no configuración.
                    { path: '/sensors', label: t('nav.sensors'), icon: Thermometer, perm: 'view_sensors', tooltip: t('nav.tips.sensors') },
                  ]},
                  { id: 'reportes', label: t('nav.reportes'), icon: BarChart3, tooltip: t('nav.tips.reports_group'), items: [
                    { path: '/reportes', label: t('nav.reportes'), icon: BarChart3, perm: 'view_analytics', tooltip: t('nav.tips.reportes') },
                    { path: '/analytics', label: t('nav.analytics'), icon: PieChart, perm: 'view_analytics', tooltip: t('nav.tips.analytics') },
                    { path: '/carbon', label: t('nav.carbon'), icon: Leaf, perm: 'view_carbon', tooltip: t('nav.tips.carbon') },
                  ]},
                  { id: 'config', label: t('nav.config'), icon: Settings, tooltip: t('nav.tips.config_group'), items: [
                    { path: '/avl', label: t('nav.avl'), icon: Radio, perm: 'view_avl', tooltip: t('nav.tips.avl') },
                    { path: '/motor', label: t('nav.motor'), icon: Cpu, perm: 'view_settings', soloAdminOTenant: true, tooltip: t('nav.tips.motor') },
                    { path: '/admin/protocols', label: t('nav.protocols'), icon: ShieldAlert, perm: 'view_settings', soloAdminOTenant: true, tooltip: t('nav.tips.protocols') },
                    { path: '/admin/security-keys', label: t('nav.securityKeys'), icon: Key, perm: 'view_settings', soloAdminOTenant: true, tooltip: t('nav.tips.securityKeys') },
                    { path: '/settings', label: t('nav.settings'), icon: Settings, perm: 'view_settings', soloAdminOTenant: true, tooltip: t('nav.tips.settings') },
                    { path: '/simulator', label: t('nav.simulator'), icon: Zap, perm: 'view_simulator', tooltip: t('nav.tips.simulator') },
                  ]},
                  { id: 'admin', path: '/admin', label: t('nav.admin'), icon: Shield, perm: 'admin_global', soloAdmin: true,
                    tooltip: t('nav.tips.admin') },
                ];

                return ENTRADAS.map((entrada) => {
                  // Entrada directa (sin submenú)
                  if (entrada.path) {
                    if (!puedeVer(entrada)) return null;
                    const isActive = location.pathname.startsWith(entrada.path);
                    const isAlerts = entrada.path === '/alerts' && hasAlerts;
                    return (
                      <Link key={entrada.id} to={entrada.path} title={entrada.tooltip}
                        className={`flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-lg transition-all duration-150 flex-shrink-0 min-w-[72px] ${
                          isAlerts
                            ? 'bg-red-600/40 text-white border border-red-500 shadow-[0_0_14px_rgba(255,0,0,0.7)] animate-pulse'
                            : isActive
                              ? 'bg-accentGreen/10 text-white border border-accentGreen/40'
                              : 'text-white hover:bg-white/10 border border-transparent hover:border-white/20'
                        }`}>
                        <entrada.icon className={`w-[18px] h-[18px] ${isAlerts ? 'text-red-400' : isActive ? 'text-accentGreen' : 'text-white'}`} />
                        <span className="text-[10px] font-bold tracking-wide">{entrada.label}</span>
                      </Link>
                    );
                  }

                  // Grupo con submenú
                  const visibles = (entrada.items ?? []).filter(puedeVer);
                  if (visibles.length === 0) return null;   // desplegable vacío: no se muestra
                  const grupoActivo = visibles.some((it) => location.pathname.startsWith(it.path));
                  const abierto = grupoAbierto === entrada.id;

                  return (
                    <div key={entrada.id} className="relative flex-shrink-0">
                      <button
                        onClick={() => setGrupoAbierto(abierto ? null : entrada.id)}
                        title={entrada.tooltip}
                        className={`flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-lg transition-all duration-150 min-w-[72px] ${
                          grupoActivo
                            ? 'bg-accentGreen/10 text-white border border-accentGreen/40'
                            : abierto
                              ? 'bg-white/10 text-white border border-white/20'
                              : 'text-white hover:bg-white/10 border border-transparent hover:border-white/20'
                        }`}>
                        <entrada.icon className={`w-[18px] h-[18px] ${grupoActivo ? 'text-accentGreen' : 'text-white'}`} />
                        <span className="text-[10px] font-bold tracking-wide flex items-center gap-0.5">
                          {entrada.label}
                          <ChevronDown className={`w-3 h-3 transition-transform ${abierto ? 'rotate-180' : ''}`} />
                        </span>
                      </button>

                      {abierto && (
                        <>
                          {/* Clic afuera cierra el menú */}
                          <div className="fixed inset-0 z-40" onClick={() => setGrupoAbierto(null)} />
                          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 min-w-[220px] rounded-xl border border-borderDefault shadow-2xl overflow-hidden"
                            style={{ background: 'rgba(10,18,30,0.97)', backdropFilter: 'blur(14px)' }}>
                            {visibles.map((it) => {
                              const itemActivo = location.pathname.startsWith(it.path);
                              return (
                                <Link key={it.path} to={it.path} title={it.tooltip}
                                  className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                                    itemActivo ? 'bg-accentGreen/10 text-accentGreen' : 'text-textSecondary hover:bg-white/5 hover:text-white'
                                  }`}>
                                  <it.icon className="w-4 h-4 flex-shrink-0" />
                                  <span className="min-w-0">
                                    <span className="block font-bold">{it.label}</span>
                                    <span className="block text-[10px] text-textMuted leading-tight">{it.tooltip}</span>
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Right: User info + Language + Logout (flex-1 keeps symmetry) */}
            <div className="flex-1 flex items-center justify-end gap-3 min-w-0">
              <span className="text-xs font-bold text-white hidden lg:block truncate max-w-[140px] drop-shadow-md">
                {user?.email}
              </span>
              
              {/* Language Switcher */}
              <button
                onClick={() => i18n.changeLanguage(i18n.language.startsWith('es') ? 'en' : 'es')}
                className="flex items-center justify-center w-6 h-6 text-[9px] font-black text-white bg-white/10 hover:bg-accentBlue/20 hover:text-accentMint border border-white/20 rounded-md transition-colors shadow-sm shrink-0"
                title={t('nav.change_language')}
              >
                {i18n.language.startsWith('es') ? 'EN' : 'ES'}
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-1.5 text-white hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10 shrink-0"
                title={t('nav.logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full overflow-y-auto" style={{ minHeight: 0 }}>
        <Outlet />
      </main>
    </div>
  );

};
