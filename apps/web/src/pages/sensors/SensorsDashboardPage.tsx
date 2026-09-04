import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Thermometer, Droplets, Activity, Truck, Settings, Plus } from 'lucide-react';
import { SensorGauge } from './components/SensorGauge';
import { SensorHistoryModal } from './SensorHistoryModal';
import { SensorConfigModal } from './SensorConfigModal';
import { SelectorVehiculoSensor } from './SelectorVehiculoSensor';
import { Search, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTienePermiso, propsSinPermiso, CLASES_DESHABILITADO } from '../../components/RequirePermission';

export const SensorsDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = useAuthStore();
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');
  const [avlFilter, setAvlFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [selectedSensorType, setSelectedSensorType] = useState<string>('');

  // ⚠️ LA PUERTA CERRADA DESDE AFUERA.
  //
  // Este tablero se arma desde `sensor_configs`. Con la tabla vacía —que es el
  // estado real hoy: 0 filas, medido— el backend devuelve `[]` y la pantalla
  // quedaba en "No se encontraron sensores", sin ningún camino para crear el
  // primero: el modal de umbrales sólo se abría desde `TripDetailsPage`, es
  // decir desde adentro de un viaje. Una pantalla que sólo se puede usar si ya
  // está usada no se puede usar nunca.
  //
  // Ahora hay dos entradas: el botón de la cabecera (elegir vehículo) y el
  // botón "Configurar" de cada tarjeta (editar los umbrales que ya tiene).
  const puedeGestionarSensores = useTienePermiso('manage_sensors');
  const permisoSensores = propsSinPermiso(puedeGestionarSensores, 'manage_sensors');
  const [mostrarSelector, setMostrarSelector] = useState(false);
  const [vehiculoAConfigurar, setVehiculoAConfigurar] = useState<any>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/sensors/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Error fetching sensors dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // 10s refresh
    return () => clearInterval(interval);
  }, [token]);

  const getStatusColor = (val: number, min: number, max: number) => {
    if (val < min) return 'text-accentBlue border-accentBlue bg-accentBlue/10';
    if (val > max) return 'text-alertRed border-alertRed bg-alertRed/10';
    return 'text-accentGreen border-accentGreen bg-accentGreen/10';
  };

  const getStatusBgColor = (val: number, min: number, max: number) => {
    if (val < min) return '#2AB3FF';
    if (val > max) return '#FF9500';
    return '#00F59B';
  };

  if (loading) return <div className="p-8 text-textMuted">{t('sensors.loading')}</div>;

  const filteredData = data.filter((item) => {
    const v = item.vehicle;
    if (!v) return false;
    
    // Filtro Search
    if (search.trim()) {
      const term = search.toLowerCase();
      const p = v.plate?.toLowerCase() || '';
      const a = v.alias?.toLowerCase() || '';
      if (!p.includes(term) && !a.includes(term)) return false;
    }
    
    // Filtro Transporte
    if (carrierFilter && v.carrier?.name !== carrierFilter) return false;
    
    // Filtro AVL
    if (avlFilter && v.avl_user?.name !== avlFilter) return false;

    return true;
  });

  const carriers = Array.from(new Set(data.map(d => d.vehicle?.carrier?.name).filter(Boolean))) as string[];
  const avls = Array.from(new Set(data.map(d => d.vehicle?.avl_user?.name).filter(Boolean))) as string[];

  const exportToExcel = () => {
    const headers = ['Patente', 'Alias', 'Transporte', 'AVL', 'Sensor', 'Rango', 'Valor Actual'];
    const rows = filteredData.flatMap(item => {
      const v = item.vehicle;
      return item.configs.map((config: any) => {
        const isTemp = config.sensor_type === 'temperature';
        const unit = isTemp ? '°C' : '%';
        const latest = item.latest;
        const val = latest ? (isTemp ? latest.temperature_c : latest.humidity_pct) : null;
        const numVal = val ? Number(val).toFixed(2) : 'Sin datos';
        return [
          v.plate,
          v.alias || '',
          v.carrier?.name || '',
          v.avl_user?.name || '',
          isTemp ? t('sensors.temperature') : t('sensors.humidity'),
          `${config.value_min}${unit} a ${config.value_max}${unit}`,
          numVal === 'Sin datos' ? t('sensors.no_data') : `${numVal} ${unit}`
        ].map(cell => `"${cell}"`).join(',');
      });
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Sensores_Clima.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 h-full overflow-auto space-y-6">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 
            className="text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-accentGreen to-accentBlue tracking-wider flex items-center"
            style={{ textShadow: '0 0 10px rgba(42,179,255,0.3)', animation: 'pulse 3s infinite' }}
          >
            <Thermometer className="w-8 h-8 mr-3 text-accentGreen" />
            {t('sensors.title')}
          </h1>
          <p className="text-textMuted mt-1 ml-11">{t('sensors.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted w-4 h-4" />
            <input
              type="text"
              placeholder={t('sensors.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-bgSurface/50 border border-borderDefault text-white pl-9 pr-3 py-1.5 text-sm rounded-lg focus:outline-none focus:border-accentBlue transition-colors"
            />
          </div>
          
          <select 
            className="bg-bgSurface/50 border border-borderDefault text-white px-3 py-1.5 text-sm rounded-lg focus:outline-none focus:border-accentBlue appearance-none"
            value={carrierFilter}
            onChange={e => setCarrierFilter(e.target.value)}
          >
            <option value="">{t('sensors.all_carriers')}</option>
            {carriers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select 
            className="bg-bgSurface/50 border border-borderDefault text-white px-3 py-1.5 text-sm rounded-lg focus:outline-none focus:border-accentBlue appearance-none"
            value={avlFilter}
            onChange={e => setAvlFilter(e.target.value)}
          >
            <option value="">{t('sensors.all_avl')}</option>
            {avls.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-bgSurface/80 hover:bg-bgSurfaceHigh text-white px-4 py-1.5 text-sm rounded-lg border border-borderDefault transition-colors"
          >
            <Download size={16} className="text-accentBlue" />
            {t('sensors.export_csv')}
          </button>

          <button
            onClick={() => setMostrarSelector(true)}
            {...permisoSensores}
            className={`flex items-center gap-2 bg-accentGreen text-bgStart px-4 py-1.5 text-sm font-bold rounded-lg hover:bg-accentGreen/90 transition-colors ${CLASES_DESHABILITADO}`}
          >
            <Plus size={16} />
            {t('sensors.configure')}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {filteredData.map((item) => {
          const v = item.vehicle;
          const configs = item.configs;
          const latest = item.latest;

          return (
            <div key={v.id} className="bg-bgStart/40 border border-borderDefault rounded-xl p-3 backdrop-blur-sm relative overflow-hidden group hover:border-borderHover transition-colors flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="w-full lg:w-48 shrink-0">
                <div className="flex items-center justify-between lg:justify-start lg:gap-3 mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accentGreen animate-pulse"></div>
                    <h3 className="font-bold text-base">{v.plate}</h3>
                  </div>
                  <span className="text-xs text-textMuted truncate max-w-[120px]">{v.alias || t('sensors.no_alias')}</span>
                </div>
                {v.carrier?.name && <div className="text-xs text-textMuted flex items-center gap-1"><Truck size={12}/> {v.carrier.name}</div>}
                {/* Editar los umbrales de este vehículo sin salir del tablero.
                    Antes había que entrar a un viaje para llegar al modal. */}
                <button
                  onClick={() => setVehiculoAConfigurar(v)}
                  {...propsSinPermiso(puedeGestionarSensores, 'manage_sensors', t('sensors.edit_thresholds'))}
                  className={`mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-textSecondary hover:text-white border border-borderDefault hover:border-textSecondary rounded-md px-2 py-1 transition-colors ${CLASES_DESHABILITADO}`}
                >
                  <Settings size={12} />
                  {t('sensors.edit_thresholds')}
                </button>
              </div>

              <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-6">
              {configs.map((config: any) => {
                const isTemp = config.sensor_type === 'temperature';
                const Icon = isTemp ? Thermometer : Droplets;
                const unit = isTemp ? '°C' : '%';
                const val = latest ? (isTemp ? latest.temperature_c : latest.humidity_pct) : null;
                const numVal = val ? Number(val) : null;
                const hasData = numVal !== null;
                const colorClass = hasData ? getStatusColor(numVal, Number(config.value_min), Number(config.value_max)) : 'text-textMuted border-borderDefault bg-bgSurface';
                const fgColorHex = hasData ? getStatusBgColor(numVal, Number(config.value_min), Number(config.value_max)) : '#4B5563';
                
                return (
                  <div 
                    key={config.id} 
                    className="flex-1 min-w-[250px] cursor-pointer bg-bgSurface/30 rounded-lg p-3 border border-transparent hover:border-borderDefault transition-colors"
                    onClick={() => {
                      setSelectedVehicle(v);
                      setSelectedSensorType(config.sensor_type);
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-textMuted">
                        <Icon size={16} />
                        <span className="text-sm font-medium uppercase tracking-wider">{isTemp ? t('sensors.temperature') : t('sensors.humidity')}</span>
                      </div>
                      <span className="text-xs font-mono bg-bgSurface px-2 py-0.5 rounded text-textMuted border border-borderDefault">
                        {t('sensors.range')}: {config.value_min}{unit} - {config.value_max}{unit}
                      </span>
                    </div>

                    <div className="flex items-end justify-between gap-3">
                      <div className={`text-2xl font-black font-mono tracking-tighter ${colorClass.split(' ')[0]}`}>
                        {hasData ? numVal.toFixed(2) : '--.--'}<span className="text-sm ml-1 opacity-50">{unit}</span>
                      </div>
                      <div className="w-14 h-7 relative flex items-end justify-center shrink-0">
                        {hasData && (
                          <SensorGauge 
                            value={numVal} 
                            min={Number(config.value_min) - 10} 
                            max={Number(config.value_max) + 10} 
                            safeMin={Number(config.value_min)}
                            safeMax={Number(config.value_max)}
                            colorHex={fgColorHex}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          );
        })}

        {filteredData.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center text-textMuted">
            <Activity size={48} className="mx-auto mb-4 opacity-20" />
            {/*
              Dos vacíos distintos, dos mensajes distintos. Antes los dos decían
              "no se encontraron sensores o vehículos para tu búsqueda", que
              cuando la tabla está vacía es directamente falso: no hay ninguna
              búsqueda involucrada, no hay nada configurado todavía.
            */}
            {data.length === 0 ? (
              <>
                <p className="text-white font-semibold mb-1">{t('sensors.empty_title')}</p>
                <p className="max-w-md mx-auto text-sm">{t('sensors.empty_hint')}</p>
                <button
                  onClick={() => setMostrarSelector(true)}
                  {...permisoSensores}
                  className={`mt-5 inline-flex items-center gap-2 bg-accentGreen text-bgStart px-5 py-2 text-sm font-bold rounded-lg hover:bg-accentGreen/90 transition-colors ${CLASES_DESHABILITADO}`}
                >
                  <Plus size={16} />
                  {t('sensors.configure_first')}
                </button>
              </>
            ) : (
              <p>{t('sensors.not_found')}</p>
            )}
          </div>
        )}
      </div>

      {selectedVehicle && selectedSensorType && (
        <SensorHistoryModal
          onClose={() => {
            setSelectedVehicle(null);
            setSelectedSensorType('');
          }}
          vehicle={selectedVehicle}
          sensorType={selectedSensorType}
          token={token || ''}
        />
      )}

      {mostrarSelector && (
        <SelectorVehiculoSensor
          yaConfigurados={new Set(data.map((d) => d.vehicle?.id).filter(Boolean))}
          onElegir={(v) => { setMostrarSelector(false); setVehiculoAConfigurar(v); }}
          onClose={() => setMostrarSelector(false)}
        />
      )}

      {vehiculoAConfigurar && (
        <SensorConfigModal
          vehicleId={vehiculoAConfigurar.id}
          vehicleLabel={vehiculoAConfigurar.plate}
          onClose={() => setVehiculoAConfigurar(null)}
          // Sin esto el vehículo recién configurado no aparece hasta el
          // refresco de 10 s, y el operador cree que no se guardó.
          onSaved={fetchData}
        />
      )}
    </div>
  );
};
