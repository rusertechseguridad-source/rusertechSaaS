import React, { useEffect, useState } from 'react';
import { useVehiclesStore } from '../../store/vehiclesStore';
import { Truck, Plus, Search, ShieldAlert, ShieldCheck, Edit, Trash2 } from 'lucide-react';

export const VehiclesPage: React.FC = () => {
  const { vehicles, fetchVehicles, toggleBlock, deleteVehicle, loading } = useVehiclesStore();
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchVehicles();
  }, []);

  const filtered = vehicles.filter(v => 
    v.plate.toLowerCase().includes(search.toLowerCase()) || 
    (v.alias && v.alias.toLowerCase().includes(search.toLowerCase()))
  );

  const handleToggleBlock = (id: string, currentlyBlocked: boolean) => {
    if (currentlyBlocked) {
      toggleBlock(id, false);
    } else {
      const reason = prompt('Motivo del bloqueo de telemetría:');
      if (reason !== null) {
        toggleBlock(id, true, reason);
      }
    }
  };

  return (
    <div className="p-8 h-full max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-display font-bold text-white flex items-center">
          <Truck className="w-8 h-8 mr-3 text-brand" />
          Gestión de Flota
        </h1>
        <button className="bg-brand hover:bg-brand/90 text-black px-4 py-2 rounded font-bold flex items-center shadow-lg shadow-brand/20">
          <Plus className="w-5 h-5 mr-2" /> Nuevo Vehículo
        </button>
      </div>

      <div className="bg-surface border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-black/20">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Buscar por patente o alias..." 
              className="w-full bg-black border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:border-brand focus:outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-gray-400 text-sm">{filtered.length} vehículos encontrados</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Cargando flota...</div>
        ) : (
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-black/40 border-b border-gray-800 text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-4 font-medium">Vehículo</th>
                <th className="px-6 py-4 font-medium">Proveedor (HUB)</th>
                <th className="px-6 py-4 font-medium">Estado</th>
                <th className="px-6 py-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map(v => (
                <tr key={v.id} className="hover:bg-gray-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-white text-base">{v.plate}</div>
                    <div className="text-gray-500">{v.alias || 'Sin alias'} • {v.brand} {v.model}</div>
                  </td>
                  <td className="px-6 py-4">
                    {v.avl_user ? (
                      <div>
                        <span className="text-white">{v.avl_user.name}</span>
                        <div className="text-xs text-gray-500 font-mono mt-1">Asset: {v.hub_asset_id}</div>
                      </div>
                    ) : (
                      <span className="text-gray-600 italic">Sin proveedor</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {v.is_blocked ? (
                      <div className="inline-flex items-center text-red-400 bg-red-400/10 px-3 py-1 rounded-full text-xs font-bold border border-red-400/20">
                        <ShieldAlert className="w-3 h-3 mr-1" /> BLOQUEADO
                      </div>
                    ) : (
                      <div className="inline-flex items-center text-green-400 bg-green-400/10 px-3 py-1 rounded-full text-xs font-bold border border-green-400/20">
                        <ShieldCheck className="w-3 h-3 mr-1" /> ACTIVO
                      </div>
                    )}
                    {v.is_blocked && v.block_reason && (
                      <div className="text-xs text-red-500/70 mt-1 max-w-xs truncate" title={v.block_reason}>
                        {v.block_reason}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleToggleBlock(v.id, v.is_blocked)}
                        className={`p-2 rounded hover:text-white transition-colors ${v.is_blocked ? 'text-green-500 hover:bg-green-500/20' : 'text-red-500 hover:bg-red-500/20'}`}
                        title={v.is_blocked ? 'Desbloquear ingesta' : 'Bloquear ingesta'}
                      >
                        {v.is_blocked ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                      </button>
                      <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => { if(confirm('¿Eliminar vehículo?')) deleteVehicle(v.id); }}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    No se encontraron vehículos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
