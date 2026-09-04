import React, { useRef, useState } from 'react';
import { Trash2, Upload, Loader2 } from 'lucide-react';
import { avisar, mensajeDeError } from '../../services/avisos';

interface Props {
  etiqueta: string;
  /** URL guardada, o '' si no hay imagen. */
  url: string;
  /** Se llama con la URL nueva, o con '' al quitar la imagen. */
  onCambiar: (url: string) => void;
  deshabilitado?: boolean;
  /** Motivo, cuando está deshabilitado. */
  motivo?: string;
}

/**
 * UNA FOTO DEL VEHÍCULO: subir, reemplazar y QUITAR.
 *
 * Se extrajo del formulario porque el mismo bloque estaba tres veces (frente,
 * trasera, lateral) y le faltaban las mismas tres cosas a las tres:
 *
 *  1. No se podía quitar una imagen ya cargada. Se podía subir y reemplazar,
 *     pero no volver a "sin foto": una foto equivocada quedaba para siempre.
 *  2. Elegir DOS VECES el mismo archivo no hacía nada. El `<input type=file>`
 *     no dispara `change` si el valor no cambió, así que reintentar después de
 *     un fallo era imposible sin recargar. Se limpia el input al terminar.
 *  3. Un fallo de subida era invisible: `if (res.ok)` sin `else` y un `catch`
 *     con `console.error`. El operador elegía el archivo, no pasaba nada, y no
 *     tenía forma de saber si se había subido o no.
 */
export const CampoImagenVehiculo: React.FC<Props> = ({
  etiqueta, url, onCambiar, deshabilitado, motivo,
}) => {
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const subir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    // El input se limpia SIEMPRE, incluso si esto falla, para que se pueda
    // volver a elegir el mismo archivo.
    const limpiar = () => { if (inputRef.current) inputRef.current.value = ''; };
    if (!archivo) { limpiar(); return; }

    const cuerpo = new FormData();
    cuerpo.append('file', archivo);
    setSubiendo(true);
    try {
      const res = await fetch('http://localhost:3000/api/v1/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('rusertech_token')}` },
        body: cuerpo,
      });
      if (!res.ok) {
        avisar.error(mensajeDeError(res.status, await res.json().catch(() => null)));
        return;
      }
      const datos = await res.json();
      if (!datos?.url) {
        avisar.error('El servidor aceptó el archivo pero no devolvió su dirección.');
        return;
      }
      onCambiar(datos.url);
      avisar.exito(`Imagen ${etiqueta.toLowerCase()} cargada.`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[CampoImagenVehiculo] fallo al subir:', err);
      avisar.error('No se pudo conectar con el servidor. Revisá tu conexión.');
    } finally {
      setSubiendo(false);
      limpiar();
    }
  };

  const bloqueado = Boolean(deshabilitado) || subiendo;

  return (
    <div>
      <label className="block text-xs text-textSecondary mb-1">{etiqueta}</label>

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={subir}
          disabled={bloqueado}
          title={deshabilitado ? motivo : undefined}
          className="w-full text-xs bg-bgStart border border-borderDefault rounded p-1 text-white focus:outline-none file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-accentGreen/20 file:text-accentGreen file:font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        />
        {subiendo && <Loader2 className="w-4 h-4 animate-spin text-accentBlue shrink-0" />}
      </div>

      {url ? (
        <div className="mt-2">
          <div className="h-20 w-full rounded border border-borderDefault overflow-hidden">
            <img src={url} alt={etiqueta} className="w-full h-full object-cover" />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-textMuted flex items-center gap-1">
              <Upload className="w-3 h-3" /> Elegí otro archivo para reemplazarla
            </span>
            <button
              type="button"
              onClick={() => onCambiar('')}
              disabled={bloqueado}
              title={deshabilitado ? motivo : `Quitar imagen ${etiqueta.toLowerCase()}`}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-statusDanger hover:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3 h-3" /> Quitar
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1.5 text-[10px] text-textMuted">Sin imagen</p>
      )}
    </div>
  );
};
