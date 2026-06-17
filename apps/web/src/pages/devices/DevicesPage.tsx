import React, { useEffect, useState } from 'react';
import { Smartphone, Signal, Battery, Plus, Search, AlertTriangle, Edit2, Trash2, X, BatteryMedium, BatteryCharging, BatteryWarning, Download } from 'lucide-react';
import { useDevicesStore, type Device } from '../../store/devicesStore';
import { RequirePermission } from '../../components/RequirePermission';
import { exportToCsv } from '../../utils/export';

export const DevicesPage: React.FC = () => {
  const { devices, loading, fetchDevices, createDevice, updateDevice, deleteDevice } = useDevicesStore();
  const [search, setSearch] = useState('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [imei, setImei] = useState('');
  const [deviceType, setDeviceType] = useState('PORTABLE_GPS');
  const [status, setStatus] = useState('ACTIVE');
  const [avlUserId, setAvlUserId] = useState('');

  // Dependencies
  const [avlUsers, setAvlUsers] = useState<any[]>([]);

  useEffect(() => {
    fetchDevices();
    fetch('http://localhost:3000/api/v1/avl-users', {
      headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` }
    })
      .then(res => res.json())
      .then(data => setAvlUsers(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [fetchDevices]);

  const resetForm = () => {
    setName('');
    setImei('');
    setDeviceType('PORTABLE_GPS');
    setStatus('ACTIVE');
    setAvlUserId('');
    setEditingId(null);
  };

  const handleNewDevice = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEditDevice = (device: Device) => {
    resetForm();
    setEditingId(device.id);
    setName(device.name);
    setImei(device.imei || '');
    setDeviceType(device.device_type);
    setStatus(device.status);
    setAvlUserId(device.avl_user_id || '');
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Está seguro de eliminar este dispositivo?')) {
      await deleteDevice(id);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name,
      imei: imei || null,
      device_code: imei || null,
      device_type: deviceType,
      status,
      avl_user_id: avlUserId || null,
    };
    
    if (editingId) {
      await updateDevice(editingId, data);
    } else {
      await createDevice(data);
    }
    setShowModal(false);
  };

  const handleExportDetail = () => {
    if (!editingId) return;
    const headers = ['Nombre', 'IMEI', 'Tipo', 'Estado', 'ID AVL'];
    const row = [name, imei, deviceType, status, avlUserId];
    exportToCsv(`Dispositivo_${imei || name}`, headers, [row]);
  };

  const handleExport = () => {
    const headers = ['Nombre', 'IMEI', 'Tipo', 'Estado', 'Batería'];
    const rows = filtered.map(d => [
      d.name,
      d.imei || '',
      d.device_type,
      d.status,
      d.battery_level !== null ? `${d.battery_level}%` : 'N/A'
    ]);
    exportToCsv('Dispositivos', headers, rows);
  };

  const filtered = devices.filter(d => 
    !search || 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    (d.imei && d.imei.toLowerCase().includes(search.toLowerCase()))
  );

  const getBatteryIcon = (level: number | null) => {
    if (level === null) return <Battery className="w-4 h-4 text-textMuted" />;
    if (level > 60) return <BatteryCharging className="w-4 h-4 text-accentGreen" />;
    if (level > 20) return <BatteryMedium className="w-4 h-4 text-yellow-400" />;
    return <BatteryWarning className="w-4 h-4 text-statusDanger" />;
  };

  const statCards = [
    {
      label: 'Total Dispositivos',
      value: devices.length,
      icon: Smartphone,
      gradient: 'from-accentBlue/20 to-accentBlue/5',
      iconColor: 'text-accentBlue',
      border: 'border-accentBlue/20',
    },
    {
      label: 'Activos',
      value: devices.filter(d => d.status === 'ACTIVE').length,
      icon: Signal,
      gradient: 'from-accentGreen/20 to-accentGreen/5',
      iconColor: 'text-accentGreen',
      border: 'border-accentGreen/20',
    },
    {
      label: 'En Mantenimiento',
      value: devices.filter(d => d.status === 'MAINTENANCE').length,
      icon: AlertTriangle,
      gradient: 'from-yellow-500/20 to-yellow-500/5',
      iconColor: 'text-yellow-400',
      border: 'border-yellow-500/20',
    },
    {
      label: 'Batería Baja',
      value: devices.filter(d => d.battery_level !== null && d.battery_level <= 20).length,
      icon: BatteryWarning,
      gradient: 'from-red-500/20 to-red-500/5',
      iconColor: 'text-red-400',
      border: 'border-red-500/20',
    },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gradient-bg text-textPrimary overflow-hidden w-full">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 shrink-0">
          <div>
            <h1 className="text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-accentGreen to-accentBlue tracking-wide flex items-center gap-3">
              <Smartphone className="w-8 h-8 text-accentGreen flex-shrink-0" />
              Dispositivos Portátiles
            </h1>
            <p className="mt-2 text-textSecondary text-sm">
              GPS portátiles, rastreadores personales, satphones y beacons
            </p>
          </div>
          <button
            onClick={handleNewDevice}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accentGreen/10 border border-accentGreen/30 text-accentGreen font-semibold text-sm hover:bg-accentGreen/20 hover:border-accentGreen/50 transition-all duration-200 shadow-[0_0_15px_rgba(0,200,100,0.15)]"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Nuevo Dispositivo</span>
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 shrink-0">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`relative overflow-hidden rounded-2xl border ${card.border} bg-gradient-to-br ${card.gradient} backdrop-blur-md p-5 flex flex-col gap-3 shadow-lg`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-bgSurface/60 ${card.iconColor}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-3xl font-black text-textPrimary">{loading ? '-' : card.value}</p>
                <p className="text-xs text-textMuted font-medium mt-0.5">{card.label}</p>
              </div>
              <div className={`absolute -bottom-4 -right-4 w-20 h-20 rounded-full blur-2xl opacity-20 bg-current ${card.iconColor}`} />
            </div>
          ))}
        </div>

        {/* Table Section */}
        <div className="rounded-2xl border border-borderDefault bg-bgSurface/60 backdrop-blur-md overflow-hidden shadow-xl flex flex-col">
          {/* Table Header Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-borderDefault/50 shrink-0">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-textMuted" />
              <input
                type="text"
                placeholder="Buscar por nombre o IMEI..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-bgStart border border-borderDefault rounded-xl py-2.5 pl-11 pr-4 text-sm text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-accentBlue focus:ring-1 focus:ring-accentBlue transition-all"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-textMuted flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accentBlue animate-pulse" />
                {filtered.length} encontrados
              </div>
              <button 
                onClick={handleExport}
                className="flex items-center gap-2 bg-bgSurface/80 hover:bg-bgSurfaceHigh text-white px-4 py-2 text-sm rounded-xl border border-borderDefault transition-colors"
              >
                <Download size={16} className="text-accentBlue" />
                Exportar CSV
              </button>
            </div>
          </div>
          {/* Table Data */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bgStart/80">
                <tr className="border-b border-borderDefault">
                  {['Dispositivo', 'Tipo', 'IMEI / ID', 'Estado', 'Batería', 'Señal', 'Acciones'].map((col) => (
                    <th
                      key={col}
                      className="px-6 py-3 text-left text-[10px] font-black text-white uppercase tracking-wider whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-borderDefault">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-textMuted">Cargando dispositivos...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-bgSurfaceHigh border border-borderDefault flex items-center justify-center">
                          <Smartphone className="w-8 h-8 text-textMuted" />
                        </div>
                        <div>
                          <p className="text-textSecondary font-semibold">Sin dispositivos registrados</p>
                          <p className="text-textMuted text-xs mt-1 max-w-xs mx-auto">
                            No hay dispositivos o la búsqueda no arrojó resultados.
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map(device => (
                    <tr key={device.id} className="hover:bg-bgSurface transition-colors group">
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="font-bold text-white">{device.name}</div>
                        {device.avl_user && <div className="text-[10px] text-accentMint mt-0.5">{device.avl_user.provider_name}</div>}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-bgSurfaceHigh text-textSecondary border border-borderDefault">
                          {device.device_type}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs text-textSecondary">{device.imei || device.device_code || 'N/D'}</span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                          device.status === 'ACTIVE' ? 'bg-accentGreen/20 text-accentGreen border-accentGreen/30' :
                          device.status === 'MAINTENANCE' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                          'bg-statusDanger/20 text-statusDanger border-statusDanger/30'
                        }`}>
                          {device.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-textSecondary">
                          {getBatteryIcon(device.battery_level)}
                          {device.battery_level !== null ? `${device.battery_level}%` : 'N/D'}
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-textSecondary">
                          <Signal className={`w-4 h-4 ${device.signal_strength && device.signal_strength > 50 ? 'text-accentBlue' : 'text-textMuted'}`} />
                          {device.signal_strength !== null ? `${device.signal_strength}%` : 'N/D'}
                        </div>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditDevice(device)}
                            className="p-1.5 bg-bgSurfaceHigh border border-borderDefault rounded text-textMuted hover:text-white hover:border-textSecondary transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(device.id)}
                            className="p-1.5 bg-bgSurfaceHigh border border-borderDefault rounded text-textMuted hover:text-statusDanger hover:border-statusDanger/50 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Modal Alta/Edición */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bgStart border border-borderDefault rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-borderDefault">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-accentGreen" />
                {editingId ? 'Editar Dispositivo' : 'Nuevo Dispositivo'}
              </h3>
              <div className="flex items-center gap-3">
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
                <button
                  onClick={() => setShowModal(false)}
                  className="text-textMuted hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto">
              <form id="device-form" onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-textMuted uppercase mb-1">Nombre Identificativo</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-bgSurface border border-borderDefault rounded-lg p-2.5 text-sm text-white focus:border-accentGreen focus:outline-none transition-colors"
                    placeholder="Ej. Mochila GPS 01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-textMuted uppercase mb-1">IMEI o Código</label>
                  <input
                    type="text"
                    value={imei}
                    onChange={e => setImei(e.target.value)}
                    className="w-full bg-bgSurface border border-borderDefault rounded-lg p-2.5 text-sm font-mono text-white focus:border-accentGreen focus:outline-none transition-colors"
                    placeholder="IMEI del dispositivo"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-textMuted uppercase mb-1">Prestador AVL</label>
                  <select
                    value={avlUserId}
                    onChange={e => setAvlUserId(e.target.value)}
                    className="w-full bg-bgSurface border border-borderDefault rounded-lg p-2.5 text-sm text-white focus:border-accentGreen focus:outline-none transition-colors"
                  >
                    <option value="">Ninguno (Local)</option>
                    {avlUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.provider_name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-textMuted uppercase mb-1">Tipo</label>
                    <select
                      value={deviceType}
                      onChange={e => setDeviceType(e.target.value)}
                      className="w-full bg-bgSurface border border-borderDefault rounded-lg p-2.5 text-sm text-white focus:border-accentGreen focus:outline-none transition-colors"
                    >
                      <option value="PORTABLE_GPS">GPS Portátil</option>
                      <option value="SATPHONE">SatPhone</option>
                      <option value="ASSET_TRACKER">Tracker de Activos</option>
                      <option value="BEACON">Beacon / Tag</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-textMuted uppercase mb-1">Estado</label>
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value)}
                      className="w-full bg-bgSurface border border-borderDefault rounded-lg p-2.5 text-sm text-white focus:border-accentGreen focus:outline-none transition-colors"
                    >
                      <option value="ACTIVE">Activo</option>
                      <option value="INACTIVE">Inactivo</option>
                      <option value="MAINTENANCE">Mantenimiento</option>
                    </select>
                  </div>
                </div>
              </form>
            </div>
            <div className="p-5 border-t border-borderDefault bg-bgSurface/30 flex justify-end gap-3 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-bold text-textMuted hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="device-form"
                className="px-5 py-2 text-sm font-bold bg-accentGreen text-bgStart rounded-lg hover:bg-accentGreen/90 transition-colors shadow-lg shadow-accentGreen/20"
              >
                {editingId ? 'Guardar Cambios' : 'Registrar Dispositivo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
