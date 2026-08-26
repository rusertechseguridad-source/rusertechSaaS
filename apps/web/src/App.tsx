import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PublicLayout } from './layouts/PublicLayout';
import { AppLayout } from './layouts/AppLayout';
import { PublicGuard } from './components/PublicGuard';
import { PrivateGuard } from './components/PrivateGuard';
import { ToastContainer } from './components/ToastContainer';

/**
 * ⚠️ CORRECCIÓN DE RAÍZ — este provider NO EXISTÍA en toda la aplicación.
 *
 * Siete módulos usan hooks de @tanstack/react-query (protocolos, claves de
 * seguridad, NDR, parámetros operativos, monitoreo, monitor AVL y el motor).
 * Sin un QueryClientProvider en el árbol, `useQuery` lanza una excepción al
 * montarse, el componente crashea, y —sin barrera de errores— React desmonta
 * el árbol completo: pantalla en blanco, sin mensaje.
 *
 * Nadie lo notó antes porque los primeros consumidores (NDR y Operativos)
 * estaban escritos dentro del modal de edición de usuario y nunca llegaban a
 * montarse. Cada pantalla nueva con react-query heredaba el crash.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Un reintento y basta: estas pantallas ya manejan su estado de error,
      // y tres reintentos por defecto solo retrasan el mensaje al usuario.
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

import { HomePage } from './pages/public/HomePage';
import { NosotrosPage } from './pages/public/NosotrosPage';
import { ServiciosPage } from './pages/public/ServiciosPage';
import { ContactoPage } from './pages/public/ContactoPage';

import { LoginPage } from './pages/auth/LoginPage';
import { AvlUserListPage } from './pages/avl/AvlUserListPage';
import { AvlEventDictionaryPage } from './pages/avl/AvlEventDictionaryPage';
import { AvlMonitorPage } from './pages/avl/monitor/AvlMonitorPage';
import { MotorMonitorPage } from './pages/admin/motor/MotorMonitorPage';
import { ReportesPage } from './pages/reportes/ReportesPage';
import { VehiclesPage } from './pages/vehicles/VehiclesPage';
import { LocationsPage } from './pages/locations/LocationsPage';
import { RoutesPage } from './pages/routes/RoutesPage';
import { TripsPage } from './pages/trips/TripsPage';
import { TripDetailsPage } from './pages/trips/TripDetailsPage';
import { CarriersPage } from './pages/carriers/CarriersPage';
import { DriversPage } from './pages/drivers/DriversPage';
import { AlertsPage } from './pages/alerts/AlertsPage';
import { SimulatorPage } from './pages/dev/SimulatorPage';
import { MapPage } from './pages/map/MapPage';
import { DevicesPage } from './pages/devices/DevicesPage';
import { SensorsDashboardPage } from './pages/sensors/SensorsDashboardPage';
import { AnalyticsDashboard } from './pages/analytics/AnalyticsDashboard';
import { CarbonDashboard } from './pages/carbon/CarbonDashboard';
import { AdminPage } from './pages/admin/AdminPage';
import ProtocolsListPage from './pages/admin/protocols';
import SecurityKeysListPage from './pages/admin/security-keys';
import { SettingsPage } from './pages/settings/SettingsPage';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ToastContainer />
      <ErrorBoundary>
      <Routes>
        
        {/* Rutas Públicas con PublicGuard y PublicLayout */}
        <Route element={<PublicGuard />}>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/nosotros" element={<NosotrosPage />} />
            <Route path="/servicios" element={<ServiciosPage />} />
            <Route path="/contacto" element={<ContactoPage />} />
          </Route>
          {/* Login - Sin Layout */}
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Rutas Privadas del SaaS - AppLayout */}
        <Route element={<PrivateGuard />}>
          <Route element={<AppLayout />}>
            <Route path="/map" element={<MapPage />} />
            <Route path="/avl" element={<AvlUserListPage />} />
            <Route path="/avl/monitor" element={<AvlMonitorPage />} />
            <Route path="/motor" element={<MotorMonitorPage />} />
            <Route path="/reportes" element={<ReportesPage />} />
            <Route path="/avl/:id/dictionary" element={<AvlEventDictionaryPage />} />
            <Route path="/vehicles" element={<VehiclesPage />} />
            <Route path="/carriers" element={<CarriersPage />} />
            <Route path="/drivers" element={<DriversPage />} />
            <Route path="/locations" element={<LocationsPage />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/trips" element={<TripsPage />} />
            <Route path="/trips/:id" element={<TripDetailsPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/sensors" element={<SensorsDashboardPage />} />
            <Route path="/analytics" element={<AnalyticsDashboard />} />
            <Route path="/carbon" element={<CarbonDashboard />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/protocols" element={<ProtocolsListPage />} />
            <Route path="/admin/security-keys" element={<SecurityKeysListPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/simulator" element={<SimulatorPage />} />
          </Route>
        </Route>

      </Routes>
      </ErrorBoundary>
    </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
