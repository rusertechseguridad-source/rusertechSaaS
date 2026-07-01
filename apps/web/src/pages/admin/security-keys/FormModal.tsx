import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Key } from 'lucide-react';
import type { SecurityKey, CreateSecurityKeyDTO } from './types';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: SecurityKey | null;
  isSaving: boolean;
}

export const FormModal: React.FC<FormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isSaving
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<CreateSecurityKeyDTO>>({
    name: '',
    description: '',
    is_active: true
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        name: '',
        description: '',
        is_active: true
      });
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      setError('El nombre de la clave es requerido');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1A2346] border border-[#2D3B6A] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-[#2D3B6A]">
          <div className="flex items-center gap-3 text-cyan-400">
            <Key className="w-6 h-6" />
            <h2 className="text-xl font-bold tracking-wide text-white">
              {initialData ? t('securityKeys.form.editTitle') : t('securityKeys.form.createTitle')}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form id="security-key-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">{t('securityKeys.form.name')}</label>
              <input
                type="text"
                className="w-full bg-[#151B36] border border-[#2D3B6A] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors uppercase font-mono"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                required
                placeholder="Ej. PANICO"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">{t('securityKeys.form.description')}</label>
              <textarea
                className="w-full bg-[#151B36] border border-[#2D3B6A] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors resize-none"
                rows={3}
                value={formData.description || ''}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="flex items-center pt-2">
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <div className={`block w-12 h-6 rounded-full transition-colors ${formData.is_active ? 'bg-cyan-500' : 'bg-gray-600'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.is_active ? 'transform translate-x-6' : ''}`}></div>
                </div>
                <span className="ml-3 text-sm font-medium text-gray-300">{t('securityKeys.form.isActive')}</span>
              </label>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-[#2D3B6A] flex justify-end gap-3 bg-[#151B36]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2.5 bg-[#2D3B6A] hover:bg-[#3A4C8A] text-white rounded-lg transition-colors font-medium disabled:opacity-50"
          >
            {t('securityKeys.form.cancel')}
          </button>
          <button
            type="submit"
            form="security-key-form"
            disabled={isSaving}
            className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-[#0B1120] rounded-lg transition-colors font-bold disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && <div className="w-4 h-4 border-2 border-[#0B1120] border-t-transparent rounded-full animate-spin" />}
            {t('securityKeys.form.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
