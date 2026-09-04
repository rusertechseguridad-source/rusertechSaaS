import React, { useEffect, useState } from 'react';
import { PieChart, Activity, AlertTriangle, Truck, Download } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { useTranslation } from 'react-i18next';
import { EstadoConsulta } from '../../components/EstadoConsulta';
import { mensajeDeError } from '../../services/avisos';

export const AnalyticsDashboard: React.FC = () => {
  const { t } = useTranslation();
  // La Tanda 2 dejó esto como `[, setLoading]` con una nota: "pintarlo es de
  // la Tanda 6". Es esta tanda.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('month');
  const [fleetData, setFleetData] = useState<any>(null);
  const [tripsData, setTripsData] = useState<any>(null);
  const [alertsData, setAlertsData] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` };
      
      const [resFleet, resTrips, resAlerts] = await Promise.all([
        fetch(`http://localhost:3000/api/v1/analytics/fleet?period=${period}`, { headers }),
        fetch(`http://localhost:3000/api/v1/analytics/trips?period=${period}`, { headers }),
        fetch(`http://localhost:3000/api/v1/analytics/alerts?period=${period}`, { headers })
      ]);

      // ⚠️ Antes: `if (res.ok) setX(...)` y nada en el `else`. Ante un 403 los
      // tres estados quedaban en `null`, los gráficos se dibujaban con ceros, y
      // el panel afirmaba "0 viajes" cuando la verdad era "no tenés permiso
      // para ver esto". Un panel de analítica que muestra ceros falsos es peor
      // que uno que no carga.
      const fallidas = [resFleet, resTrips, resAlerts].filter((r) => !r.ok);
      if (fallidas.length > 0) {
        const cuerpo = await fallidas[0].json().catch(() => null);
        setError(mensajeDeError(fallidas[0].status, cuerpo));
        return;
      }

      setFleetData(await resFleet.json());
      setTripsData(await resTrips.json());
      setAlertsData(await resAlerts.json());
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[AnalyticsDashboard]', e);
      setError('No se pudo conectar con el servidor. Revisá tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  const getTripsChartOptions = () => {
    if (!tripsData?.statusDistribution) return {};
    const data = tripsData.statusDistribution;
    
    return {
      tooltip: { trigger: 'item' },
      series: [
        {
          name: t('analytics.trip'),
          type: 'pie',
          radius: ['40%', '70%'],
          itemStyle: {
            borderRadius: 10,
            borderColor: '#111827',
            borderWidth: 2
          },
          label: { show: false },
          data: data.map((d: any) => ({
            value: d.value,
            name: d.name,
            itemStyle: {
              color: d.name === 'FINALIZADO' ? '#34D399' : d.name === 'EN_CURSO' ? '#3B82F6' : d.name === 'CANCELADO' ? '#EF4444' : '#6B7280'
            }
          }))
        }
      ]
    };
  };

  const getAlertsChartOptions = () => {
    if (!alertsData?.bySeverity) return {};
    const data = alertsData.bySeverity;
    
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'category',
        data: data.map((d: any) => d.name),
        axisLine: { lineStyle: { color: '#6B7280' } }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#6B7280' } },
        splitLine: { lineStyle: { color: '#374151' } }
      },
      series: [
        {
          data: data.map((d: any) => ({
            value: d.value,
            itemStyle: {
              color: d.name === 'critical' ? '#EF4444' : d.name === 'warning' ? '#F59E0B' : '#34D399'
            }
          })),
          type: 'bar',
          barWidth: '40%',
          itemStyle: { borderRadius: [4, 4, 0, 0] }
        }
      ]
    };
  };

  return (
    <div className="p-8 h-full w-full flex flex-col overflow-y-auto">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <h1 
          className="text-3xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-accentGreen to-accentBlue tracking-wider flex items-center"
          style={{ textShadow: '0 0 10px rgba(42,179,255,0.3)' }}
        >
          <PieChart className="w-8 h-8 mr-3 text-accentBlue" />
          {t('analytics.title')}
        </h1>
        <div className="flex gap-4 items-center">
          <select 
            className="bg-bgSurface border border-borderDefault rounded p-2 text-white outline-none focus:border-accentBlue"
            value={period}
            onChange={e => setPeriod(e.target.value)}
          >
            <option value="day">{t('analytics.period_24h')}</option>
            <option value="week">{t('analytics.period_week')}</option>
            <option value="month">{t('analytics.period_month')}</option>
            <option value="year">{t('analytics.period_year')}</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-accentBlue hover:bg-accentBlue/90 text-white font-bold rounded shadow-lg shadow-accentBlue/20 transition-all">
            <Download size={18} />
            {t('analytics.export_dashboard')}
          </button>
        </div>
      </div>

      {/* Antes de este bloque, un 403 pintaba todos los KPI en cero: el panel
          afirmaba "0 viajes" cuando la verdad era "no tenés permiso". */}
      {(error || loading) && (
        <EstadoConsulta cargando={loading} error={error} vacio={false}
          entidad="datos de analítica" onReintentar={fetchData} />
      )}

      {!error && !loading && (
      <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6 shrink-0">
        <div className="bg-bgSurface border border-borderDefault rounded-xl p-6 shadow-card flex flex-col relative overflow-hidden">
          <Truck className="absolute top-4 right-4 w-16 h-16 text-textMuted opacity-20" />
          <div className="text-textMuted text-xs font-bold uppercase tracking-wider mb-2 z-10">{t('analytics.total_trips')}</div>
          <div className="text-4xl font-display font-black text-white z-10">
            {fleetData?.totalTrips || 0}
          </div>
        </div>

        <div className="bg-bgSurface border border-borderDefault rounded-xl p-6 shadow-card flex flex-col relative overflow-hidden">
          <Activity className="absolute top-4 right-4 w-16 h-16 text-accentGreen opacity-10" />
          <div className="text-textMuted text-xs font-bold uppercase tracking-wider mb-2 z-10">{t('analytics.completed_vs_canceled')}</div>
          <div className="flex gap-4 items-end mt-2 z-10">
            <div>
              <span className="text-2xl font-bold text-accentGreen">{fleetData?.completedTrips || 0}</span>
              <span className="text-xs text-textSecondary ml-1">{t('analytics.completed')}</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-statusDanger">{fleetData?.canceledTrips || 0}</span>
              <span className="text-xs text-textSecondary ml-1">{t('analytics.canceled')}</span>
            </div>
          </div>
        </div>

        <div className="bg-bgSurface border border-borderDefault rounded-xl p-6 shadow-card flex flex-col relative overflow-hidden">
          <PieChart className="absolute top-4 right-4 w-16 h-16 text-accentBlue opacity-10" />
          <div className="text-textMuted text-xs font-bold uppercase tracking-wider mb-2 z-10">{t('analytics.distance_traveled')}</div>
          <div className="text-4xl font-display font-black text-white z-10">
            {fleetData?.totalKm || 0} <span className="text-sm text-textMuted font-normal">{t('analytics.km')}</span>
          </div>
        </div>

        <div className="bg-bgSurface border border-borderDefault rounded-xl p-6 shadow-card flex flex-col relative overflow-hidden">
          <AlertTriangle className="absolute top-4 right-4 w-16 h-16 text-statusWarning opacity-10" />
          <div className="text-textMuted text-xs font-bold uppercase tracking-wider mb-2 z-10">{t('analytics.alerts_generated')}</div>
          <div className="text-4xl font-display font-black text-white z-10">
            {alertsData?.total || 0}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-[400px]">
        <div className="bg-bgSurface border border-borderDefault rounded-xl shadow-card flex flex-col">
          <div className="p-4 border-b border-borderDefault shrink-0">
            <h2 className="text-sm font-bold text-textSecondary uppercase tracking-wider">
              {t('analytics.trips_distribution')}
            </h2>
          </div>
          <div className="flex-1 p-4 min-h-[300px]">
             {tripsData?.statusDistribution?.length > 0 ? (
               <ReactECharts option={getTripsChartOptions()} style={{ height: '100%', width: '100%' }} />
             ) : (
               <div className="w-full h-full flex items-center justify-center text-textMuted">{t('analytics.no_trips_data')}</div>
             )}
          </div>
        </div>

        <div className="bg-bgSurface border border-borderDefault rounded-xl shadow-card flex flex-col">
          <div className="p-4 border-b border-borderDefault shrink-0">
            <h2 className="text-sm font-bold text-textSecondary uppercase tracking-wider">
              {t('analytics.alerts_by_severity')}
            </h2>
          </div>
          <div className="flex-1 p-4 min-h-[300px]">
             {alertsData?.bySeverity?.length > 0 ? (
               <ReactECharts option={getAlertsChartOptions()} style={{ height: '100%', width: '100%' }} />
             ) : (
               <div className="w-full h-full flex items-center justify-center text-textMuted">{t('analytics.no_alerts_data')}</div>
             )}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
};
