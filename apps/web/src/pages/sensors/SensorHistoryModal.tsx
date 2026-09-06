import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { X, Activity, Download } from 'lucide-react';
import { exportToCsv } from '../../utils/export';
import { API_URL } from '../../services/api';

interface Props {
  vehicle: any;
  sensorType: string;
  token: string;
  onClose: () => void;
}

export const SensorHistoryModal: React.FC<Props> = ({ vehicle, sensorType, token, onClose }) => {
  const [data, setData] = useState<any[]>([]);
  const [period, setPeriod] = useState('24h');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [vehicle.id, sensorType, period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/sensors/history/${vehicle.id}?sensorType=${sensorType}&period=${period}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleExport = () => {
    const headers = ['Fecha/Hora', 'Valor'];
    const rows = data.map(d => {
      const val = sensorType === 'temperature' ? d.avg_temp : d.avg_hum;
      return [
        new Date(d.bucket).toLocaleString(),
        val != null ? Number(val).toFixed(2) : ''
      ];
    });
    exportToCsv(`Historico_${sensorType}_Vehiculo_${vehicle.id}`, headers, rows);
  };

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#252D6B',
      textStyle: { color: '#E5E7EB' },
      borderColor: '#7CFF3C',
    },
    grid: { left: '5%', right: '5%', bottom: '10%', top: '10%' },
    xAxis: {
      type: 'category',
      data: data.map(d => new Date(d.bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
      axisLine: { lineStyle: { color: '#6B7280' } },
      axisLabel: { color: '#9CA3AF' }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#6B7280' } },
      splitLine: { lineStyle: { color: '#2E3578' } },
      axisLabel: { color: '#9CA3AF' }
    },
    series: [
      {
        data: data.map(d => sensorType === 'temperature' ? d.avg_temp : d.avg_hum),
        type: 'line',
        smooth: true,
        lineStyle: { color: sensorType === 'temperature' ? '#EAB308' : '#2AB3FF', width: 3 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: sensorType === 'temperature' ? 'rgba(234, 179, 8, 0.5)' : 'rgba(42, 179, 255, 0.5)' }, { offset: 1, color: 'rgba(31, 42, 90, 0)' }]
          }
        },
        symbol: 'none',
      }
    ]
  };

  return (
    <div className="fixed inset-0 bg-bgOverlay z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-4xl shadow-card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-borderDefault flex justify-between items-center bg-bgStart/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className={sensorType === 'temperature' ? 'text-statusWarning' : 'text-accentBlue'} />
            Histórico de {sensorType === 'temperature' ? 'Temperatura' : 'Humedad'}
          </h2>
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-bgSurfaceHigh hover:bg-bgSurface text-textPrimary text-xs font-medium rounded-md border border-borderDefault transition-colors"
            >
              <Download size={14} className="text-accentBlue" />
              Exportar
            </button>
            <button onClick={onClose} className="text-textMuted hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 flex gap-2 border-b border-borderDefault/50 bg-bgStart/20">
          {['1h', '6h', '24h', '7d'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors ${period === p ? 'bg-accentBlue text-bgStart shadow-[0_0_10px_rgba(42,179,255,0.4)]' : 'bg-bgSurfaceHigh text-textSecondary hover:text-white'}`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="p-6 h-[400px]">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center text-textMuted font-mono">Cargando métricas...</div>
          ) : (
            <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
          )}
        </div>
      </div>
    </div>
  );
};
