import React, { useState, useEffect } from 'react';
import {
  Bell, Plus, Trash2, ToggleLeft, ToggleRight, Mail, MessageSquare,
  Webhook, Smartphone, X, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const CHANNEL_TYPE_ICONS: Record<string, React.ReactNode> = {
  email:     <Mail className="w-4 h-4" />,
  sms:       <MessageSquare className="w-4 h-4" />,
  whatsapp:  <MessageSquare className="w-4 h-4 text-green-400" />,
  webhook:   <Webhook className="w-4 h-4" />,
  push:      <Smartphone className="w-4 h-4" />,
};

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp', webhook: 'Webhook', push: 'Push Notification'
};

const EVENT_GROUPS = [
  { group: 'Alertas',       events: [{ key: 'alert.critical', label: 'Alerta Crítica' }, { key: 'alert.warning', label: 'Alerta de Advertencia' }, { key: 'alert.resolved', label: 'Alerta Resuelta' }] },
  { group: 'Viajes',        events: [{ key: 'trip.started', label: 'Viaje Iniciado' }, { key: 'trip.ended', label: 'Viaje Finalizado' }, { key: 'trip.deviation', label: 'Desviación de Ruta' }, { key: 'trip.delayed', label: 'Viaje Demorado' }] },
  { group: 'Reportería',    events: [{ key: 'report.daily', label: 'Reporte Diario' }, { key: 'report.weekly', label: 'Reporte Semanal' }, { key: 'report.monthly', label: 'Reporte Mensual' }] },
  { group: 'Vencimientos',  events: [{ key: 'vehicle.expiry', label: 'Vencimiento Póliza/Patente/VTV' }, { key: 'driver.expiry', label: 'Vencimiento Licencia Conductor' }] },
  { group: 'Sensores',      events: [{ key: 'sensor.threshold', label: 'Umbral de Sensor Superado' }] },
  { group: 'Geofencing',    events: [{ key: 'geofence.enter', label: 'Ingreso a Zona Restringida' }, { key: 'geofence.exit', label: 'Salida de Zona' }] },
  { group: 'Dispositivos',  events: [{ key: 'device.offline', label: 'Dispositivo Sin Señal' }, { key: 'device.online', label: 'Dispositivo Reconectado' }] },
];

interface Channel {
  id: string;
  name: string;
  channel_type: string;
  target: string;
  events: string[];
  is_active: boolean;
  config: any;
}

const defaultForm = { name: '', channel_type: 'email', target: '', events: [] as string[], config: {} };

