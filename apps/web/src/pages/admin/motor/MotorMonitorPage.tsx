import React from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, RefreshCw, AlertTriangle, Radar, X } from 'lucide-react';
import { useSaludMotor, useVehiculosMonitoreados, useDesactivarMonitoreo } from './api';
import { useMotorCatalogos } from '../../../hooks/useMotorCatalogos';
import { RequirePermission, SinPermiso } from '../../../components/RequirePermission';
import { useToastStore } from '../../../store/toastStore';
import { useAhora } from '../../../hooks/useAhora';
import { formatearAntiguedad } from '../../../utils/freshness';

/**
 * MONITOR DEL MOTOR DE EVENTOS.
 *
 * Responde tres preguntas de guardia:
 *   · ¿el motor está al día?
 *   · ¿qué vehículos se están evaluando, y por qué?
 *   · ¿qué condiciones sabe detectar hoy, y cuáles todavía no?
 *
 * Es una pantalla de diagnóstico: prioriza densidad y honestidad sobre estética.
 */

/** Umbrales de atraso, en segundos. */
const ATRASO_ATENCION = 120;
const ATRASO_PROBLEMA = 600;

function colorAtraso(segundos: number | null): string {
  if (segundos === null) return '#2BF4B6';
  if (segundos > ATRASO_PROBLEMA) return '#EF4444';
  if (segundos > ATRASO_ATENCION) return '#F59E0B';
  return '#2BF4B6';
}

function formatearAtraso(segundos: number | null, t: any): string {
  if (segundos === null) return t('motor.al_dia');
  if (segundos < 60) return t('motor.atraso_segundos', { n: segundos });
  if (segundos < 3600) return t('motor.atraso_minutos', { n: Math.floor(segundos / 60) });
  return t('motor.atraso_horas', { n: Math.floor(segundos / 3600) });
}

const MOTIVO_ETIQUETA: Record<string, string> = {
  estado: 'motor.motivo.estado',
  manual: 'motor.motivo.manual',
  red_seguridad: 'motor.motivo.red_seguridad',
};

