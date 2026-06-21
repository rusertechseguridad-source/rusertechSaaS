import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { login, loading, error } = useAuthStore();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      navigate('/map');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-4">
      <div className="bg-bgSurface border border-borderDefault p-8 rounded-2xl shadow-card w-full max-w-md">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-lg bg-gradient-accent flex items-center justify-center font-display font-extrabold text-iconSymbol text-2xl mb-4">
            R
          </div>
          <h1 className="font-display font-bold text-2xl text-textPrimary">{t('auth.login_title')}</h1>
          <p className="font-body text-textSecondary text-sm mt-1">{t('auth.login_subtitle')}</p>
        </div>

        {error && (
          <div className="bg-statusDanger bg-opacity-20 border border-statusDanger text-statusDanger p-3 rounded-lg mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-textPrimary font-medium text-sm">{t('auth.email')}</label>
            <input 
              required 
              type="email" 
              placeholder="usuario@empresa.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-bgSurfaceHigh border border-borderDefault rounded-lg px-4 py-2.5 text-textPrimary focus:outline-none focus:border-borderAccent transition-colors" 
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-textPrimary font-medium text-sm">{t('auth.password')}</label>
            <input 
              required 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-bgSurfaceHigh border border-borderDefault rounded-lg px-4 py-2.5 text-textPrimary focus:outline-none focus:border-borderAccent transition-colors" 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="bg-gradient-accent text-textOnAccent font-bold px-4 py-3 rounded-lg hover:shadow-glow-green transition-shadow mt-4 disabled:opacity-50"
          >
            {loading ? t('auth.logging_in') : t('auth.login_button')}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button onClick={() => navigate('/')} className="text-textSecondary text-sm hover:text-textPrimary transition-colors">
            {t('auth.back_public')}
          </button>
        </div>

      </div>
    </div>
  );
};