export const NotificationChannelsTab: React.FC = () => {
  const { t } = useTranslation();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(EVENT_GROUPS.map(g => g.group));
  const [saving, setSaving] = useState(false);

  const fetchChannels = async () => {
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch('http://localhost:3000/api/v1/notifications/channels', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setChannels(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchChannels(); }, []);

  const openCreate = () => {
    setEditingChannel(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEdit = (ch: Channel) => {
    setEditingChannel(ch);
    setForm({ name: ch.name, channel_type: ch.channel_type, target: ch.target, events: [...ch.events], config: ch.config || {} });
    setShowModal(true);
  };

  const toggleEvent = (key: string) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(key) ? f.events.filter(e => e !== key) : [...f.events, key]
    }));
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(g => g.includes(group) ? g.filter(x => x !== group) : [...g, group]);
  };

  const handleSave = async () => {
    if (!form.name || !form.target) { alert('Nombre y destino son requeridos'); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem('rusertech_token');
      const method = editingChannel ? 'PUT' : 'POST';
      const url = editingChannel
        ? `http://localhost:3000/api/v1/notifications/channels/${editingChannel.id}`
        : `http://localhost:3000/api/v1/notifications/channels`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setShowModal(false);
        fetchChannels();
      } else {
        const err = await res.json();
        alert(err.message || 'Error al guardar');
      }
    } finally { setSaving(false); }
  };

  const toggleActive = async (id: string) => {
    const token = localStorage.getItem('rusertech_token');
    const res = await fetch(`http://localhost:3000/api/v1/notifications/channels/${id}/toggle`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) fetchChannels();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('settings_notifications.confirm_delete'))) return;
    try {
      const token = localStorage.getItem('rusertech_token');
      const res = await fetch(`http://localhost:3000/api/v1/notifications/channels/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) fetchChannels();
    } catch(err) { console.error(err); }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-accentBlue" /> {t('settings_notifications.title')}
          </h2>
          <p className="text-xs text-textMuted mt-1">{t('settings_notifications.subtitle')}</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-accentBlue hover:bg-blue-600 text-white px-4 py-2 rounded font-bold text-sm flex items-center transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" /> {t('settings_notifications.new_channel')}
        </button>
      </div>

      {loading ? (
        <div className="text-textMuted text-sm">Cargando canales...</div>
      ) : channels.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-textMuted bg-bgStart rounded-xl border border-borderDefault border-dashed p-12">
          <Bell className="w-12 h-12 opacity-20 mb-4" />
          <p className="font-bold">{t('settings_notifications.no_channels')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 overflow-y-auto flex-1">
          {channels.map(ch => (
            <div key={ch.id} className={`bg-bgStart border rounded-xl p-4 flex items-start gap-4 transition-all ${ch.is_active ? 'border-borderDefault' : 'border-borderDefault opacity-50'}`}>
              <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white ${
                ch.channel_type === 'email' ? 'bg-blue-500/20 text-blue-400' :
                ch.channel_type === 'whatsapp' ? 'bg-green-500/20 text-green-400' :
                ch.channel_type === 'webhook' ? 'bg-purple-500/20 text-purple-400' :
                ch.channel_type === 'sms' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {CHANNEL_TYPE_ICONS[ch.channel_type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{ch.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-bgSurface border border-borderDefault text-textMuted uppercase font-bold">
                    {CHANNEL_TYPE_LABELS[ch.channel_type]}
                  </span>
                </div>
                <div className="text-sm text-textMuted truncate mt-0.5">{ch.target}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {ch.events.length === 0 ? (
                    <span className="text-xs text-statusDanger">Sin eventos configurados</span>
                  ) : ch.events.map(ev => (
                    <span key={ev} className="text-[10px] px-1.5 py-0.5 rounded bg-accentBlue/10 text-accentBlue border border-accentBlue/20 font-bold">
                      {ev}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggleActive(ch.id)} className="p-1.5 text-textMuted hover:text-white rounded transition-colors" title={ch.is_active ? 'Deshabilitar' : 'Habilitar'}>
                  {ch.is_active ? <ToggleRight className="w-5 h-5 text-accentGreen" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => openEdit(ch)} className="p-1.5 text-textMuted hover:text-accentBlue rounded transition-colors" title="Editar">
                  <Bell className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(ch.id)} className="p-1.5 text-textMuted hover:text-statusDanger rounded transition-colors" title="Eliminar">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-bgOverlay z-[100] flex items-center justify-center p-4">
          <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-2xl shadow-card overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-borderDefault bg-bgStart flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-accentBlue" />
                {editingChannel ? t('common.edit') : t('settings_notifications.new_channel')}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-textMuted hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4 mb-2">
                <div>
                  <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">{t('settings_notifications.form_name')}</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={t('settings_notifications.form_desc')}
                    className="w-full px-3 py-2 bg-bgStart border border-borderDefault rounded text-white text-sm focus:outline-none focus:border-accentBlue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">{t('settings_notifications.form_type')}</label>
                  <select
                    value={form.channel_type}
                    onChange={e => setForm(f => ({ ...f, channel_type: e.target.value, target: '' }))}
                    className="w-full px-3 py-2 bg-bgStart border border-borderDefault rounded text-white text-sm focus:outline-none focus:border-accentBlue"
                  >
                    {Object.entries(CHANNEL_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-textSecondary mb-1 uppercase">{t('settings_notifications.form_dest')}</label>
                  <input
                    type="text"
                    value={form.target}
                    onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                    placeholder={form.channel_type === 'email' ? 'ej: admin@empresa.com' : form.channel_type === 'webhook' ? 'https://...' : '+5491100000000'}
                    className="w-full px-3 py-2 bg-bgStart border border-borderDefault rounded text-white text-sm focus:outline-none focus:border-accentBlue font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-textSecondary mb-3 uppercase">
                  {t('settings_notifications.form_events')}
                  <span className="ml-2 text-accentBlue">({form.events.length} seleccionados)</span>
                </label>
                <div className="flex flex-col gap-2">
                  {EVENT_GROUPS.map(group => (
                    <div key={group.group} className="bg-bgStart border border-borderDefault rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.group)}
                        className="w-full flex items-center justify-between px-4 py-2 text-sm font-bold text-textSecondary hover:text-white transition-colors"
                      >
                        <span>{group.group}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-accentBlue">
                            {group.events.filter(e => form.events.includes(e.key)).length}/{group.events.length}
                          </span>
                          {expandedGroups.includes(group.group) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>
                      {expandedGroups.includes(group.group) && (
                        <div className="px-4 pb-3 grid grid-cols-2 gap-2 border-t border-borderDefault pt-3">
                          {group.events.map(ev => {
                            const selected = form.events.includes(ev.key);
                            return (
                              <div
                                key={ev.key}
                                onClick={() => toggleEvent(ev.key)}
                                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${selected ? 'bg-accentBlue/10 border border-accentBlue/30' : 'bg-bgSurface border border-transparent hover:border-borderHighlight'}`}
                              >
                                <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${selected ? 'bg-accentBlue border-accentBlue' : 'border-textMuted'}`}>
                                  {selected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span className={`text-xs font-bold ${selected ? 'text-white' : 'text-textMuted'}`}>{ev.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-borderDefault bg-bgStart flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-textMuted hover:text-white font-bold text-sm">
                {t('settings_notifications.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-accentBlue hover:bg-blue-600 text-white font-bold text-sm rounded shadow-card transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? t('common.loading') : <><Check className="w-4 h-4" /> {t('settings_notifications.save')}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
