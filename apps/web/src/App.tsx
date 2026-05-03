import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PublicLayout } from './layouts/PublicLayout';
import { AppLayout } from './layouts/AppLayout';
import { PublicGuard } from './components/PublicGuard';

import { HomePage } from './pages/public/HomePage';
import { NosotrosPage } from './pages/public/NosotrosPage';
import { ServiciosPage } from './pages/public/ServiciosPage';
import { ContactoPage } from './pages/public/ContactoPage';

import { LoginPage } from './pages/auth/LoginPage';

// Stub map page for authenticated users
const MapPage = () => <div className="p-8">Bienvenido al Mapa (SaaS Dashboard)</div>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        
        {/* Rutas Públicas con PublicGuard y PublicLayout */}
        <Route element={<PublicGuard />}>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/nosotros" element={<NosotrosPage />} />
            <Route path="/servicios" element={<ServiciosPage />} />
            <Route path="/contacto" element={<ContactoPage />} />
          </Route>
        </Route>

        {/* Login - Sin Layout */}
        <Route path="/login" element={<LoginPage />} />

        {/* Rutas Privadas del SaaS - AppLayout */}
        <Route element={<AppLayout />}>
          <Route path="/map" element={<MapPage />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;
