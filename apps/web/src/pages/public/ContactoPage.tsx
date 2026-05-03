import React, { useState } from 'react';
import { Mail, Globe, MapPin } from 'lucide-react';

export const ContactoPage: React.FC = () => {
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate sending
    setSuccess(true);
    setTimeout(() => setSuccess(false), 5000);
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-16">
      
      <div className="text-center mb-16">
        <h1 className="font-display font-extrabold text-4xl text-textPrimary mb-4">Hablemos</h1>
        <p className="font-body text-xl text-textSecondary">Completá el formulario y te contactamos en menos de 24 horas.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-20">
        
        {/* Formulario */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-bgSurface border border-borderDefault p-8 rounded-xl flex flex-col gap-6">
            
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="text-textPrimary font-medium text-sm">Nombre completo*</label>
              <input required type="text" id="name" placeholder="Ej. Juan Pérez" className="bg-bgSurfaceHigh border border-borderDefault rounded-lg px-4 py-2.5 text-textPrimary font-body focus:outline-none focus:border-borderAccent transition-colors placeholder:text-textMuted" />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-textPrimary font-medium text-sm">Email corporativo*</label>
              <input required type="email" id="email" placeholder="juan@empresa.com" className="bg-bgSurfaceHigh border border-borderDefault rounded-lg px-4 py-2.5 text-textPrimary font-body focus:outline-none focus:border-borderAccent transition-colors placeholder:text-textMuted" />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="company" className="text-textPrimary font-medium text-sm">Empresa*</label>
              <input required type="text" id="company" placeholder="Nombre de tu empresa" className="bg-bgSurfaceHigh border border-borderDefault rounded-lg px-4 py-2.5 text-textPrimary font-body focus:outline-none focus:border-borderAccent transition-colors placeholder:text-textMuted" />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="fleetSize" className="text-textPrimary font-medium text-sm">Tamaño de flota</label>
              <select id="fleetSize" className="bg-bgSurfaceHigh border border-borderDefault rounded-lg px-4 py-2.5 text-textPrimary font-body focus:outline-none focus:border-borderAccent transition-colors">
                <option value="1-10">1-10 vehículos</option>
                <option value="11-50">11-50 vehículos</option>
                <option value="51-200">51-200 vehículos</option>
                <option value="200+">Más de 200 vehículos</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="message" className="text-textPrimary font-medium text-sm">Mensaje</label>
              <textarea id="message" rows={4} placeholder="Contanos sobre tu operación..." className="bg-bgSurfaceHigh border border-borderDefault rounded-lg px-4 py-2.5 text-textPrimary font-body focus:outline-none focus:border-borderAccent transition-colors placeholder:text-textMuted resize-none"></textarea>
            </div>

            <button type="submit" className="bg-gradient-accent text-textOnAccent font-bold px-8 py-3 rounded-lg hover:shadow-glow-green transition-shadow w-full mt-2">
              Enviar consulta
            </button>

            {success && (
              <div className="bg-[rgba(34,197,94,0.1)] border border-statusOnline text-statusOnline px-4 py-3 rounded-lg text-center font-medium animate-pulse">
                ✅ ¡Gracias! Te contactamos en menos de 24 horas.
              </div>
            )}
          </form>
        </div>

        {/* Información Lateral */}
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-4 text-textSecondary hover:text-textPrimary transition-colors">
            <div className="bg-bgSurfaceHigh p-4 rounded-full">
              <Mail className="w-6 h-6 text-accentBlue" />
            </div>
            <span className="font-body text-lg">info@rusertech.com</span>
          </div>

          <div className="flex items-center gap-4 text-textSecondary hover:text-textPrimary transition-colors">
            <div className="bg-bgSurfaceHigh p-4 rounded-full">
              <Globe className="w-6 h-6 text-accentGreen" />
            </div>
            <span className="font-body text-lg">rusertech.com</span>
          </div>

          <div className="flex items-center gap-4 text-textSecondary hover:text-textPrimary transition-colors">
            <div className="bg-bgSurfaceHigh p-4 rounded-full">
              <MapPin className="w-6 h-6 text-statusWarning" />
            </div>
            <span className="font-body text-lg">Argentina</span>
          </div>
        </div>

      </div>
    </div>
  );
};
