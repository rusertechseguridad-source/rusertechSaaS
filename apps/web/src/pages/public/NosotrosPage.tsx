import React from 'react';
import { Cpu, ShieldAlert, TrendingUp } from 'lucide-react';

export const NosotrosPage: React.FC = () => {
  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-16">
      
      {/* Hero simple */}
      <div className="text-center mb-16">
        <h1 className="font-display font-extrabold text-4xl text-textPrimary mb-4">Quiénes somos</h1>
        <p className="font-body text-xl text-textSecondary">Tecnología satelital con foco en resultados</p>
      </div>

      {/* Cuerpo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
        
        {/* Col izquierda */}
        <div className="flex flex-col gap-6 text-textSecondary font-body text-lg leading-relaxed">
          <p>
            Rusertech es una plataforma SaaS especializada en seguimiento satelital vehicular para operaciones de logística, transporte de carga y distribución en Argentina y la región.
          </p>
          <p>
            Nuestra misión es transformar los datos de telemetría GPS en inteligencia operativa: reducir costos, prevenir siniestros y dar a los gerentes de flota visibilidad total sobre sus activos.
          </p>
          <p>
            No somos un proveedor de hardware GPS. Somos la capa de inteligencia que se conecta a los prestadores AVL existentes y convierte sus datos en dashboards accionables, alertas configurables y reportes financieros.
          </p>
        </div>

        {/* Col derecha */}
        <div className="flex flex-col gap-6">
          <div className="bg-bgSurface border border-borderDefault p-6 rounded-xl flex items-center gap-4">
            <div className="bg-[rgba(124,255,60,0.1)] p-3 rounded-lg">
              <Cpu className="text-accentGreen w-8 h-8" />
            </div>
            <span className="font-display font-bold text-xl text-textPrimary">Tecnología</span>
          </div>
          <div className="bg-bgSurface border border-borderDefault p-6 rounded-xl flex items-center gap-4">
            <div className="bg-[rgba(42,179,255,0.1)] p-3 rounded-lg">
              <ShieldAlert className="text-accentBlue w-8 h-8" />
            </div>
            <span className="font-display font-bold text-xl text-textPrimary">Seguridad</span>
          </div>
          <div className="bg-bgSurface border border-borderDefault p-6 rounded-xl flex items-center gap-4">
            <div className="bg-[rgba(245,158,11,0.1)] p-3 rounded-lg">
              <TrendingUp className="text-statusWarning w-8 h-8" />
            </div>
            <span className="font-display font-bold text-xl text-textPrimary">Resultados</span>
          </div>
        </div>

      </div>
    </div>
  );
};
