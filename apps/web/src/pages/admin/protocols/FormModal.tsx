import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Trash2, ShieldAlert } from 'lucide-react';
import type { OperationalProtocol, CreateProtocolDTO, ProtocolStep } from './types';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: OperationalProtocol | null;
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
  const [formData, setFormData] = useState<Partial<CreateProtocolDTO>>({
    name: '',
    description: '',
    trip_status: 'en_curso',
    sub_status: 'normal',
    gps_reporting: 'online',
    driver_communication: 'ok',
    risk_level: 'bajo',
    sla_minutes: 15,
    is_active: true,
    protocol_steps: []
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        name: '',
        description: '',
        trip_status: 'en_curso',
        sub_status: 'normal',
        gps_reporting: 'online',
        driver_communication: 'ok',
        risk_level: 'bajo',
        sla_minutes: 15,
        is_active: true,
        protocol_steps: []
      });
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      setError('El nombre es requerido');
      return;
    }
    onSubmit(formData);
  };

  const handleAddStep = () => {
    setFormData(prev => ({
      ...prev,
      protocol_steps: [...(prev.protocol_steps || []), { title: '', description: '' }]
    }));
  };

  const handleUpdateStep = (index: number, field: keyof ProtocolStep, value: string) => {
    const newSteps = [...(formData.protocol_steps || [])];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setFormData(prev => ({ ...prev, protocol_steps: newSteps }));
  };

  const handleRemoveStep = (index: number) => {
    setFormData(prev => ({
      ...prev,
      protocol_steps: (prev.protocol_steps || []).filter((_, i) => i !== index)
    }));
  };

  const enumOptions = (enumName: string) => {
    const options = t(`enums.${enumName}`, { returnObjects: true }) as Record<string, string>;
    return Object.entries(options || {}).map(([val, label]) => (
      <option key={val} value={val}>{label}</option>
    ));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1A2346] border border-[#2D3B6A] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[#2D3B6A]">
          <div className="flex items-center gap-3 text-cyan-400">
            <ShieldAlert className="w-6 h-6" />
            <h2 className="text-xl font-bold tracking-wide text-white">
              {initialData ? t('protocols.form.editTitle') : t('protocols.form.createTitle')}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-[#2D3B6A] scrollbar-track-transparent">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form id="protocol-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Información General */}
              <div className="space-y-4 md:col-span-2">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Información General</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('protocols.form.name')}</label>
                    <input
                      type="text"
                      className="w-full bg-[#151B36] border border-[#2D3B6A] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                      value={formData.name || ''}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('protocols.form.description')}</label>
                    <input
                      type="text"
                      className="w-full bg-[#151B36] border border-[#2D3B6A] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                      value={formData.description || ''}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Condiciones de Disparo */}
              <div className="space-y-4 md:col-span-2 pt-4 border-t border-[#2D3B6A]/50">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Condiciones de Activación</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('protocols.form.tripStatus')}</label>
                    <select
                      className="w-full bg-[#151B36] border border-[#2D3B6A] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors appearance-none"
                      value={formData.trip_status || ''}
                      onChange={e => setFormData({ ...formData, trip_status: e.target.value })}
                    >
                      {enumOptions('trip_status')}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('protocols.form.subStatus')}</label>
                    <select
                      className="w-full bg-[#151B36] border border-[#2D3B6A] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors appearance-none"
                      value={formData.sub_status || ''}
                      onChange={e => setFormData({ ...formData, sub_status: e.target.value })}
                    >
                      {enumOptions('sub_status')}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('protocols.form.gpsReporting')}</label>
                    <select
                      className="w-full bg-[#151B36] border border-[#2D3B6A] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors appearance-none"
                      value={formData.gps_reporting || ''}
                      onChange={e => setFormData({ ...formData, gps_reporting: e.target.value })}
                    >
                      {enumOptions('gps_reporting')}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('protocols.form.driverCommunication')}</label>
                    <select
                      className="w-full bg-[#151B36] border border-[#2D3B6A] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors appearance-none"
                      value={formData.driver_communication || ''}
                      onChange={e => setFormData({ ...formData, driver_communication: e.target.value })}
                    >
                      {enumOptions('driver_communication')}
                    </select>
                  </div>
                </div>
              </div>

              {/* Riesgo y SLA */}
              <div className="space-y-4 md:col-span-2 pt-4 border-t border-[#2D3B6A]/50">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Resolución</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('protocols.form.riskLevel')}</label>
                    <select
                      className="w-full bg-[#151B36] border border-[#2D3B6A] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors appearance-none font-semibold text-cyan-400"
                      value={formData.risk_level || ''}
                      onChange={e => setFormData({ ...formData, risk_level: e.target.value })}
                    >
                      {enumOptions('risk_level')}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">{t('protocols.form.slaMinutes')}</label>
                    <input
                      type="number"
                      className="w-full bg-[#151B36] border border-[#2D3B6A] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                      value={formData.sla_minutes || 0}
                      onChange={e => setFormData({ ...formData, sla_minutes: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex items-center h-full pt-6">
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
                      <span className="ml-3 text-sm font-medium text-gray-300">{t('protocols.form.isActive')}</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Protocol Steps (Estructurado) */}
              <div className="space-y-4 md:col-span-2 pt-4 border-t border-[#2D3B6A]/50">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{t('protocols.form.steps')}</h3>
                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors px-3 py-1.5 bg-cyan-500/10 rounded-lg hover:bg-cyan-500/20"
                  >
                    <Plus className="w-4 h-4" />
                    {t('protocols.form.addStep')}
                  </button>
                </div>
                
                <div className="space-y-3">
                  {formData.protocol_steps?.map((step, idx) => (
                    <div key={idx} className="flex gap-3 items-start bg-[#151B36] p-4 rounded-lg border border-[#2D3B6A]">
                      <div className="flex-1 space-y-3">
                        <input
                          type="text"
                          placeholder={t('protocols.form.stepTitle')}
                          className="w-full bg-[#1A2346] border border-[#2D3B6A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 text-sm font-medium placeholder-gray-500"
                          value={step.title}
                          onChange={e => handleUpdateStep(idx, 'title', e.target.value)}
                          required
                        />
                        <textarea
                          placeholder={t('protocols.form.stepDescription')}
                          rows={2}
                          className="w-full bg-[#1A2346] border border-[#2D3B6A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 text-sm resize-none placeholder-gray-500"
                          value={step.description}
                          onChange={e => handleUpdateStep(idx, 'description', e.target.value)}
                          required
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(idx)}
                        className="text-gray-500 hover:text-red-400 transition-colors p-2"
                        title="Eliminar paso"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  
                  {(!formData.protocol_steps || formData.protocol_steps.length === 0) && (
                    <div className="text-center p-8 border-2 border-dashed border-[#2D3B6A] rounded-lg text-gray-500 text-sm">
                      No hay pasos definidos para este protocolo. Haz clic en "Agregar Paso" para comenzar.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#2D3B6A] flex justify-end gap-3 bg-[#151B36] rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2.5 bg-[#2D3B6A] hover:bg-[#3A4C8A] text-white rounded-lg transition-colors font-medium disabled:opacity-50"
          >
            {t('protocols.form.cancel')}
          </button>
          <button
            type="submit"
            form="protocol-form"
            disabled={isSaving}
            className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-[#0B1120] rounded-lg transition-colors font-bold disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && <div className="w-4 h-4 border-2 border-[#0B1120] border-t-transparent rounded-full animate-spin" />}
            {t('protocols.form.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
