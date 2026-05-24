import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAvlStore } from '../../store/avlStore';
import { AvlUserForm } from './AvlUserForm';

export const AvlUserListPage: React.FC = () => {
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

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando Proveedores GPS...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Proveedores GPS (AVL Users)</h1>
          <p className="text-gray-500 mt-2">Gestiona las conexiones con empresas de rastreo GPS externas.</p>
        </div>
        <button 
          onClick={handleOpenNew}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 transition"
        >
          + Nuevo Proveedor
        </button>
      </div>

      {users.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-500">No hay proveedores GPS configurados todavía.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map(user => (
            <div key={user.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              <div className="p-6 flex-grow">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">{user.name}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {user.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-4">{user.description || 'Sin descripción'}</p>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Código HUB:</span>
                    <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{user.user_avl_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vehículos:</span>
                    <span className="font-medium">{user._count?.vehicles || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Último dato:</span>
                    <span>{user.last_data_at ? new Date(user.last_data_at).toLocaleString() : 'Nunca'}</span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => toggleActive(user.id, !user.is_active)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${user.is_active ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${user.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-xs font-medium text-gray-500">Ingesta</span>
                </div>
                <div className="flex space-x-3">
                  <button 
                    onClick={() => handleOpenEdit(user.id)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Configurar
                  </button>
                  <Link 
                    to={`/avl/${user.id}/dictionary`}
                    className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                  >
                    Diccionario
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
