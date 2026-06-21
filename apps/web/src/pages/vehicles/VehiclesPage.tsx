import React, { useEffect, useState } from 'react';
import { useVehiclesStore } from '../../store/vehiclesStore';
import { Truck, Plus, Search, ShieldAlert, ShieldCheck, Edit, Trash2, Download } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';
import { exportToCsv } from '../../utils/export';
import { useTranslation } from 'react-i18next';

export const VehiclesPage: React.FC = () => {
  const { t } = useTranslation();
  const { vehicles, fetchVehicles, toggleBlock, deleteVehicle, createVehicle, updateVehicle, loading } = useVehiclesStore();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // AVL Users (providers) list
  const [avlUsers, setAvlUsers] = useState<any[]>([]);
  // Carriers list
  const [carriers, setCarriers] = useState<any[]>([]);

  // Form state
  const [plate, setPlate] = useState('');
  const [alias, setAlias] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [vehicleType, setVehicleType] = useState('truck');
  const [fuelType, setFuelType] = useState('diesel');
  const [fuelEfficiency, setFuelEfficiency] = useState('');
  const [avlUserId, setAvlUserId] = useState('');
  const [hubAssetId, setHubAssetId] = useState('');
  const [dictionaryCategory, setDictionaryCategory] = useState('');
  const [carrierId, setCarrierId] = useState('');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [imageFrontUrl, setImageFrontUrl] = useState('');
  const [imageRearUrl, setImageRearUrl] = useState('');
  const [imageSideUrl, setImageSideUrl] = useState('');

  useEffect(() => {
    fetchVehicles();
    fetchAvlUsers();
    fetchCarriers();
  }, []);

  const fetchAvlUsers = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/avl-users', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAvlUsers(Array.isArray(data) ? data : (data.data || []));
      }
    } catch (e) {
      console.error('Error fetching AVL users', e);
    }
  };

  const fetchCarriers = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/carriers', {
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` },
      });
      if (res.ok) setCarriers(await res.json());
    } catch (e) {
      console.error('Error fetching Carriers', e);
    }
  };

  const fetchDictionaryCategories = async (userId: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/v1/avl-users/${userId}/dictionary`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        const categories = Array.from(new Set(data.map((d: any) => d.category)));
        setAvailableCategories(categories as string[]);
      } else {
        setAvailableCategories([]);
      }
    } catch (e) {
      console.error('Error fetching dictionary categories', e);
      setAvailableCategories([]);
    }
  };

  useEffect(() => {
    if (avlUserId) {
      fetchDictionaryCategories(avlUserId);
    } else {
      setAvailableCategories([]);
      setDictionaryCategory('');
    }
  }, [avlUserId]);

  const filtered = vehicles.filter(v =>
    v.plate.toLowerCase().includes(search.toLowerCase()) ||
    (v.alias && v.alias.toLowerCase().includes(search.toLowerCase()))
  );

  const handleToggleBlock = async (id: string, currentlyBlocked: boolean) => {
    try {
      if (currentlyBlocked) {
        await toggleBlock(id, false);
      } else {
        const reason = prompt('Motivo del bloqueo de telemetría:');
        if (reason !== null) {
          await toggleBlock(id, true, reason);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExport = () => {
    const headers = ['Patente', 'Alias', 'Marca', 'Modelo', 'Tipo', 'Estado'];
    const rows = filtered.map(v => [
      v.plate,
      v.alias || '',
      v.brand || '',
      v.model || '',
      t(`vehicles.types.${v.vehicle_type}`),
      v.status === 'active' ? t('vehicles.status.active') : t('vehicles.status.blocked')
    ]);
    exportToCsv(t('vehicles.title'), headers, rows);
  };

  const handleExportDetail = () => {
    if (!editingId) return;
    const headers = ['Patente', 'Alias', 'Marca', 'Modelo', 'Tipo', 'Categoría Diccionario', 'ID Activo Hub', 'ID Usuario AVL'];
    const row = [plate, alias, brand, model, vehicleType, dictionaryCategory, hubAssetId, avlUserId];
    exportToCsv(`Vehiculo_${plate}`, headers, [row]);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setPlate('');
    setAlias('');
    setBrand('');
    setModel('');
    setVehicleType('truck');
    setFuelType('diesel');
    setFuelEfficiency('');
    setAvlUserId('');
    setHubAssetId('');
    setDictionaryCategory('');
    setCarrierId('');
    setAvailableCategories([]);
    setShowModal(true);
  };

  const openEditModal = (vehicle: any) => {
    setEditingId(vehicle.id);
    setPlate(vehicle.plate);
    setAlias(vehicle.alias || '');
    setBrand(vehicle.brand || '');
    setModel(vehicle.model || '');
    setVehicleType(vehicle.vehicle_type || 'truck');
    setFuelType(vehicle.fuel_type || 'diesel');
    setFuelEfficiency(vehicle.fuel_efficiency_lper100km?.toString() || '');
    setAvlUserId(vehicle.avl_user_id || '');
    setHubAssetId(vehicle.hub_asset_id || '');
    setDictionaryCategory(vehicle.dictionary_category || '');
    setCarrierId(vehicle.carrier_id || '');
    setImageFrontUrl(vehicle.image_front_url || '');
    setImageRearUrl(vehicle.image_rear_url || '');
    setImageSideUrl(vehicle.image_side_url || '');
    setShowModal(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('http://localhost:3000/api/v1/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setter(data.url);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = {
      plate,
      alias: alias || null,
      brand: brand || null,
      model: model || null,
      vehicle_type: vehicleType,
      fuel_type: fuelType,
      fuel_efficiency_lper100km: fuelEfficiency ? parseFloat(fuelEfficiency) : null,
      avl_user_id: avlUserId || null,
      hub_asset_id: hubAssetId || null,
      dictionary_category: dictionaryCategory || null,
      carrier_id: carrierId || null,
      image_front_url: imageFrontUrl || null,
      image_rear_url: imageRearUrl || null,
      image_side_url: imageSideUrl || null,
    };

    if (editingId) {
      await updateVehicle(editingId, data);
    } else {
      await createVehicle(data);
    }
    setShowModal(false);
  };

  const totalVehicles = vehicles.length;
  const blockedVehicles = vehicles.filter(v => v.is_blocked).length;
  const activeVehicles = totalVehicles - blockedVehicles;

  return (
    <div className="p-8 h-full w-full flex flex-col">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <h1 
          className="text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-accentGreen to-accentBlue tracking-wider flex items-center"
          style={{ textShadow: '0 0 10px rgba(42,179,255,0.3)', animation: 'pulse 3s infinite' }}
        >
          <Truck className="w-8 h-8 mr-3 text-accentGreen" />
          {t('vehicles.title')}
        </h1>
        <RequirePermission permission="vehicles:manage">
          <button onClick={openCreateModal} className="bg-accentGreen hover:bg-accentGreen/90 text-bgStart px-4 py-2 rounded font-bold flex items-center shadow-lg shadow-accentGreen/20">
            <Plus className="w-5 h-5 mr-2" /> {t('vehicles.new_vehicle')}
          </button>
        </RequirePermission>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 shrink-0">
        <div className="bg-bgSurface border border-borderDefault rounded-xl p-4 shadow-card flex items-center justify-between">
          <div>
            <div className="text-textMuted text-xs font-bold uppercase tracking-wider mb-1">{t('vehicles.total_fleet')}</div>
            <div className="text-3xl font-display font-black text-white">{totalVehicles}</div>
          </div>
          <div className="w-12 h-12 rounded-full bg-accentBlue/10 flex items-center justify-center border border-accentBlue/20">
            <Truck className="w-6 h-6 text-accentBlue" />
          </div>
        </div>
        <div className="bg-bgSurface border border-borderDefault rounded-xl p-4 shadow-card flex items-center justify-between">
          <div>
            <div className="text-textMuted text-xs font-bold uppercase tracking-wider mb-1">{t('vehicles.active_vehicles')}</div>
            <div className="text-3xl font-display font-black text-white">{activeVehicles}</div>
          </div>
          <div className="w-12 h-12 rounded-full bg-statusOnline/10 flex items-center justify-center border border-statusOnline/20">
            <ShieldCheck className="w-6 h-6 text-statusOnline" />
          </div>
        </div>
        <div className="bg-bgSurface border border-borderDefault rounded-xl p-4 shadow-card flex items-center justify-between">
          <div>
            <div className="text-textMuted text-xs font-bold uppercase tracking-wider mb-1">{t('vehicles.blocked_vehicles')}</div>
            <div className="text-3xl font-display font-black text-white">{blockedVehicles}</div>
          </div>
          <div className="w-12 h-12 rounded-full bg-statusDanger/10 flex items-center justify-center border border-statusDanger/20">
            <ShieldAlert className="w-6 h-6 text-statusDanger" />
          </div>
        </div>
      </div>

      <div className="bg-bgSurface border border-borderDefault rounded-xl overflow-hidden shadow-card flex flex-col min-h-0 flex-1">
        <div className="p-4 border-b border-borderDefault flex justify-between items-center bg-bgStart/50 shrink-0">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted w-5 h-5" />
            <input
              type="text"
              placeholder={t('vehicles.search_placeholder')}
              className="w-full bg-bgStart border border-borderDefault rounded-lg pl-10 pr-4 py-2 text-textPrimary focus:border-accentGreen focus:outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-textSecondary text-sm">{filtered.length} {t('vehicles.vehicles_found')}</span>
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 bg-bgSurface/80 hover:bg-bgSurfaceHigh text-white px-4 py-1.5 text-sm rounded-lg border border-borderDefault transition-colors"
            >
              <Download size={16} className="text-accentBlue" />
              {t('vehicles.export_csv')}
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-12 text-center text-textMuted">{t('vehicles.loading')}</div>
          ) : (
            <table className="w-full text-left text-sm text-textSecondary">
              <thead className="bg-bgStart/95 backdrop-blur-md border-b border-borderDefault text-white text-[10px] uppercase tracking-wider font-black sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4">{t('vehicles.table.vehicle')}</th>
                  <th className="px-6 py-4">{t('vehicles.table.carrier')}</th>
                  <th className="px-6 py-4">{t('vehicles.table.provider')}</th>
                  <th className="px-6 py-4">{t('vehicles.table.status')}</th>
                  <th className="px-6 py-4 text-right">
                    <RequirePermission permission="vehicles:manage">{t('vehicles.table.actions')}</RequirePermission>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderDefault">
                {filtered.map(v => (
                  <tr key={v.id} className="hover:bg-bgSurfaceHigh/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white text-base">{v.plate}</div>
                      <div className="text-textMuted">{v.alias || t('vehicles.status.no_alias')} • {v.brand || ''} {v.model || ''}</div>
                    </td>
                    <td className="px-6 py-4">
                      {(v as any).carrier ? (
                        <span className="text-accentGreen bg-accentGreen/10 px-2 py-1 rounded font-medium text-sm">{(v as any).carrier.name}</span>
                      ) : (
                        <span className="text-textMuted italic">{t('vehicles.status.independent')}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {v.avl_user ? (
                        <div>
                          <span className="text-white">{v.avl_user.name}</span>
                          <div className="text-xs text-textMuted font-mono mt-1">Asset: {v.hub_asset_id || '—'}</div>
                          {v.dictionary_category && (
                            <div className="text-xs text-accentBlue font-mono mt-0.5">Dict: {v.dictionary_category}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-textMuted italic">{t('vehicles.status.no_provider')}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {v.is_blocked ? (
                        <div className="inline-flex items-center text-statusDanger bg-statusDanger/10 px-3 py-1 rounded-full text-xs font-bold border border-statusDanger/20">
                          <ShieldAlert className="w-3 h-3 mr-1" /> {t('vehicles.status.blocked')}
                        </div>
                      ) : (
                        <div className="inline-flex items-center text-statusOnline bg-statusOnline/10 px-3 py-1 rounded-full text-xs font-bold border border-statusOnline/20">
                          <ShieldCheck className="w-3 h-3 mr-1" /> {t('vehicles.status.active')}
                        </div>
                      )}
                      {v.is_blocked && v.block_reason && (
                        <div className="text-xs text-statusDanger/70 mt-1 max-w-xs truncate" title={v.block_reason}>
                          {v.block_reason}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <RequirePermission permission="vehicles:manage">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleToggleBlock(v.id, v.is_blocked)}
                            className={`p-2 rounded transition-colors ${v.is_blocked ? 'text-statusOnline hover:bg-statusOnline/20 hover:text-white' : 'text-statusDanger hover:bg-statusDanger/20 hover:text-white'}`}
                            title={v.is_blocked ? 'Desbloquear ingesta' : 'Bloquear ingesta'}
                          >
                            {v.is_blocked ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => openEditModal(v)}
                            className="p-2 text-textSecondary hover:text-white hover:bg-bgSurfaceHigh rounded transition-colors"
                            title="Editar vehículo"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { if(confirm('¿Eliminar vehículo?')) deleteVehicle(v.id); }}
                            className="p-2 text-textSecondary hover:text-statusDanger hover:bg-bgSurfaceHigh rounded transition-colors"
                            title="Eliminar vehículo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </RequirePermission>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-textMuted">
                      {t('vehicles.no_vehicles')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-bgOverlay z-50 flex items-center justify-center p-4">
          <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-lg shadow-card flex flex-col" style={{ maxHeight: '85vh' }}>
            <div className="p-6 border-b border-borderDefault shrink-0 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">{editingId ? t('vehicles.modal.edit_title') : t('vehicles.modal.new_title')}</h2>
              {editingId && (
                <button 
                  type="button"
                  onClick={handleExportDetail}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-bgSurfaceHigh hover:bg-bgSurface text-textPrimary text-xs font-medium rounded-md border border-borderDefault transition-colors"
                >
                  <Download size={14} className="text-accentBlue" />
                  Exportar
                </button>
              )}
            </div>
            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                <div>
                  <label className="block text-sm text-textSecondary mb-1">{t('vehicles.modal.plate')}</label>
                  <input required type="text" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white uppercase focus:border-accentGreen focus:outline-none" value={plate} onChange={e => setPlate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm text-textSecondary mb-1">{t('vehicles.modal.alias')}</label>
                  <input type="text" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={alias} onChange={e => setAlias(e.target.value)} />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm text-textSecondary mb-1">{t('vehicles.modal.brand')}</label>
                    <input type="text" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={brand} onChange={e => setBrand(e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm text-textSecondary mb-1">{t('vehicles.modal.model')}</label>
                    <input type="text" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={model} onChange={e => setModel(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-textSecondary mb-1">{t('vehicles.modal.type')}</label>
                  <select className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={vehicleType} onChange={e => setVehicleType(e.target.value)}>
                    <option value="truck">{t('vehicles.types.truck')}</option>
                    <option value="semi">{t('vehicles.types.semi')}</option>
                    <option value="van">{t('vehicles.types.van')}</option>
                    <option value="car">{t('vehicles.types.car')}</option>
                    <option value="pickup">{t('vehicles.types.pickup')}</option>
                    <option value="bus">{t('vehicles.types.bus')}</option>
                    <option value="motorcycle">{t('vehicles.types.motorcycle')}</option>
                  </select>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm text-textSecondary mb-1" title={t('vehicles.modal.fuel_title')}>{t('vehicles.modal.fuel')}</label>
                    <select className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={fuelType} onChange={e => setFuelType(e.target.value)}>
                      <option value="diesel">{t('vehicles.fuels.diesel')}</option>
                      <option value="gasoline">{t('vehicles.fuels.gasoline')}</option>
                      <option value="hybrid">{t('vehicles.fuels.hybrid')}</option>
                      <option value="electric">{t('vehicles.fuels.electric')}</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm text-textSecondary mb-1" title={t('vehicles.modal.efficiency_title')}>{t('vehicles.modal.efficiency')}</label>
                    <input type="number" step="0.1" placeholder={t('vehicles.modal.efficiency_placeholder')} className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={fuelEfficiency} onChange={e => setFuelEfficiency(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-textSecondary mb-1">{t('vehicles.modal.carrier')}</label>
                  <select className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={carrierId} onChange={e => setCarrierId(e.target.value)}>
                    <option value="">{t('vehicles.modal.none_independent')}</option>
                    {carriers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>


                <div className="border-t border-borderDefault pt-4 mt-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">{t('vehicles.modal.images')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-textSecondary mb-1">{t('vehicles.modal.front')}</label>
                      <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setImageFrontUrl)} className="w-full text-xs bg-bgStart border border-borderDefault rounded p-1 text-white focus:outline-none file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-accentGreen/20 file:text-accentGreen file:font-medium" />
                      {imageFrontUrl && <div className="mt-2 h-20 w-full rounded border border-borderDefault overflow-hidden"><img src={imageFrontUrl} alt="Frente" className="w-full h-full object-cover" /></div>}
                    </div>
                    <div>
                      <label className="block text-xs text-textSecondary mb-1">{t('vehicles.modal.rear')}</label>
                      <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setImageRearUrl)} className="w-full text-xs bg-bgStart border border-borderDefault rounded p-1 text-white focus:outline-none file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-accentGreen/20 file:text-accentGreen file:font-medium" />
                      {imageRearUrl && <div className="mt-2 h-20 w-full rounded border border-borderDefault overflow-hidden"><img src={imageRearUrl} alt="Trasero" className="w-full h-full object-cover" /></div>}
                    </div>
                    <div>
                      <label className="block text-xs text-textSecondary mb-1">{t('vehicles.modal.side')}</label>
                      <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, setImageSideUrl)} className="w-full text-xs bg-bgStart border border-borderDefault rounded p-1 text-white focus:outline-none file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-accentGreen/20 file:text-accentGreen file:font-medium" />
                      {imageSideUrl && <div className="mt-2 h-20 w-full rounded border border-borderDefault overflow-hidden"><img src={imageSideUrl} alt="Lateral" className="w-full h-full object-cover" /></div>}
                    </div>
                  </div>
                </div>

                <div className="border-t border-borderDefault pt-4 mt-4">
                  <h3 className="text-sm font-bold text-accentGreen uppercase tracking-wider mb-3">{t('vehicles.modal.provider')}</h3>
                  <div>
                    <label className="block text-sm text-textSecondary mb-1">{t('vehicles.modal.avl_provider')}</label>
                    <select className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" value={avlUserId} onChange={e => setAvlUserId(e.target.value)}>
                      <option value="">{t('vehicles.modal.none')}</option>
                      {avlUsers.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.user_avl_code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm text-textSecondary mb-1">{t('vehicles.modal.asset_id')}</label>
                    <input type="text" className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white font-mono focus:border-accentGreen focus:outline-none" placeholder={t('vehicles.modal.asset_placeholder')} value={hubAssetId} onChange={e => setHubAssetId(e.target.value)} />
                  </div>
                  {avlUserId && (
                    <div className="mt-3 border border-borderDefault/50 p-3 rounded bg-bgStart/30">
                      <label className="block text-sm text-textSecondary mb-1">{t('vehicles.modal.dictionary')}</label>
                      <select 
                        className="w-full bg-bgStart border border-borderDefault rounded p-2 text-white focus:border-accentGreen focus:outline-none" 
                        value={dictionaryCategory} 
                        onChange={e => setDictionaryCategory(e.target.value)}
                      >
                        <option value="">{t('vehicles.modal.default_dict')}</option>
                        {availableCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <p className="text-xs text-textMuted mt-1">
                        {t('vehicles.modal.dict_desc')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6 border-t border-borderDefault flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded text-textSecondary hover:text-white transition-colors">{t('vehicles.modal.cancel')}</button>
                <button type="submit" className="px-6 py-2 bg-accentGreen text-bgStart font-bold rounded hover:bg-accentGreen/90 transition-colors">{t('vehicles.modal.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
