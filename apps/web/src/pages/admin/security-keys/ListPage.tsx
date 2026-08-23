import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, Plus, Edit2, Trash2, Filter } from 'lucide-react';
import { useSecurityKeys, useCreateSecurityKey, useUpdateSecurityKey, useDeleteSecurityKey } from './api';
import { FormModal } from './FormModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import type { SecurityKey } from './types';
import { useToastStore } from '../../../store/toastStore';
import { RequirePermission } from '../../../components/RequirePermission';
import i18n from '../../../i18n/config';

import esLocales from './locales/es.json';
import enLocales from './locales/en.json';

// Inject locales dynamically
i18n.addResourceBundle('es', 'translation', { securityKeys: esLocales }, true, true);
i18n.addResourceBundle('en', 'translation', { securityKeys: enLocales }, true, true);

export const SecurityKeysListPage: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  
  const [filters, setFilters] = useState<{ is_active?: boolean }>({});
  const { data, isLoading, error } = useSecurityKeys(filters);
  const securityKeys = data?.data || [];

  const createMutation = useCreateSecurityKey();
  const updateMutation = useUpdateSecurityKey();
  const deleteMutation = useDeleteSecurityKey();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<SecurityKey | null>(null);

  const handleOpenCreate = () => {
    setSelectedKey(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (key: SecurityKey) => {
    setSelectedKey(key);
    setIsFormOpen(true);
  };

  const handleOpenDelete = (key: SecurityKey) => {
    setSelectedKey(key);
    setIsDeleteOpen(true);
  };

  const handleFormSubmit = async (formData: any) => {
    try {
      if (selectedKey) {
        await updateMutation.mutateAsync({ id: selectedKey.id, data: formData });
        addToast(t('securityKeys.toasts.updated'), 'success');
      } else {
        await createMutation.mutateAsync(formData);
        addToast(t('securityKeys.toasts.created'), 'success');
      }
      setIsFormOpen(false);
    } catch (err: any) {
      addToast(err.message || 'Error al guardar', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedKey) return;
    try {
      await deleteMutation.mutateAsync(selectedKey.id);
      addToast(t('securityKeys.toasts.deleted'), 'success');
      setIsDeleteOpen(false);
    } catch (err: any) {
      addToast(err.message || 'Error al eliminar', 'error');
    }
  };

  const handleToggleActive = async (key: SecurityKey) => {
    try {
      await updateMutation.mutateAsync({ id: key.id, data: { is_active: !key.is_active } });
      addToast(t('securityKeys.toasts.statusChanged'), 'success');
    } catch (err: any) {
      addToast(err.message || 'Error al actualizar estado', 'error');
    }
  };

  return (
    <RequirePermission permission="manage_settings">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#1A2346] p-6 rounded-xl border border-[#2D3B6A] shadow-lg">
          <div>
            <div className="flex items-center gap-3">
              <Key className="w-8 h-8 text-cyan-400" />
              <h1 className="text-2xl font-bold text-white tracking-wide">{t('securityKeys.title')}</h1>
            </div>
            <p className="text-gray-400 mt-1">{t('securityKeys.subtitle')}</p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-[#0B1120] font-bold rounded-lg transition-colors shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-5 h-5" />
            {t('securityKeys.createButton')}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 bg-[#1A2346] p-4 rounded-xl border border-[#2D3B6A]">
          <div className="flex items-center gap-2 text-gray-400 px-2">
            <Filter className="w-4 h-4" />
          </div>
          <select 
            className="bg-[#151B36] border border-[#2D3B6A] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            value={filters.is_active === undefined ? '' : String(filters.is_active)}
            onChange={e => {
              const val = e.target.value;
              setFilters(prev => ({ ...prev, is_active: val === '' ? undefined : val === 'true' }));
            }}
          >
            <option value="">{t('securityKeys.table.status')}: {t('securityKeys.filters.all')}</option>
            <option value="true">{t('securityKeys.filters.active')}</option>
            <option value="false">{t('securityKeys.filters.inactive')}</option>
          </select>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-center">
            Error al cargar los datos. Reintente más tarde.
          </div>
        )}

        {/* Table */}
        <div className="bg-[#1A2346] border border-[#2D3B6A] rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-[#151B36] text-gray-400 uppercase text-xs font-semibold tracking-wider border-b border-[#2D3B6A]">
                <tr>
                  <th className="px-6 py-4">{t('securityKeys.table.name')}</th>
                  <th className="px-6 py-4">{t('securityKeys.table.description')}</th>
                  <th className="px-6 py-4 text-center">{t('securityKeys.table.status')}</th>
                  <th className="px-6 py-4 text-right">{t('securityKeys.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D3B6A]">
                {isLoading ? (
                  // Skeleton
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-[#2D3B6A] rounded w-1/3"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-[#2D3B6A] rounded w-2/3"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-[#2D3B6A] rounded w-8 mx-auto"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-[#2D3B6A] rounded w-16 ml-auto"></div></td>
                    </tr>
                  ))
                ) : securityKeys.length === 0 ? (
                  // Empty state
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      <Key className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>No se encontraron claves de seguridad.</p>
                    </td>
                  </tr>
                ) : (
                  securityKeys.map((key: SecurityKey) => (
                    <tr key={key.id} className="hover:bg-[#2D3B6A]/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-white uppercase">{key.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-400">{key.description || '-'}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={key.is_active}
                            onChange={() => handleToggleActive(key)}
                          />
                          <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                        </label>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenEdit(key)}
                            className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-cyan-400/10 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(key)}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <FormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        initialData={selectedKey}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />

      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        securityKey={selectedKey}
        isDeleting={deleteMutation.isPending}
      />
    </RequirePermission>
  );
};
