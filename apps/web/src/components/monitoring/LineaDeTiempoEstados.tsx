import React from 'react';
import { useTranslation } from 'react-i18next';
import { GitBranch, Bot, User } from 'lucide-react';
import { useHistorialViaje } from '../../pages/admin/motor/api';

/**
 * LÍNEA DE TIEMPO DE ESTADOS DEL VIAJE.
 *
 * Responde "¿por qué este viaje cambió de estado?", que hasta ahora sólo se
 * podía contestar mirando la base.
 *
 * Muestra siempre **qué lo disparó**: una geocerca, un operador, la red de
 * seguridad o la app. Una transición automática sin explicación es
 * indistinguible de un error del sistema, y esa duda es la que hace que un
 * operador deje de confiar en la pantalla.
 */

const ICONO_ORIGEN: Record<string, React.ReactNode> = {
  geocerca: <Bot className="w-3 h-3" />,
  motor: <Bot className="w-3 h-3" />,
  red_seguridad: <Bot className="w-3 h-3" />,
  operador: <User className="w-3 h-3" />,
  api_movil: <User className="w-3 h-3" />,
  migracion: <Bot className="w-3 h-3" />,
};

export const LineaDeTiempoEstados: React.FC<{ tripId: string | undefined }> = ({ tripId }) => {
  const { t } = useTranslation();
  const { data: historial, isLoading } = useHistorialViaje(tripId);

  if (!tripId) return null;

  return (
    <div className="bg-bgSurface border border-borderDefault rounded-xl p-3 shadow-card shrink-0">
      <h3 className="text-xs font-bold text-accentGreen uppercase tracking-wider mb-2 border-b border-borderDefault pb-1.5 flex items-center gap-2">
        <GitBranch className="w-3.5 h-3.5" />
        {t('estadosViaje.title')}
      </h3>

      {isLoading && <div className="h-12 bg-bgSurfaceHigh/60 rounded animate-pulse" />}

      {!isLoading && (historial?.length ?? 0) === 0 && (
        /*
          Estado vacío explicado, no en blanco. Un viaje anterior al motor no
          tiene historial, y eso no es una falla: es que nadie lo estaba
          registrando todavía.
        */
        <p className="text-[11px] text-textMuted leading-relaxed">
          {t('estadosViaje.vacio')}
        </p>
      )}

      {!isLoading && (historial?.length ?? 0) > 0 && (
        <ol className="space-y-2.5">
          {(historial ?? []).map((h) => {
            const color = h.color ?? '#6B7280';
            return (
              <li key={h.id} className="flex gap-2.5">
                <span
                  className="mt-1 flex-shrink-0"
                  style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-white font-bold">
                    {h.nombre_nuevo ?? h.estado_nuevo}
                    {h.nombre_anterior && (
                      <span className="text-textMuted font-normal">
                        {' '}← {h.nombre_anterior}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-textMuted flex items-center gap-1 mt-0.5">
                    {ICONO_ORIGEN[h.disparado_por] ?? <Bot className="w-3 h-3" />}
                    <span>{t(`estadosViaje.origen.${h.disparado_por}`, h.disparado_por)}</span>
                    <span>·</span>
                    <span>{new Date(h.created_at).toLocaleString()}</span>
                  </div>
                  {h.causa_detalle && (
                    <div className="text-[10px] text-textSecondary mt-0.5">{h.causa_detalle}</div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
