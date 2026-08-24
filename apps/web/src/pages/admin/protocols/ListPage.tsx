import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Plus, Edit2, Trash2, Filter } from 'lucide-react';
import { useProtocols, useCreateProtocol, useUpdateProtocol, useDeleteProtocol } from './api';
import { FormModal } from './FormModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import type { OperationalProtocol } from './types';
import { useToastStore } from '../../../store/toastStore';
import { RequirePermission } from '../../../components/RequirePermission';
import { useMotorCatalogos } from '../../../hooks/useMotorCatalogos';
import i18n from '../../../i18n/config';

import esLocales from './locales/es.json';
import enLocales from './locales/en.json';

// Inject locales dynamically
i18n.addResourceBundle('es', 'translation', { protocols: esLocales }, true, true);
i18n.addResourceBundle('en', 'translation', { protocols: enLocales }, true, true);

export const ProtocolsListPage: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  
  /*
    Los valores de los filtros salen del catálogo del motor, no de una lista
    escrita a mano. Antes esta pantalla mandaba `en_curso` y `critico` mientras
    la base tenía `in_progress` y `riesgo_critico`: TODOS los filtros devolvían
    cero filas, y nadie lo notaba porque "sin resultados" parece una respuesta
    legítima. Ahora los valores vienen de la misma tabla contra la que se
    filtra, así que no pueden desincronizarse.
  */
  const { data: catalogos } = useMotorCatalogos();

  const [filters, setFilters] = useState<{ trip_status?: string; risk_level?: string; is_active?: boolean }>({});
  const { data, isLoading, error } = useProtocols(filters);
  const protocols = data?.data || [];

  const createMutation = useCreateProtocol();
  const updateMutation = useUpdateProtocol();
  const deleteMutation = useDeleteProtocol();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<OperationalProtocol | null>(null);

  const handleOpenCreate = () => {
    setSelectedProtocol(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (protocol: OperationalProtocol) => {
    setSelectedProtocol(protocol);
    setIsFormOpen(true);
  };

  const handleOpenDelete = (protocol: OperationalProtocol) => {
    setSelectedProtocol(protocol);
    setIsDeleteOpen(true);
  };

  const handleFormSubmit = async (formData: any) => {
    try {
      if (selectedProtocol) {
        await updateMutation.mutateAsync({ id: selectedProtocol.id, data: formData });
        addToast(t('protocols.toasts.updated'), 'success');
      } else {
        await createMutation.mutateAsync(formData);
        addToast(t('protocols.toasts.created'), 'success');
      }
      setIsFormOpen(false);
    } catch (err: any) {
      addToast(err.message || 'Error al guardar', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProtocol) return;
    try {
      await deleteMutation.mutateAsync(selectedProtocol.id);
      addToast(t('protocols.toasts.deleted'), 'success');
      setIsDeleteOpen(false);
    } catch (err: any) {
      addToast(err.message || 'Error al eliminar', 'error');
    }
  };

  const handleToggleActive = async (protocol: OperationalProtocol) => {
    try {
      await updateMutation.mutateAsync({ id: protocol.id, data: { is_active: !protocol.is_active } });
      addToast(t('protocols.toasts.statusChanged'), 'success');
    } catch (err: any) {
      addToast(err.message || 'Error al actualizar estado', 'error');
    }
  };

  /** Situaciones presentes en los datos. Sale de las filas, no de una lista fija. */
  const situacionesDisponibles = React.useMemo(
    () => Array.from(new Set(protocols.map((p) => p.trip_status).filter(Boolean))).sort(),
    [protocols],
  );

  /*
    El color del nivel de riesgo sale del catálogo (`motor_niveles_riesgo.color`),
    no de un if por nombre. Cuando el cliente agregue un nivel propio, va a
    tener su color sin que haya que tocar esta pantalla.
  */
  const renderBadge = (enumValue: string, enumGroup: string) => {
    if (enumGroup === 'risk_level') {
      const nivel = (catalogos?.niveles_riesgo ?? []).find((n) => n.codigo === enumValue);
      const color = nivel?.color ?? '#6B7280';
      return (
        <span
          className="px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap"
          style={{ background: `${color}22`, color, borderColor: `${color}55` }}
          title={nivel?.descripcion ?? undefined}
        >
          {nivel?.nombre ?? enumValue}
        </span>
      );
    }

    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border bg-gray-500/20 text-gray-300 border-gray-500/30 whitespace-nowrap">
        {enumValue}
      </span>
    );
  };

  return (
    <RequirePermission permission="manage_settings">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#1A2346] p-6 rounded-xl border border-[#2D3B6A] shadow-lg">
          <div>
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-cyan-400" />
              <h1 className="text-2xl font-bold text-white tracking-wide">{t('protocols.title')}</h1>
            </div>
            <p className="text-gray-400 mt-1">{t('protocols.subtitle')}</p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-[#0B1120] font-bold rounded-lg transition-colors shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-5 h-5" />
            {t('protocols.createButton')}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 bg-[#1A2346] p-4 rounded-xl border border-[#2D3B6A]">
          <div className="flex items-center gap-2 text-gray-400 px-2">
            <Filter className="w-4 h-4" />
          </div>
          <select 
            className="bg-[#151B36] border border-[#2D3B6A] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            value={filters.trip_status || ''}
            onChange={e => setFilters(prev => ({ ...prev, trip_status: e.target.value || undefined }))}
          >
            <option value="">{t('protocols.filters.tripStatus')}: {t('protocols.filters.all')}</option>
            {situacionesDisponibles.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select 
            className="bg-[#151B36] border border-[#2D3B6A] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            value={filters.risk_level || ''}
            onChange={e => setFilters(prev => ({ ...prev, risk_level: e.target.value || undefined }))}
          >
            <option value="">{t('protocols.filters.riskLevel')}: {t('protocols.filters.all')}</option>
            {(catalogos?.niveles_riesgo ?? []).map((n) => (
              <option key={n.codigo} value={n.codigo}>{n.nombre}</option>
            ))}
          </select>

          <select 
            className="bg-[#151B36] border border-[#2D3B6A] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            value={filters.is_active === undefined ? '' : String(filters.is_active)}
            onChange={e => {
              const val = e.target.value;
              setFilters(prev => ({ ...prev, is_active: val === '' ? undefined : val === 'true' }));
            }}
          >
            <option value="">{t('protocols.table.status')}: {t('protocols.filters.all')}</option>
            <option value="true">{t('protocols.filters.active')}</option>
            <option value="false">{t('protocols.filters.inactive')}</option>
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
                  <th className="px-6 py-4">{t('protocols.table.name')}</th>
                  <th className="px-6 py-4">{t('protocols.table.tripStatus')}</th>
                  <th className="px-6 py-4">{t('protocols.table.signals')}</th>
                  <th className="px-6 py-4">{t('protocols.table.riskSla')}</th>
                  <th className="px-6 py-4 text-center">{t('protocols.table.status')}</th>
                  <th className="px-6 py-4 text-right">{t('protocols.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D3B6A]">
                {isLoading ? (
                  // Skeleton
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-[#2D3B6A] rounded w-3/4"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-[#2D3B6A] rounded w-1/2"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-[#2D3B6A] rounded w-2/3"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-[#2D3B6A] rounded w-1/2"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-[#2D3B6A] rounded w-8 mx-auto"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-[#2D3B6A] rounded w-16 ml-auto"></div></td>
                    </tr>
                  ))
                ) : protocols.length === 0 ? (
                  // Empty state
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>No se encontraron protocolos.</p>
                    </td>
                  </tr>
                ) : (
                  protocols.map((protocol: OperationalProtocol) => (
                    <tr key={protocol.id} className="hover:bg-[#2D3B6A]/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{protocol.name}</div>
                        {protocol.description && (
                          <div className="text-xs text-gray-500 mt-1 truncate max-w-[200px]">{protocol.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 space-y-1">
                        <div>{renderBadge(protocol.trip_status, 'trip_status')}</div>
                        <div>{renderBadge(protocol.sub_status, 'sub_status')}</div>
                      </td>
                      <td className="px-6 py-4 space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500">GPS:</span>
                          {renderBadge(protocol.gps_reporting, 'gps_reporting')}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500">Comms:</span>
                          {renderBadge(protocol.driver_communication, 'driver_communication')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="mb-1">{renderBadge(protocol.risk_level, 'risk_level')}</div>
                        <div className="text-xs font-mono text-cyan-400">
                          {protocol.sla_minutes ? `${protocol.sla_minutes} min SLA` : 'Sin SLA'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={protocol.is_active}
                            onChange={() => handleToggleActive(protocol)}
                          />
                          <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                        </label>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenEdit(protocol)}
                            className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-cyan-400/10 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(protocol)}
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
        initialData={selectedProtocol}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />

      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        protocol={selectedProtocol}
        isDeleting={deleteMutation.isPending}
      />
    </RequirePermission>
  );
};
