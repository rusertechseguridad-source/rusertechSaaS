import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Activity, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, BookOpen } from 'lucide-react';
import { useAvlMonitor, useAvlMonitorVehiculos } from './api';
import type { CodigoIngesta, EstadoIngesta, ResumenAvlUser } from './types';
import { VENTANAS_HORAS } from './types';
import { RequirePermission, SinPermiso } from '../../../components/RequirePermission';
import { COLOR_SIN_DATOS, FRESCURA_COLORS } from '../../../constants/freshness';
import i18n from '../../../i18n/config';
import esLocales from './locales/es.json';
import enLocales from './locales/en.json';

i18n.addResourceBundle('es', 'translation', { avlMonitor: esLocales }, true, true);
i18n.addResourceBundle('en', 'translation', { avlMonitor: enLocales }, true, true);

/**
 * MONITOR DE INGESTA AVL.
 *
 * Responde "¿está entrando la telemetría, y qué está entrando?". Es una
 * pantalla de diagnóstico: prioriza densidad de información y honestidad sobre
 * estética. Cuando el mapa está vacío, acá se ve si el problema es que el
 * proveedor dejó de enviar o que estamos recibiendo códigos que no sabemos leer.
 *
 * Todo lo que muestra sale de una consulta a `telemetry` con rango cerrado; no
 * depende de Redis ni de ningún contador acumulado que pueda desincronizarse.
 */

/**
 * Colores por estado. Los tres de frescura se reutilizan del vocabulario común
 * a propósito: "recibiendo" tiene que ser el mismo verde que "en vivo" en el
 * mapa. Los dos que agrega esta pantalla son estados que el mapa no tiene.
 */
const COLOR_ESTADO: Record<EstadoIngesta, string> = {
  ...FRESCURA_COLORS,
  // Rojo y no gris: un proveedor sin ningún dato en la ventana es una falla que
  // hay que atender, no un vehículo apagado.
  sin_datos: '#EF4444',
  inactivo_config: COLOR_SIN_DATOS,
};

/**
 * Antigüedad del último dato.
 *
 * El estado vacío nombra la ventana consultada (`horas`) en lugar de decir
 * "nunca": esta pantalla mira un rango acotado, así que no puede afirmar nada
 * sobre toda la historia del proveedor. Decir "nunca" cuando en realidad es
 * "no en las últimas 24 h" es una afirmación falsa.
 */
function formatearAntiguedad(segundos: number | null, t: any, horas: number): string {
  if (segundos === null || segundos === undefined) {
    return t('avlMonitor.cells.no_data_window', { h: horas });
  }
  if (segundos < 60) return t('avlMonitor.ago.seconds', { n: segundos });
  if (segundos < 3600) return t('avlMonitor.ago.minutes', { n: Math.floor(segundos / 60) });
  if (segundos < 86400) return t('avlMonitor.ago.hours', { n: Math.floor(segundos / 3600) });
  return t('avlMonitor.ago.days', { n: Math.floor(segundos / 86400) });
}

const ChipEstado: React.FC<{ estado: EstadoIngesta }> = ({ estado }) => {
  const { t } = useTranslation();
  const color = COLOR_ESTADO[estado];
  return (
    <span
      className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border whitespace-nowrap"
      style={{ background: `${color}22`, color, borderColor: `${color}55` }}
    >
      {t(`avlMonitor.estado.${estado}`)}
    </span>
  );
};

/**
 * Los códigos se agrupan por cómo hay que tratarlos, no por frecuencia: los
 * "sin diccionario" son los únicos que exigen una acción, así que van primero.
 */
