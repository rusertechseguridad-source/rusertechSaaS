import React from 'react';
import { Map, Route, BellRing, Thermometer, Leaf, BarChart2 } from 'lucide-react';

export const ServiciosPage: React.FC = () => {
  const modulos = [
    {
      id: 1,
      icon: <Map className="text-accentBlue w-8 h-8" />,
      title: "Monitoreo en Tiempo Real (MapLibre GL JS)",
      description: "Mapa vectorial de alta performance con marcadores animados, geocercas configurables, zonas sin señal y reproducción histórica. Sin costos de tiles — tecnología OpenFreeMap."
    },
    {
      id: 2,
      icon: <Route className="text-accentGreen w-8 h-8" />,
      title: "Gestión de Viajes y Recorridos",
      description: "Declaración de viajes con wizard de 4 pasos, recorridos reutilizables, validación pre-ruta geoespacial y motor de riesgo dinámico por scoring."
    },
    {
      id: 3,
      icon: <BellRing className="text-statusWarning w-8 h-8" />,
      title: "Motor de Alertas Multicanal",
      description: "Reglas configurables por vehículo, viaje u operación. Notificaciones por email, push, WhatsApp y webhook. Alertas críticas, advertencias e informativas ordenadas por severidad."
    },
    {
      id: 4,
      icon: <Thermometer className="text-statusDanger w-8 h-8" />,
      title: "Control de Temperatura y Humedad",
      description: "Monitoreo de sensores en tiempo real con rangos configurables, historial gráfico y alertas automáticas. Crítico para cargas refrigeradas y farmacéuticas."
    },
    {
      id: 5,
      icon: <Leaf className="text-statusOnline w-8 h-8" />,
      title: "Huella de Carbono",
      description: "Cálculo automático de CO₂ por viaje completado. Compatible con Climatiq API para reportes verificables. Exportable a Excel."
    },
    {
      id: 6,
      icon: <BarChart2 className="text-accentMint w-8 h-8" />,
      title: "Analytics y Reportes",
      description: "Dashboard con KPIs de flota, distribución de viajes, alertas por tipo y tendencias. Selector de período semana/mes. Export CSV y XLSX."
    }
  ];

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-16">
      
      {/* Hero */}
      <div className="text-center mb-16">
        <h1 className="font-display font-extrabold text-4xl text-textPrimary mb-4">Nuestros módulos</h1>
        <p className="font-body text-xl text-textSecondary">Una plataforma modular que crece con tu operación</p>
      </div>

      {/* Grid de módulos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modulos.map((modulo) => (
          <div key={modulo.id} className="bg-bgSurface border border-borderDefault p-8 rounded-xl flex flex-col gap-4 hover:border-accentGreen transition-colors">
            <div className="flex items-center gap-4 mb-2">
              <div className="bg-[rgba(255,255,255,0.03)] p-3 rounded-lg">
                {modulo.icon}
              </div>
              <h3 className="font-display font-bold text-xl text-textPrimary">{modulo.title}</h3>
            </div>
            <p className="font-body text-textSecondary leading-relaxed">
              {modulo.description}
            </p>
          </div>
        ))}
      </div>

    </div>
  );
};
