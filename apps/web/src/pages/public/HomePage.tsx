import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Fuel, ShieldCheck, BarChart3 } from 'lucide-react'; // Instead of emojis we use lucide icons as suggested

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 w-full">
      {/* HERO SECTION */}
      <section className="bg-gradient-bg py-20 md:py-32 text-center px-4">
        <h1 className="font-display font-extrabold text-4xl md:text-5xl lg:text-6xl max-w-4xl mx-auto leading-tight mb-6">
          Transforma la telemetría de tu flota en inteligencia financiera.
        </h1>
        <p className="font-body text-lg md:text-xl text-textSecondary max-w-3xl mx-auto mb-10 leading-relaxed">
          Rusertech no es solo un mapa de puntos en movimiento. Es el control en tiempo real de tu mayor activo operativo: cada kilómetro recorrido, cada desvío, cada parada. Convertidos en datos que protegen tu dinero.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button 
            onClick={() => navigate('/contacto')}
            className="bg-gradient-accent text-textOnAccent font-bold px-8 py-3.5 rounded-xl hover:shadow-glow-green transition-shadow w-full sm:w-auto"
          >
            Solicitar demo
          </button>
          <button 
            onClick={() => navigate('/servicios')}
            className="bg-transparent border border-accentGreen text-accentGreen font-bold px-8 py-3.5 rounded-xl hover:bg-[rgba(124,255,60,0.1)] transition-colors w-full sm:w-auto"
          >
            Ver servicios
          </button>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="py-20 px-4 max-w-7xl mx-auto">
        <h2 className="font-display font-bold text-3xl text-textPrimary text-center mb-16">
          Todo lo que necesitás para operar con certeza
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="bg-bgSurface border border-borderDefault rounded-xl p-8 shadow-card flex flex-col items-start">
            <Fuel className="text-accentBlue w-10 h-10 mb-4" />
            <h3 className="font-display font-bold text-xl text-textPrimary mb-3">Control de combustible</h3>
            <p className="font-body text-sm text-textSecondary leading-relaxed">
              Detecta consumos anómalos, paradas no autorizadas y desvíos de ruta antes de que impacten en tu estado de resultados.
            </p>
          </div>

          <div className="bg-bgSurface border border-borderDefault rounded-xl p-8 shadow-card flex flex-col items-start">
            <ShieldCheck className="text-accentGreen w-10 h-10 mb-4" />
            <h3 className="font-display font-bold text-xl text-textPrimary mb-3">Seguridad de carga</h3>
            <p className="font-body text-sm text-textSecondary leading-relaxed">
              Alertas en tiempo real, bloqueo remoto de vehículos y notificaciones automáticas a prestadores AVL ante cualquier incidente.
            </p>
          </div>

          <div className="bg-bgSurface border border-borderDefault rounded-xl p-8 shadow-card flex flex-col items-start">
            <BarChart3 className="text-accentMint w-10 h-10 mb-4" />
            <h3 className="font-display font-bold text-xl text-textPrimary mb-3">Analytics que generan ahorro</h3>
            <p className="font-body text-sm text-textSecondary leading-relaxed">
              KPIs de flota, huella de carbono, rendimiento por chofer y comparativas mensuales. Todo exportable a Excel.
            </p>
          </div>

        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 px-4 max-w-4xl mx-auto">
        <div className="bg-bgSurface border border-borderAccent p-10 md:p-16 rounded-2xl text-center shadow-glow-green">
          <h2 className="font-display font-bold text-3xl md:text-4xl text-textPrimary mb-4">
            ¿Listo para tomar el control de tu flota?
          </h2>
          <p className="font-body text-lg text-textSecondary mb-8">
            Hablemos. Sin compromiso, sin tecnicismos.
          </p>
          <button 
            onClick={() => navigate('/contacto')}
            className="bg-gradient-accent text-textOnAccent font-bold px-10 py-4 rounded-xl hover:shadow-glow-green transition-shadow text-lg inline-block"
          >
            Contactar ahora
          </button>
        </div>
      </section>
    </div>
  );
};
