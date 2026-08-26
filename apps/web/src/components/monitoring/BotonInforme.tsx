import React, { useEffect, useState } from 'react';
import { FileDown, Loader2, RotateCcw } from 'lucide-react';
import { RequirePermission } from '../RequirePermission';
import { abrirInforme, estadoResumen, recalcularResumen, type EstadoResumen } from '../../utils/informes';

/**
 * BOTÓN DEL INFORME DE VIAJE.
 *
 * Regla de esta pantalla (y del producto): el botón NUNCA desaparece por el
 * estado del cálculo — explica. "Calculando…", "falló, reintentar" o listo.
 * Un botón ausente es indistinguible de una función que no existe.
 *
 * Lo único que lo oculta es el permiso (`generate_reports`): emitir el
 * documento que se archiva es una responsabilidad, no una vista.
 */

interface Props {
  tripId: string;
  /** 'completo' = botón con texto (detalle); 'compacto' = ícono (listado). */
  variante?: 'completo' | 'compacto';
}

export const BotonInforme: React.FC<Props> = ({ tripId, variante = 'completo' }) => {
  const [estado, setEstado] = useState<EstadoResumen | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargarEstado = async () => setEstado(await estadoResumen(tripId));

  useEffect(() => {
    if (variante === 'completo') void cargarEstado();
    // El compacto no consulta el estado por adelantado: en un listado de 50
    // viajes serían 50 pedidos para pintar íconos. Consulta al hacer clic.
  }, [tripId, variante]);

  const generar = async () => {
    setOcupado(true);
    const r = await abrirInforme(tripId);
    setOcupado(false);
    if (!r.ok && r.error !== 'sin_permiso') alert(`No se pudo generar el informe (${r.error}).`);
  };

  const reintentar = async () => {
    setOcupado(true);
    await recalcularResumen(tripId);
    // Se re-consulta enseguida: el worker procesa en segundos.
    setTimeout(() => { void cargarEstado(); setOcupado(false); }, 4000);
  };

  if (variante === 'compacto') {
    return (
      <RequirePermission permission="generate_reports">
        <button
          onClick={(e) => { e.stopPropagation(); void generar(); }}
          disabled={ocupado}
          className="p-1.5 rounded text-accentGreen hover:bg-accentGreen/10 transition-colors disabled:opacity-40"
          title="Informe del viaje (PDF)"
        >
          {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
        </button>
      </RequirePermission>
    );
  }

  const calculando = estado?.trabajo === 'pendiente' || estado?.trabajo === 'procesando';
  const fallido = estado?.trabajo === 'fallido';

  return (
    <RequirePermission permission="generate_reports">
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={() => void generar()}
          disabled={ocupado || calculando}
          className="flex items-center gap-2 px-4 py-1.5 bg-accentGreen/15 border border-accentGreen/40 rounded text-accentGreen hover:bg-accentGreen/25 transition-colors text-sm font-bold disabled:opacity-50"
        >
          {ocupado || calculando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          Informe PDF
        </button>
        {calculando && (
          <span className="text-[10px] text-textMuted">El resumen se está calculando…</span>
        )}
        {fallido && (
          <button onClick={() => void reintentar()} className="flex items-center gap-1 text-[10px] text-statusDanger hover:underline"
            title={estado?.trabajo_error ?? undefined}>
            <RotateCcw className="w-3 h-3" /> El cálculo falló — reintentar
          </button>
        )}
        {estado && !estado.tiene_resumen && !calculando && !fallido && (
          <span className="text-[10px] text-textMuted" title="El informe sale igual, con los datos disponibles y una nota.">
            Sin resumen todavía (viaje sin cerrar)
          </span>
        )}
      </div>
    </RequirePermission>
  );
};
