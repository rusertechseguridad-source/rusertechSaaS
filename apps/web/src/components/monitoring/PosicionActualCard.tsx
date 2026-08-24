import React from 'react';
import { useTranslation } from 'react-i18next';
import { Satellite, Smartphone, Radio } from 'lucide-react';
import type { LivePosition } from '../../types/monitoring';
import { FRESCURA_COLORS } from '../../constants/freshness';
import { etiquetaFrescura, formatearMomento } from '../../utils/freshness';
import { useAhora } from '../../hooks/useAhora';

/**
 * POSICIÓN ACTUAL DE UN VEHÍCULO.
 *
 * Muestra la última posición conocida **independientemente de los eventos de
 * viaje**. Son dos capas distintas y confundirlas fue el error que esta tarjeta
 * viene a corregir: un viaje sin `trip_events` no significa que el vehículo no
 * esté reportando, y hasta ahora la pantalla no distinguía una cosa de la otra.
 *
 * Estados de borde, los tres explicados y no silenciosos:
 *  · cargando  → esqueleto
 *  · sin dato  → el vehículo no reportó en la ventana; se dice con esas palabras
 *  · sin vehículo asignado → el viaje todavía no tiene unidad
 */

interface Props {
  posicion: LivePosition | null;
  cargando?: boolean;
  /** `false` cuando el viaje no tiene vehículo asignado todavía. */
  tieneVehiculo?: boolean;
  /** Ventana consultada, para poder decir "sin datos en las últimas N h". */
  ventanaHoras?: number;
}

export const PosicionActualCard: React.FC<Props> = ({
  posicion,
  cargando = false,
  tieneVehiculo = true,
  ventanaHoras,
}) => {
  const { t } = useTranslation();
  // El relativo envejece solo: se recalcula desde el timestamp en cada tick,
  // no queda congelado entre refrescos de datos.
  const ahora = useAhora();

  const Contenedor: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="bg-bgSurface border border-borderDefault rounded-xl p-3 shadow-card shrink-0">
      <h3 className="text-xs font-bold text-accentGreen uppercase tracking-wider mb-2 border-b border-borderDefault pb-1.5 flex items-center gap-2">
        <Satellite className="w-3.5 h-3.5" />
        {t('livePosition.title')}
      </h3>
      {children}
    </div>
  );

  if (cargando) {
    return (
      <Contenedor>
        <div className="h-16 bg-bgSurfaceHigh/60 rounded animate-pulse" />
      </Contenedor>
    );
  }

  if (!tieneVehiculo) {
    return (
      <Contenedor>
        <p className="text-[11px] text-textMuted leading-relaxed">
          {t('livePosition.no_vehicle')}
        </p>
      </Contenedor>
    );
  }

  if (!posicion) {
    return (
      <Contenedor>
        <p className="text-[11px] text-textMuted leading-relaxed">
          {ventanaHoras
            ? t('livePosition.no_data_window', { h: ventanaHoras })
            : t('livePosition.no_data')}
        </p>
      </Contenedor>
    );
  }

  const color = FRESCURA_COLORS[posicion.freshness];
  const IconoOrigen = posicion.origen === 'movil' ? Smartphone : Radio;

  return (
    <Contenedor>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="text-white font-bold text-sm truncate">
            {posicion.plate ?? '--'}
          </div>
          <div className="text-[10px] text-textMuted flex items-center gap-1 mt-0.5">
            <IconoOrigen className="w-3 h-3" />
            {t(`livePosition.origin.${posicion.origen}`)}
          </div>
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border whitespace-nowrap flex-shrink-0"
          style={{ background: `${color}22`, color, borderColor: `${color}55` }}
        >
          {etiquetaFrescura(posicion.freshness, t)}
        </span>
      </div>

      {/*
        Fecha y hora absolutas + tiempo transcurrido. El absoluto es lo que el
        operador anota o cruza con otro registro; el relativo le dice si está
        fresco. Ninguno reemplaza al otro.
      */}
      <div className="text-[10px] text-textMuted mb-2">
        {t('livePosition.last_report')}:{' '}
        <span style={{ color }} className="font-bold">
          {formatearMomento(posicion.timestamp, t, ahora)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <span className="text-textMuted">{t('map.speed')}</span>
        <span className="text-white font-mono text-right">
          {posicion.speed_kmh != null ? `${Math.round(posicion.speed_kmh)} km/h` : '--'}
        </span>
        <span className="text-textMuted">{t('map.temperature')}</span>
        <span className="text-white font-mono text-right">
          {posicion.temperature_c != null ? `${posicion.temperature_c} °C` : '--'}
        </span>
        <span className="text-textMuted">{t('livePosition.coordinates')}</span>
        <span className="text-textSecondary font-mono text-[10px] text-right">
          {posicion.latitude.toFixed(4)}, {posicion.longitude.toFixed(4)}
        </span>
      </div>
    </Contenedor>
  );
};
