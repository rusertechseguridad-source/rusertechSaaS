import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, Download } from 'lucide-react';
import { useAvlStore } from '../../store/avlStore';
import { AvlUserForm } from './AvlUserForm';
import { RequirePermission } from '../../components/RequirePermission';
import { exportToCsv } from '../../utils/export';
import { useTranslation } from 'react-i18next';

export const AvlUserListPage: React.FC = () => {
  const { t } = useTranslation();
  const { users, loading, error, fetchUsers, toggleActive } = useAvlStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenNew = () => {
    setSelectedUserId(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (id: string) => {
    setSelectedUserId(id);
    setIsModalOpen(true);
  };

  const handleExport = () => {
    const headers = ['Nombre', 'Descripción', t('avl.hub_code').replace(':', ''), t('avl.vehicles').replace(':', ''), t('avl.last_data').replace(':', ''), 'Estado'];
    const rows = users.map(user => [
      user.name,
      user.description || '',
      user.user_avl_code,
      user._count?.vehicles || 0,
      user.last_data_at ? new Date(user.last_data_at).toLocaleString() : t('avl.never'),
      user.is_active ? t('avl.active') : t('avl.inactive')
    ]);
    exportToCsv('ProveedoresGPS', headers, rows);
  };

  if (loading) return <div className="p-8 text-center text-textMuted">{t('avl.loading')}</div>;
  if (error) return <div className="p-8 text-center text-statusDanger">{error}</div>;

  return (
    <div className="p-8 w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 
            className="text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-accentGreen to-accentBlue tracking-wider flex items-center"
            style={{ textShadow: '0 0 10px rgba(42,179,255,0.3)', animation: 'pulse 3s infinite' }}
          >
            <Radio className="w-8 h-8 mr-3 text-accentGreen" />
            {t('avl.title')}
          </h1>
          <p className="text-textMuted mt-2">{t('avl.subtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-bgSurface/80 hover:bg-bgSurfaceHigh text-white px-4 py-2 text-sm rounded-lg border border-borderDefault transition-colors"
          >
            <Download size={16} className="text-accentBlue" />
            {t('avl.export_csv')}
          </button>
          <RequirePermission permission="avl:edit">
            <button 
              onClick={handleOpenNew}
              className="px-6 py-2 bg-accentGreen text-bgStart font-medium rounded-lg shadow-sm hover:bg-accentGreen/90 transition"
            >
              {t('avl.new_provider')}
            </button>
          </RequirePermission>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="bg-bgSurface rounded-xl shadow-sm border border-borderDefault p-12 text-center">
          <p className="text-textMuted">{t('avl.no_providers')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map(user => (
            <div key={user.id} className="bg-bgSurface rounded-xl shadow-card border border-borderDefault overflow-hidden flex flex-col">
              <div className="p-6 flex-grow">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold text-white">{user.name}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${user.is_active ? 'bg-statusSuccess/10 text-statusSuccess border border-statusSuccess/20' : 'bg-statusDanger/10 text-statusDanger border border-statusDanger/20'}`}>
                    {user.is_active ? t('avl.active') : t('avl.inactive')}
                  </span>
                </div>
                <p className="text-sm text-textMuted mb-4">{user.description || t('avl.no_description')}</p>
                <div className="space-y-2 text-sm text-textSecondary">
                  <div className="flex justify-between">
                    <span>{t('avl.hub_code')}</span>
                    <span className="font-mono bg-bgStart px-2 py-0.5 rounded text-white">{user.user_avl_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('avl.vehicles')}</span>
                    <span className="font-medium text-white">{user._count?.vehicles || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('avl.last_data')}</span>
                    <span className="text-white">{user.last_data_at ? new Date(user.last_data_at).toLocaleString() : t('avl.never')}</span>
                  </div>
                </div>
              </div>
              <div className="bg-bgSurfaceHigh p-4 border-t border-borderDefault flex justify-between items-center">
                <RequirePermission permission="avl:edit">
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => toggleActive(user.id, !user.is_active)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${user.is_active ? 'bg-accentGreen' : 'bg-borderDefault'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${user.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                    <span className="text-xs font-medium text-textMuted">{t('avl.ingestion')}</span>
                  </div>
                </RequirePermission>
                <div className="flex space-x-3">
                  <RequirePermission permission="avl:edit">
                    <button 
                      onClick={() => handleOpenEdit(user.id)}
                      className="text-sm text-accentGreen hover:text-accentGreen/80 font-medium transition-colors"
                    >
                      {t('avl.edit')}
                    </button>
                  </RequirePermission>
                  <Link 
                    to={`/avl/${user.id}/dictionary`}
                    className="text-sm text-textSecondary hover:text-white font-medium transition-colors"
                  >
                    {t('avl.dictionary')}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <AvlUserForm 
          userId={selectedUserId} 
          onClose={() => setIsModalOpen(false)} 
        />
      )}
    </div>
  );
};