const BloqueCodigos: React.FC<{ proveedor: ResumenAvlUser }> = ({ proveedor }) => {
  const { t } = useTranslation();

  if (proveedor.codigos.length === 0) {
    return <div className="text-xs text-textMuted py-2">{t('avlMonitor.codes.empty')}</div>;
  }

  const desconocidos = proveedor.codigos.filter((c) => !c.reconocido && !c.origen_movil);
  const moviles = proveedor.codigos.filter((c) => c.origen_movil);
  const reconocidos = proveedor.codigos.filter((c) => c.reconocido && !c.origen_movil);

  const grupos: { titulo: string; color: string; items: CodigoIngesta[] }[] = [
    { titulo: t('avlMonitor.codes.unknown'), color: '#EF4444', items: desconocidos },
    { titulo: t('avlMonitor.codes.mobile'), color: '#2AB3FF', items: moviles },
    { titulo: t('avlMonitor.codes.recognized'), color: '#2BF4B6', items: reconocidos },
  ];

  return (
    <div className="space-y-3">
      {grupos
        .filter((g) => g.items.length > 0)
        .map((grupo) => (
          <div key={grupo.titulo}>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: grupo.color }}>
              {grupo.titulo} ({grupo.items.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {grupo.items.map((c) => (
                <span
                  key={c.provider_code}
                  title={t('avlMonitor.codes.count', { n: c.cantidad })}
                  className="text-[11px] px-2 py-1 rounded border font-mono"
                  style={{ background: `${grupo.color}14`, color: grupo.color, borderColor: `${grupo.color}44` }}
                >
                  {c.provider_code}
                  <span className="ml-1.5 opacity-70">{c.cantidad}</span>
                </span>
              ))}
            </div>
          </div>
        ))}

      {desconocidos.length > 0 && (
        <div className="flex items-start gap-2 text-[11px] text-textMuted bg-red-500/5 border border-red-500/20 rounded-lg p-3">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-400" />
          <div>
            <div>{t('avlMonitor.codes.unknown_help')}</div>
            <Link
              to={`/avl/${proveedor.id}/dictionary`}
              className="inline-flex items-center gap-1 mt-2 text-accentBlue hover:underline font-bold"
            >
              <BookOpen className="w-3 h-3" /> {t('avlMonitor.codes.open_dictionary')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

/** Detalle por vehículo. Se monta sólo cuando la fila está abierta. */
const BloqueVehiculos: React.FC<{ avlUserId: string; horas: number }> = ({ avlUserId, horas }) => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useAvlMonitorVehiculos(avlUserId, horas);

  if (isLoading) return <div className="text-xs text-textMuted py-2">{t('avlMonitor.vehicles.loading')}</div>;
  if (error) return <div className="text-xs text-statusDanger py-2">{t('avlMonitor.vehicles.error')}</div>;
  if (!data || data.vehiculos.length === 0) {
    return <div className="text-xs text-textMuted py-2">{t('avlMonitor.vehicles.empty')}</div>;
  }

  return (
    <div className="overflow-x-auto border border-borderDefault rounded-lg">
      <table className="w-full text-left text-xs">
        <thead className="bg-bgStart text-[10px] uppercase tracking-wider text-textMuted">
          <tr>
            <th className="px-3 py-2">{t('avlMonitor.vehicles.plate')}</th>
            <th className="px-3 py-2 text-right">{t('avlMonitor.vehicles.points')}</th>
            <th className="px-3 py-2">{t('avlMonitor.vehicles.last_point')}</th>
            <th className="px-3 py-2">{t('avlMonitor.vehicles.state')}</th>
          </tr>
        </thead>
        <tbody>
          {data.vehiculos.map((v) => (
            <tr key={v.vehicle_id} className="border-t border-borderDefault/50">
              <td className="px-3 py-2">
                <div className="text-white font-bold">{v.plate ?? '--'}</div>
                {v.alias && <div className="text-[10px] text-textMuted">{v.alias}</div>}
              </td>
              <td className="px-3 py-2 text-right font-mono text-white">{v.puntos}</td>
              <td className="px-3 py-2 text-textSecondary">
                {v.puntos === 0
                  ? t('avlMonitor.cells.no_data_window', { h: horas })
                  : formatearAntiguedad(v.age_seconds, t, horas)}
              </td>
              <td className="px-3 py-2">
                <ChipEstado estado={v.puntos === 0 ? 'sin_datos' : v.estado} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const AvlMonitorPage: React.FC = () => {
  const { t } = useTranslation();
  const [horas, setHoras] = useState<number>(24);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [verVehiculos, setVerVehiculos] = useState<Record<string, boolean>>({});

  const { data, isLoading, error, refetch, isFetching } = useAvlMonitor(horas);

  const toggleFila = (id: string) => setAbierto((prev) => (prev === id ? null : id));

  return (
    <RequirePermission permission="view_avl" fallback={<SinPermiso permission="view_avl" />}>
      <div className="p-8 w-full">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-display font-black text-white tracking-wider flex items-center gap-3">
              <Activity className="w-7 h-7 text-accentGreen" />
              {t('avlMonitor.title')}
            </h1>
            <p className="text-textMuted mt-1 text-sm">{t('avlMonitor.subtitle')}</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] uppercase tracking-wider text-textMuted">
              {t('avlMonitor.window_label')}
            </span>
            <div className="flex gap-1">
              {VENTANAS_HORAS.map((h) => (
                <button
                  key={h}
                  onClick={() => setHoras(h)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors ${
                    horas === h
                      ? 'bg-accentGreen/20 text-accentGreen border-accentGreen/40'
                      : 'bg-transparent text-textMuted border-borderDefault hover:text-white'
                  }`}
                >
                  {t('avlMonitor.window_hours', { n: h })}
                </button>
              ))}
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-3 py-1.5 text-[11px] rounded-lg border border-borderDefault text-textMuted hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              {t('avlMonitor.refresh')}
            </button>
          </div>
        </div>

        {/* Los umbrales se explicitan: sin esto "Demorado" es una palabra sin unidad. */}
        {data && (
          <div className="text-[11px] text-textMuted mb-4">
            {t('avlMonitor.thresholds_note', {
              live: data.umbral_en_vivo_minutos,
              idle: data.umbral_inactivo_minutos,
            })}
          </div>
        )}

        {isLoading && <div className="p-8 text-center text-textMuted">{t('avlMonitor.loading')}</div>}
        {error && <div className="p-8 text-center text-statusDanger">{t('avlMonitor.error')}</div>}

        {data && data.proveedores.length === 0 && (
          <div className="p-8 text-center text-textMuted border border-borderDefault rounded-xl">
            {t('avlMonitor.empty')}
          </div>
        )}

        {data && data.proveedores.length > 0 && (
          <div className="border border-borderDefault rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-bgStart text-[10px] uppercase tracking-wider text-textMuted">
                  <tr>
                    <th className="px-4 py-3 w-8" />
                    <th className="px-4 py-3">{t('avlMonitor.columns.provider')}</th>
                    <th className="px-4 py-3">{t('avlMonitor.columns.state')}</th>
                    <th className="px-4 py-3">{t('avlMonitor.columns.last_point')}</th>
                    <th className="px-4 py-3 text-right">{t('avlMonitor.columns.points')}</th>
                    <th className="px-4 py-3">{t('avlMonitor.columns.vehicles')}</th>
                    <th className="px-4 py-3">{t('avlMonitor.columns.codes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.proveedores.map((p) => {
                    const expandido = abierto === p.id;
                    return (
                      <React.Fragment key={p.id}>
                        <tr
                          onClick={() => toggleFila(p.id)}
                          className="border-t border-borderDefault/50 hover:bg-bgStart/40 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 text-textMuted">
                            {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-white font-bold">{p.name}</div>
                            <div className="text-[10px] text-textMuted font-mono">
                              {p.user_avl_code}
                              {p.provider_name ? ` · ${p.provider_name}` : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3"><ChipEstado estado={p.estado} /></td>
                          <td className="px-4 py-3 text-textSecondary text-xs">
                            {formatearAntiguedad(p.age_seconds, t, horas)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="font-mono text-white">{p.puntos}</div>
                            {p.puntos_movil > 0 && (
                              <div className="text-[10px] text-accentBlue">
                                {t('avlMonitor.cells.of_mobile', { n: p.puntos_movil })}
                              </div>
                            )}
                            {p.duplicados > 0 && (
                              <div className="text-[10px] text-textMuted">
                                {t('avlMonitor.cells.duplicates', { n: p.duplicados })}
                              </div>
                            )}
                          </td>
                          {/*
                            Dos números independientes, no un cociente: se
                            cuentan por caminos distintos (uno por el
                            `avl_user_id` de cada punto, otro por la asignación
                            del vehículo) y presentarlos como "N de M" afirmaría
                            una relación de subconjunto que no está garantizada.
                          */}
                          <td className="px-4 py-3 text-xs">
                            <div className="text-textSecondary">
                              {t('avlMonitor.cells.reporting', { n: p.vehiculos_reportando })}
                            </div>
                            <div className="text-[10px] text-textMuted">
                              {t('avlMonitor.cells.assigned', { n: p.vehiculos_asignados })}
                            </div>
                            {p.vehiculos_reportando > p.vehiculos_asignados && (
                              <div
                                className="text-[10px] text-amber-400 font-bold mt-0.5"
                                title={t('avlMonitor.cells.mismatch_help')}
                              >
                                {t('avlMonitor.cells.mismatch')}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <div className="text-textSecondary">
                              {t('avlMonitor.cells.codes_total', { n: p.codigos.length })}
                            </div>
                            {p.codigos_desconocidos > 0 && (
                              <div className="text-red-400 font-bold">
                                {t('avlMonitor.cells.codes_unknown', { n: p.codigos_desconocidos })}
                              </div>
                            )}
                          </td>
                        </tr>

                        {expandido && (
                          <tr className="border-t border-borderDefault/50 bg-bgStart/30">
                            <td colSpan={7} className="px-4 py-5">
                              <div className="space-y-5">
                                <div>
                                  <div className="text-[11px] font-bold text-textSecondary uppercase tracking-wider mb-2">
                                    {t('avlMonitor.codes.title')}
                                  </div>
                                  <BloqueCodigos proveedor={p} />
                                </div>

                                <div>
                                  <button
                                    onClick={() =>
                                      setVerVehiculos((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                                    }
                                    className="text-[11px] font-bold text-accentBlue hover:underline"
                                  >
                                    {verVehiculos[p.id]
                                      ? t('avlMonitor.vehicles.hide')
                                      : t('avlMonitor.vehicles.show')}
                                  </button>
                                  {verVehiculos[p.id] && (
                                    <div className="mt-3">
                                      <BloqueVehiculos avlUserId={p.id} horas={horas} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="text-[10px] text-textMuted text-center mt-4">
          {t('avlMonitor.auto_refresh')}
        </div>
      </div>
    </RequirePermission>
  );
};