export const MotorMonitorPage: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const { data: salud, isLoading, error, refetch, isFetching } = useSaludMotor();
  const { data: monitoreados } = useVehiculosMonitoreados();
  const { data: catalogos } = useMotorCatalogos();
  const desactivar = useDesactivarMonitoreo();
  const ahora = useAhora(5_000);

  /*
    El atraso se recalcula con el reloj del cliente a partir del timestamp del
    pendiente más viejo: entre refrescos el número envejece solo. Los segundos
    del servidor quedan como respaldo por si el timestamp no vino.
  */
  const atraso = salud?.pendiente_mas_viejo
    ? Math.max(0, Math.floor((ahora - new Date(salud.pendiente_mas_viejo).getTime()) / 1000))
    : salud?.antiguedad_segundos ?? null;
  const color = colorAtraso(atraso);

  const condicionesPendientes = (catalogos?.tipos_condicion ?? []).filter(
    (c) => c.requiere_datos_faltantes,
  );
  const condicionesListas = (catalogos?.tipos_condicion ?? []).filter(
    (c) => !c.requiere_datos_faltantes,
  );

  const handleDesactivar = async (vehicleId: string) => {
    try {
      await desactivar.mutateAsync(vehicleId);
      addToast(t('motor.desactivado_ok'), 'success');
    } catch {
      addToast(t('motor.desactivado_error'), 'error');
    }
  };

  return (
    <RequirePermission permission="view_settings" fallback={<SinPermiso permission="view_settings" />}>
      <div className="p-8 w-full space-y-6">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-display font-black text-white tracking-wider flex items-center gap-3">
              <Cpu className="w-7 h-7 text-accentGreen" />
              {t('motor.title')}
            </h1>
            <p className="text-textMuted mt-1 text-sm">{t('motor.subtitle')}</p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-1.5 text-[11px] rounded-lg border border-borderDefault text-textMuted hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            {t('motor.refrescar')}
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl">
            {t('motor.error')}
          </div>
        )}

        {/* ── Salud de la cola ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { etiqueta: t('motor.pendientes'), valor: salud?.pendientes ?? 0, color: '#2AB3FF' },
            { etiqueta: t('motor.procesando'), valor: salud?.procesando ?? 0, color: '#8B5CF6' },
            { etiqueta: t('motor.fallidos'), valor: salud?.fallidos ?? 0, color: (salud?.fallidos ?? 0) > 0 ? '#EF4444' : '#6B7280' },
            { etiqueta: t('motor.atraso'), valor: formatearAtraso(atraso, t), color },
          ].map((tarjeta) => (
            <div key={tarjeta.etiqueta} className="bg-bgSurface border border-borderDefault rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-textMuted mb-1">{tarjeta.etiqueta}</div>
              <div className="text-2xl font-display font-bold" style={{ color: tarjeta.color }}>
                {isLoading ? '—' : tarjeta.valor}
              </div>
            </div>
          ))}
        </div>

        {/*
          El atraso es EL indicador. Un número alto puntual después de un
          reinicio es normal; que crezca sostenidamente significa que el motor
          no da abasto.
        */}
        <div className="text-[11px] text-textMuted">{t('motor.nota_atraso')}</div>

        {(salud?.fallidos ?? 0) > 0 && (
          <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-[11px] text-textSecondary">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{t('motor.nota_fallidos', { n: salud?.fallidos ?? 0 })}</span>
          </div>
        )}

        {/* ── Vehículos bajo monitoreo ────────────────────────────────────── */}
        <div className="bg-bgSurface border border-borderDefault rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-borderDefault flex items-center gap-2">
            <Radar className="w-4 h-4 text-accentGreen" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {t('motor.monitoreados')}
            </h2>
            <span className="text-[11px] text-textMuted">({monitoreados?.length ?? 0})</span>
          </div>

          {(monitoreados?.length ?? 0) === 0 ? (
            <div className="p-6 text-center text-textMuted text-sm">{t('motor.sin_monitoreados')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-bgStart text-[10px] uppercase tracking-wider text-textMuted">
                  <tr>
                    <th className="px-5 py-2">{t('motor.vehiculo')}</th>
                    <th className="px-5 py-2">{t('motor.motivo_titulo')}</th>
                    <th className="px-5 py-2">{t('motor.desde')}</th>
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {(monitoreados ?? []).map((v) => (
                    <tr key={v.vehicle_id} className="border-t border-borderDefault/50">
                      <td className="px-5 py-2 text-white font-bold">{v.plate ?? '--'}</td>
                      <td className="px-5 py-2 text-textSecondary text-xs">
                        {t(MOTIVO_ETIQUETA[v.motivo] ?? 'motor.motivo.estado')}
                      </td>
                      <td className="px-5 py-2 text-textMuted text-xs">
                        {new Date(v.desde).toLocaleString()}{' '}
                        <span className="text-textMuted/70">
                          ({formatearAntiguedad(Math.max(0, Math.floor((ahora - new Date(v.desde).getTime()) / 1000)), t)})
                        </span>
                      </td>
                      <td className="px-5 py-2 text-right">
                        <RequirePermission permission="manage_settings">
                          <button
                            onClick={() => handleDesactivar(v.vehicle_id)}
                            className="text-textMuted hover:text-red-400 transition-colors"
                            title={t('motor.desactivar')}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </RequirePermission>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Qué sabe detectar hoy ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-bgSurface border border-borderDefault rounded-xl p-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              {t('motor.condiciones_catalogo', { n: condicionesListas.length })}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {condicionesListas.map((c) => (
                <span
                  key={c.codigo}
                  title={c.descripcion ?? undefined}
                  className="text-[10px] px-2 py-1 rounded border border-borderDefault text-textSecondary"
                >
                  {c.nombre}
                  {!c.detectable_sin_app && <span className="ml-1 text-accentBlue">·app</span>}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-textMuted mt-3 leading-relaxed">
              {t('motor.nota_sin_app')}
            </p>
          </div>

          {condicionesPendientes.length > 0 && (
            <div className="bg-bgSurface border border-amber-500/20 rounded-xl p-5">
              <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3">
                {t('motor.condiciones_pendientes', { n: condicionesPendientes.length })}
              </h2>
              <ul className="space-y-2">
                {condicionesPendientes.map((c) => (
                  <li key={c.codigo} className="text-[11px] text-textSecondary">
                    <span className="text-white font-bold">{c.nombre}</span>
                    <span className="block text-textMuted">{c.descripcion}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-textMuted mt-3 leading-relaxed">
                {t('motor.nota_pendientes')}
              </p>
            </div>
          )}
        </div>
      </div>
    </RequirePermission>
  );
};
