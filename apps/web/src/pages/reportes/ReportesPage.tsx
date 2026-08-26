import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BarChart3, Download } from 'lucide-react';
import { RequirePermission, SinPermiso } from '../../components/RequirePermission';
import { exportToCsv } from '../../utils/export';

/**
 * REPORTES AGREGADOS — tendencias por período.
 *
 * Pantalla funcional: tablas y export CSV. Todos los datos salen de
 * trip_summary vía /api/v1/informes/reportes/* — nunca de telemetría, por eso
 * cada pestaña responde en milisegundos aunque haya millones de puntos.
 *
 * Un viaje aparece acá cuando su resumen está calculado, es decir, cuando el
 * viaje se cerró. Los viajes en curso no son parte de las tendencias.
 */

const API = 'http://localhost:3000/api/v1/informes/reportes';

type Pestana = 'vehiculos' | 'conductores' | 'rutas' | 'paradas-no-declaradas' | 'cadena-frio';

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: 'vehiculos', etiqueta: 'reportes.tab_vehiculos' },
  { id: 'conductores', etiqueta: 'reportes.tab_conductores' },
  { id: 'rutas', etiqueta: 'reportes.tab_rutas' },
  { id: 'paradas-no-declaradas', etiqueta: 'reportes.tab_paradas' },
  { id: 'cadena-frio', etiqueta: 'reportes.tab_frio' },
];

function usarReporte(pestana: Pestana, desde: string, hasta: string) {
  return useQuery<Record<string, unknown>[]>({
    queryKey: ['reporte', pestana, desde, hasta],
    queryFn: async () => {
      const token = localStorage.getItem('rusertech_token');
      const params = new URLSearchParams();
      if (desde) params.set('desde', new Date(desde).toISOString());
      if (hasta) params.set('hasta', new Date(hasta + 'T23:59:59').toISOString());
      const res = await fetch(`${API}/${pestana}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Error al cargar el reporte');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });
}

const hoyMenos = (dias: number) => {
  const d = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
};

/** Presentación de celdas: fechas legibles, números tal cual, null como raya. */
function celda(valor: unknown): string {
  if (valor == null) return '—';
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(valor)) {
    return new Date(valor).toLocaleString();
  }
  return String(valor);
}

export const ReportesPage: React.FC = () => {
  const { t } = useTranslation();
  const [pestana, setPestana] = useState<Pestana>('vehiculos');
  const [desde, setDesde] = useState(hoyMenos(30));
  const [hasta, setHasta] = useState(hoyMenos(0));

  const { data, isLoading, error } = usarReporte(pestana, desde, hasta);

  const columnas = useMemo(() => (data && data.length > 0 ? Object.keys(data[0]) : []), [data]);

  const exportar = () => {
    if (!data || data.length === 0) return;
    exportToCsv(
      `reporte-${pestana}-${desde}-a-${hasta}`,
      columnas,
      data.map((fila) => columnas.map((c) => celda(fila[c]))),
    );
  };

  return (
    <RequirePermission permission="view_analytics" fallback={<SinPermiso permission="view_analytics" />}>
      <div className="p-8 w-full space-y-5">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-display font-black text-white tracking-wider flex items-center gap-3">
              <BarChart3 className="w-7 h-7 text-accentGreen" />
              {t('reportes.title')}
            </h1>
            <p className="text-textMuted mt-1 text-sm">{t('reportes.subtitle')}</p>
          </div>

          <div className="flex items-end gap-3">
            <label className="text-[11px] text-textMuted">
              {t('reportes.desde')}
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
                className="block bg-bgSurface border border-borderDefault rounded-lg px-2 py-1.5 text-xs text-white mt-1" />
            </label>
            <label className="text-[11px] text-textMuted">
              {t('reportes.hasta')}
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
                className="block bg-bgSurface border border-borderDefault rounded-lg px-2 py-1.5 text-xs text-white mt-1" />
            </label>
            <button onClick={exportar} disabled={!data?.length}
              className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-borderDefault text-textSecondary hover:text-white transition-colors disabled:opacity-40">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PESTANAS.map((p) => (
            <button key={p.id} onClick={() => setPestana(p.id)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                pestana === p.id
                  ? 'bg-accentGreen/20 text-accentGreen border-accentGreen/40'
                  : 'text-textMuted border-borderDefault hover:text-white'
              }`}>
              {t(p.etiqueta)}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl">
            {t('reportes.error')}
          </div>
        )}

        {isLoading && <div className="p-8 text-center text-textMuted">{t('reportes.cargando')}</div>}

        {!isLoading && !error && (data?.length ?? 0) === 0 && (
          <div className="p-8 text-center text-textMuted border border-borderDefault rounded-xl text-sm leading-relaxed">
            {t('reportes.vacio')}
          </div>
        )}

        {!isLoading && (data?.length ?? 0) > 0 && (
          <div className="border border-borderDefault rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-bgStart text-[10px] uppercase tracking-wider text-textMuted">
                  <tr>{columnas.map((c) => <th key={c} className="px-4 py-2 whitespace-nowrap">{c.replaceAll('_', ' ')}</th>)}</tr>
                </thead>
                <tbody>
                  {data!.map((fila, i) => (
                    <tr key={i} className="border-t border-borderDefault/50">
                      {columnas.map((c) => (
                        <td key={c} className="px-4 py-2 text-textSecondary whitespace-nowrap">{celda(fila[c])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </RequirePermission>
  );
};
