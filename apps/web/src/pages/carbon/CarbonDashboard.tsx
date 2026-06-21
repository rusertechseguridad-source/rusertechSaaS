import React, { useEffect, useState } from 'react';
import { Leaf, Activity, Download, Settings, BarChart2 } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';
import ReactECharts from 'echarts-for-react';
import { useTranslation } from 'react-i18next';

export const CarbonDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [apiKey, setApiKey] = useState('');
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    fetchSettings();
    fetchData();
  }, [period]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/carbon/settings', {
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` }
      });
      if (res.ok) {
        const json = await res.json();
        setSettings(json);
        setApiKey(json.climatiq_api_key || '');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/api/v1/analytics/carbon?period=${period}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` }
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleClimatiq = async (checked: boolean) => {
    if (checked && !apiKey) {
      const key = prompt(t('carbon.prompt_api_key'));
      if (!key) return;
      setApiKey(key);
      await saveSettings(true, key);
    } else {
      await saveSettings(checked, apiKey);
    }
  };

  const saveSettings = async (useClimatiq: boolean, key: string) => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/carbon/settings/toggle-climatiq', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`
        },
        body: JSON.stringify({ use_climatiq_api: useClimatiq, climatiq_api_key: key })
      });
      if (res.ok) {
        fetchSettings();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getChartOptions = () => {
    if (!data?.trend) return {};
    
    const dates = data.trend.map((d: any) => new Date(d.date).toLocaleDateString());
    const values = data.trend.map((d: any) => parseFloat(d.co2));

    return {
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#6B7280' } }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#6B7280' } },
        splitLine: { lineStyle: { color: '#374151' } }
      },
      series: [
        {
          data: values,
          type: 'line',
          smooth: true,
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(52, 211, 153, 0.5)' },
                { offset: 1, color: 'rgba(52, 211, 153, 0)' }
              ]
            }
          },
          itemStyle: { color: '#34D399' }
        }
      ]
    };
  };

  return (
    <div className="p-8 h-full w-full flex flex-col overflow-y-auto">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <h1 
          className="text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-accentGreen to-accentBlue tracking-wider flex items-center"
          style={{ textShadow: '0 0 10px rgba(52,211,153,0.3)' }}
        >
          <Leaf className="w-8 h-8 mr-3 text-accentGreen" />
          {t('carbon.title')}
        </h1>
        <div className="flex gap-4 items-center">
          <select 
            className="bg-bgSurface border border-borderDefault rounded p-2 text-white outline-none focus:border-accentGreen"
            value={period}
            onChange={e => setPeriod(e.target.value)}
          >
            <option value="day">{t('carbon.period_24h')}</option>
            <option value="week">{t('carbon.period_week')}</option>
            <option value="month">{t('carbon.period_month')}</option>
            <option value="year">{t('carbon.period_year')}</option>
          </select>

          <RequirePermission permission="admin:settings">
            <div className="bg-bgSurface border border-borderDefault rounded-xl px-4 py-2 flex items-center gap-3">
              <span className="text-sm font-bold text-textSecondary uppercase tracking-wider">
                {t('carbon.climatiq_engine')}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings?.use_climatiq_api || false}
                  onChange={(e) => handleToggleClimatiq(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accentGreen"></div>
              </label>
            </div>
          </RequirePermission>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 shrink-0">
        <div className="bg-bgSurface border border-borderDefault rounded-xl p-6 shadow-card col-span-1 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Leaf className="w-24 h-24 text-accentGreen" />
          </div>
          <div className="text-textMuted text-sm font-bold uppercase tracking-wider mb-2 relative z-10">
            {t('carbon.total_emissions')}
          </div>
          <div className="text-5xl font-display font-black text-white relative z-10">
            {data ? parseFloat(data.totalCo2).toLocaleString('es-AR') : '0'}
          </div>
          <div className="text-accentGreen text-xs mt-2 relative z-10 font-bold">
            {t('carbon.based_on_telemetry')}
          </div>
        </div>

        <div className="bg-bgSurface border border-borderDefault rounded-xl p-4 shadow-card col-span-2">
          <h3 className="text-sm font-bold text-textSecondary uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4" />
            {t('carbon.emissions_trend')}
          </h3>
          <div className="h-48">
            {data?.trend && data.trend.length > 0 ? (
              <ReactECharts option={getChartOptions()} style={{ height: '100%', width: '100%' }} />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-textMuted">
                {t('carbon.no_trend_data')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-bgSurface border border-borderDefault rounded-xl shadow-card flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-borderDefault flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-accentGreen" />
            {t('carbon.vehicle_ranking')}
          </h2>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-bgSurfaceHigh hover:bg-bgSurface text-textPrimary text-sm font-medium rounded-md border border-borderDefault transition-colors">
            <Download size={16} className="text-accentGreen" />
            {t('carbon.export_report')}
          </button>
        </div>
        <div className="p-4 flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-borderDefault text-textMuted text-xs uppercase tracking-wider">
                <th className="p-3">{t('carbon.table.vehicle')}</th>
                <th className="p-3">{t('carbon.table.distance')}</th>
                <th className="p-3">{t('carbon.table.fuel_est')}</th>
                <th className="p-3">{t('carbon.table.co2_impact')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.vehicleRanking?.map((v: any) => (
                <tr key={v.vehicle_id} className="border-b border-borderDefault/50 hover:bg-bgSurfaceHigh/30 transition-colors">
                  <td className="p-3 font-bold text-white">{v.plate}</td>
                  <td className="p-3 text-textSecondary">{parseFloat(v.distance_km).toFixed(2)}</td>
                  <td className="p-3 text-textSecondary">{parseFloat(v.fuel_liters).toFixed(2)}</td>
                  <td className="p-3 font-bold text-statusDanger/90">{parseFloat(v.co2_kg).toFixed(2)}</td>
                </tr>
              ))}
              {(!data?.vehicleRanking || data.vehicleRanking.length === 0) && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-textMuted">
                    {t('carbon.no_records')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
