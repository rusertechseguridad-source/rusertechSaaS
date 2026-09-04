import React, { useState, useEffect } from 'react';
import { X, Settings, Thermometer, Droplets } from 'lucide-react';
import { avisar, escribir, mensajeDeError } from '../../services/avisos';

interface Props {
  vehicleId: string;
  /** Para que el título diga a QUÉ camión se le están poniendo los umbrales. */
  vehicleLabel?: string;
  onClose: () => void;
  /** Se llama después de guardar, para que la pantalla se refresque. */
  onSaved?: () => void;
}

export const SensorConfigModal: React.FC<Props> = ({ vehicleId, vehicleLabel, onClose, onSaved }) => {
  const [, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Si la lectura falla, el formulario muestra los valores por defecto y parece
  // un vehículo sin configurar. Eso es exactamente lo que hace que alguien pise
  // umbrales buenos sin saberlo, así que el error se dice.
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Form states for Temperature
  const [tempMin, setTempMin] = useState<number | ''>('');
  const [tempMax, setTempMax] = useState<number | ''>(8);
  const [tempActive, setTempActive] = useState(true);

  // Form states for Humidity
  const [humMin, setHumMin] = useState<number | ''>('');
  const [humMax, setHumMax] = useState<number | ''>(60);
  const [humActive, setHumActive] = useState(true);

  useEffect(() => {
    loadConfigs();
  }, [vehicleId]);

  const loadConfigs = async () => {
    setLoading(true);
    setErrorCarga(null);
    try {
      const res = await fetch(`http://localhost:3000/api/v1/sensors/config`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` }
      });
      if (!res.ok) {
        setErrorCarga(mensajeDeError(res.status, await res.json().catch(() => null)));
      } else {
        const data = await res.json();
        // La columna es `scope_id`, no `vehicle_id`: con el nombre viejo este
        // filtro devolvía SIEMPRE un arreglo vacío, así que el formulario
        // mostraba siempre los valores por defecto aunque hubiera umbrales
        // guardados. El operador creía que no se habían guardado.
        const vehicleConfigs = data.filter(
          (c: any) => c.scope_id === vehicleId && (c.scope_type ?? 'vehicle') === 'vehicle',
        );
        setConfigs(vehicleConfigs);
        
        // ⚠️ SEGUNDA MITAD DEL MISMO HALLAZGO. Arreglar el filtro no alcanzaba:
        // las columnas de `sensor_configs` son `value_min` / `value_max`
        // (verificado en el esquema, `Decimal(8,2)` y NOT NULL), pero acá se
        // leía `min_value` / `max_value`. Con el filtro corregido el registro
        // ya se encontraba, pero los dos campos daban `undefined` y el
        // formulario seguía mostrando los valores por defecto. O sea: el
        // operador abría un vehículo YA configurado a -5/8 y veía en blanco/8,
        // y si guardaba, pisaba los umbrales buenos con los de la pantalla.
        //
        // Llegan como string porque Prisma serializa `Decimal` así; `numero()`
        // los convierte y deja '' sólo cuando de verdad no hay valor.
        const numero = (v: any): number | '' =>
          v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '' : Number(v);

        const tc = vehicleConfigs.find((c: any) => c.sensor_type === 'temperature');
        if (tc) {
          setTempMin(numero(tc.value_min));
          setTempMax(numero(tc.value_max));
          setTempActive(tc.is_active);
        }

        const hc = vehicleConfigs.find((c: any) => c.sensor_type === 'humidity');
        if (hc) {
          setHumMin(numero(hc.value_min));
          setHumMax(numero(hc.value_max));
          setHumActive(hc.is_active);
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[SensorConfigModal] no se pudieron leer los umbrales:', e);
      setErrorCarga('No se pudo conectar con el servidor. Revisá tu conexión.');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    // ⚠️ CADENA DE FRÍO. Este modal mandaba `vehicle_id` y el servicio lee
    // `scope_id`. En Prisma un `undefined` dentro del `where` SE OMITE, así que
    // el `findFirst` matcheaba la configuración de CUALQUIER vehículo del
    // tenant y le escribía los umbrales encima. Umbrales en el camión
    // equivocado son excursiones de temperatura reales que no disparan alarma
    // en el camión que las tiene.
    //
    // Y la pantalla decía que había guardado: no se miraba la respuesta y el
    // modal se cerraba igual.
    //
    // ⚠️ Los dos umbrales son OBLIGATORIOS. `value_min` y `value_max` son NOT
    // NULL en `sensor_configs`; mandar `null` hacía que el alta guardara 0 y 0
    // —un rango imposible que dispara alarma siempre— y que la edición fallara
    // con un error de Prisma. Se corta acá, con el motivo en pantalla, en vez
    // de dejar que el backend devuelva algo que el operador no puede accionar.
    const rangoInvalido = (etiqueta: string, min: number | '', max: number | '') => {
      if (min === '' || max === '') return `Completá el mínimo y el máximo de ${etiqueta}.`;
      if (Number(min) > Number(max)) return `En ${etiqueta} el mínimo no puede ser mayor que el máximo.`;
      return null;
    };

    // Qué se va a guardar: el sensor activo, o el que tenga algo escrito
    // aunque esté desactivado (desactivar no borra el rango). Lo que no se va
    // a guardar tampoco se valida — si nunca se configuró la humedad, exigirla
    // impediría guardar sólo la temperatura, que es el caso normal.
    const vaTemperatura = tempActive || tempMin !== '' || tempMax !== '';
    const vaHumedad = humActive || humMin !== '' || humMax !== '';

    if (!vaTemperatura && !vaHumedad) {
      avisar.error('No hay nada que guardar: completá al menos un rango.');
      return;
    }

    const problema =
      (vaTemperatura ? rangoInvalido('Temperatura', tempMin, tempMax) : null) ??
      (vaHumedad ? rangoInvalido('Humedad', humMin, humMax) : null);
    if (problema) {
      avisar.error(problema);
      return;
    }

    const guardarUmbral = (sensor_type: string, min: number | '', max: number | '', activo: boolean) =>
      escribir(
        () => fetch('http://localhost:3000/api/v1/sensors/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('rusertech_token')}`,
          },
          body: JSON.stringify({
            scope_type: 'vehicle',
            scope_id: vehicleId,
            sensor_type,
            // Los nombres de las columnas, no los invertidos. El servicio
            // todavía acepta los dos (`value_min ?? min_value`), pero mandar el
            // alias hacía que la rama de edición escribiera `undefined ?? null`
            // = null sobre una columna NOT NULL.
            value_min: min === '' ? null : Number(min),
            value_max: max === '' ? null : Number(max),
            is_active: activo,
          }),
        }),
        null, // el aviso lo damos una sola vez al final, no uno por sensor
      );

    if (vaTemperatura) {
      const temperatura = await guardarUmbral('temperature', tempMin, tempMax, tempActive);
      if (!temperatura.ok) return;
    }

    if (vaHumedad) {
      const humedad = await guardarUmbral('humidity', humMin, humMax, humActive);
      if (!humedad.ok) return;
    }

    avisar.exito('Umbrales de sensores guardados.');
    onSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-bgOverlay z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-bgSurface border border-borderDefault rounded-xl w-full max-w-lg shadow-card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-borderDefault flex justify-between items-center bg-bgStart/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="text-accentBlue" />
            {/* La patente en el título: sin ella no hay forma de saber a qué
                camión se le están escribiendo los umbrales, y este modal se
                abre desde tres lugares distintos. */}
            Configurar Alertas de Sensores{vehicleLabel ? ` · ${vehicleLabel}` : ''}
          </h2>
          <button onClick={onClose} className="text-textMuted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-textMuted">Cargando...</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Si no se pudieron leer los umbrales guardados, el formulario que
                sigue muestra los valores por defecto. Decirlo es la diferencia
                entre "este vehículo no tiene nada configurado" y "no pude
                averiguarlo": en la segunda, guardar pisa lo que ya había. */}
            {errorCarga && (
              <div className="bg-statusDanger/10 border border-statusDanger/30 rounded-lg p-3">
                <p className="text-statusDanger text-sm font-semibold mb-0.5">
                  No se pudieron leer los umbrales guardados
                </p>
                <p className="text-textMuted text-xs mb-2">
                  {errorCarga} Lo que ves abajo son los valores por defecto, no los del vehículo.
                </p>
                <button
                  onClick={loadConfigs}
                  className="text-xs font-bold text-textSecondary hover:text-white underline"
                >
                  Reintentar
                </button>
              </div>
            )}

            {/* Temperatura */}
            <div className="bg-bgStart border border-borderDefault rounded-lg p-4">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-borderDefault">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-statusWarning" /> Temperatura (°C)
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-textMuted">Activo</span>
                  <input type="checkbox" checked={tempActive} onChange={e => setTempActive(e.target.checked)} className="accent-accentBlue" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-textSecondary mb-1">Mínimo</label>
                  <input 
                    type="number" 
                    value={tempMin} 
                    onChange={e => setTempMin(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-bgSurface border border-borderDefault rounded px-3 py-2 text-white focus:outline-none focus:border-accentBlue"
                    placeholder="Ej: -5"
                  />
                </div>
                <div>
                  <label className="block text-xs text-textSecondary mb-1">Máximo</label>
                  <input 
                    type="number" 
                    value={tempMax} 
                    onChange={e => setTempMax(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-bgSurface border border-borderDefault rounded px-3 py-2 text-white focus:outline-none focus:border-accentBlue"
                    placeholder="Ej: 8"
                  />
                </div>
              </div>
            </div>

            {/* Humedad */}
            <div className="bg-bgStart border border-borderDefault rounded-lg p-4">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-borderDefault">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-accentBlue" /> Humedad (%)
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-textMuted">Activo</span>
                  <input type="checkbox" checked={humActive} onChange={e => setHumActive(e.target.checked)} className="accent-accentBlue" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-textSecondary mb-1">Mínimo</label>
                  <input 
                    type="number" 
                    value={humMin} 
                    onChange={e => setHumMin(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-bgSurface border border-borderDefault rounded px-3 py-2 text-white focus:outline-none focus:border-accentBlue"
                    placeholder="Ej: 0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-textSecondary mb-1">Máximo</label>
                  <input 
                    type="number" 
                    value={humMax} 
                    onChange={e => setHumMax(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-bgSurface border border-borderDefault rounded px-3 py-2 text-white focus:outline-none focus:border-accentBlue"
                    placeholder="Ej: 60"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-borderDefault bg-bgStart/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded text-sm text-textMuted hover:text-white transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-accentBlue text-bgStart font-bold rounded text-sm hover:opacity-90 transition-opacity">
            Guardar Rangos
          </button>
        </div>
      </div>
    </div>
  );
};
