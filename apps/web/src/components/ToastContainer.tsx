import React from 'react';
import { useToastStore } from '../store/toastStore';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map(t => (
        <div 
          key={t.id} 
          className="pointer-events-auto flex items-start gap-3 p-4 bg-bgSurface border border-borderHighlight rounded-xl shadow-card transform transition-all duration-300 translate-y-0 opacity-100 max-w-sm w-[350px]"
          style={{ animation: 'slideInRight 0.3s ease-out' }}
        >
          <div className="shrink-0 mt-0.5">
            {t.type === 'success' && <CheckCircle className="w-5 h-5 text-accentGreen" />}
            {t.type === 'error' && <AlertCircle className="w-5 h-5 text-statusDanger" />}
            {t.type === 'info' && <Info className="w-5 h-5 text-accentBlue" />}
          </div>
          <div className="flex-1 text-sm font-bold text-white break-words">
            {t.message}
          </div>
          <button 
            onClick={() => removeToast(t.id)} 
            className="shrink-0 text-textMuted hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
