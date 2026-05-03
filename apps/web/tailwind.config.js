/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Fondo principal
        bgStart: '#1F2A5A',
        bgEnd: '#2B2F6E',
        bgSurface: '#252D6B',
        bgSurfaceHigh: '#2E3578',
        bgOverlay: 'rgba(31,42,90,0.88)',

        // Acento
        accentGreen: '#7CFF3C',
        accentMint: '#33E1A1',
        accentBlue: '#2AB3FF',

        // Texto
        textPrimary: '#E5E7EB',
        textSecondary: '#9CA3AF',
        textMuted: '#6B7280',
        textOnAccent: '#1F2A5A',

        // Símbolo del ícono
        iconSymbol: '#1F2A5A',

        // Estados semánticos
        statusOnline: '#22C55E',
        statusWarning: '#F59E0B',
        statusDanger: '#EF4444',
        statusInfo: '#3B82F6',
        statusOffline: '#6B7280',
        statusBlocked: '#7C3AED',

        // Riesgo del Viaje
        riskNormal: '#22C55E',
        riskElevado: '#EAB308',
        riskAlto: '#F97316',
        riskCritico: '#EF4444',

        // Temperatura / Humedad
        sensorCold: '#2AB3FF',
        sensorNormal: '#33E1A1',
        sensorHot: '#F59E0B',
        sensorCritical: '#EF4444',

        // Mapa
        mapRoutePlanned: '#7CFF3C',
        mapRouteActual: '#E5E7EB',
        mapRouteDeviated: '#EF4444',
        mapGeofenceStroke: '#2AB3FF',

        // Bordes
        borderDefault: 'rgba(124,255,60,0.15)',
        borderAccent: 'rgba(124,255,60,0.50)',
        borderDanger: 'rgba(239,68,68,0.50)',
        borderWarning: 'rgba(245,158,11,0.40)',
      },
      backgroundImage: {
        'gradient-bg': 'linear-gradient(180deg, #1F2A5A 0%, #2B2F6E 100%)',
        'gradient-accent': 'linear-gradient(135deg, #7CFF3C 0%, #33E1A1 50%, #2AB3FF 100%)',
        'gradient-accent-hover': 'linear-gradient(135deg, #8FFF55 0%, #44F2B2 50%, #3BC4FF 100%)',
        'gradient-surface': 'linear-gradient(135deg, rgba(37,45,107,0.9), rgba(46,53,120,0.9))',
        'gradient-danger': 'linear-gradient(135deg, #EF4444, #DC2626)',
      },
      fontFamily: {
        display: ['"Exo 2"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.4)',
        'glow-green': '0 0 20px rgba(124,255,60,0.25)',
        'glow-blue': '0 0 20px rgba(42,179,255,0.25)',
        danger: '0 0 20px rgba(239,68,68,0.30)',
      },
      borderRadius: {
        sm: '0.375rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
        full: '9999px',
      }
    },
  },
  plugins: [],
}
