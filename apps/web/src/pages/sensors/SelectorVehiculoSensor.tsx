import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, Truck, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EstadoConsulta } from '../../components/EstadoConsulta';
import { API_URL } from '../../services/api';

interface Props {
  /** Ids de los vehículos que YA tienen al menos un sensor configurado. */
  yaConfigurados: Set<string>;
  onElegir: (vehiculo: { id: string; plate: string; alias?: string | null }) => void;
  onClose: () => void;
}

/**
 * Elegir a qué vehículo se le configura el primer sensor.
 *
 * Por qué existe: el tablero de sensores se arma desde `sensor_configs`. Con la
 * tabla vacía el backend devuelve `[]`, la pantalla quedaba en el mensaje de
 * "no se encontraron sensores" y NO había ninguna forma de crear el primero:
 * el modal de umbrales sólo se abría desde una fila que ya existiera. Una
 * pantalla que sólo se puede usar si ya está usada es una puerta cerrada desde
 * afuera.
 *
 * La lista sale de `/vehicles`, que ya está filtrada por tenant y por las
 * restricciones del usuario en el backend: acá no se decide quién ve qué.
 */
export const SelectorVehiculoSensor: React.FC<Props> = ({ yaConfigurados, onElegir, onClose }) => {
  const { t } = useTranslation();
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/vehicles`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` },
      });
      if (!res.ok) throw new Error(t('sensors.vehicles_error'));
      const datos = await res.json();
      setVehiculos(Array.isArray(datos) ? datos : (datos?.data ?? []));
    } catch (e: any) {
      // El error se MUESTRA. Un catch mudo acá deja una lista vacía que se lee
      // como "no tenés vehículos", que es otra cosa completamente distinta.
      setError(e?.message || t('sensors.vehicles_error'));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return vehiculos;
    return vehiculos.filter((v) =>
      (v.plate ?? '').toLowerCase().includes(termino) ||
      (v.alias ?? '').toLowerCase().includes(termino),
    );
  }, [vehiculos, busqueda]);

  return (
    <div className="fixed inset-0 bg-bgOverlay z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-lg shadow-card flex flex-col overflow-hidden max-h-[85vh]">
        <div className="p-4 border-b border-borderDefault flex justify-between items-center bg-bgStart/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Truck className="text-accentBlue w-5 h-5" />
            {t('sensors.pick_vehicle')}
          </h2>
          <button onClick={onClose} className="text-textMuted hover:text-white transition-colors" title={t('sensors.close')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-borderDefault">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted w-4 h-4" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={t('sensors.search_placeholder')}
              className="w-full bg-bgStart border border-borderDefault rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-accentBlue"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {(cargando || error || filtrados.length === 0) ? (
            <EstadoConsulta
              cargando={cargando}
              error={error}
              vacio={filtrados.length === 0}
              entidad="vehículos"
              onReintentar={cargar}
            />
          ) : (
            <ul className="divide-y divide-borderDefault">
              {filtrados.map((v) => {
                const configurado = yaConfigurados.has(v.id);
                return (
                  <li key={v.id}>
                    <button
                      onClick={() => onElegir(v)}
                      className="w-full text-left px-4 py-3 hover:bg-bgSurfaceHigh/50 transition-colors flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0">
                        <span className="block font-bold text-white truncate">{v.plate}</span>
                        <span className="block text-xs text-textMuted truncate">
                          {v.alias || t('sensors.no_alias')}
                          {v.carrier?.name ? ` · ${v.carrier.name}` : ''}
                        </span>
                      </span>
                      {configurado && (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-accentGreen bg-accentGreen/10 border border-accentGreen/20 px-2 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          {t('sensors.already_configured')}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
