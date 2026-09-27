import { ArrowUpCircle, CheckCircle2, Clock, MessageSquare } from 'lucide-react';
import type { Entrada } from '../../store/bitacoraStore';
import { fechaHora } from '../../services/fechas';

/**
 * EL HILO — lo que se hizo, en orden, con hora y nombre.
 *
 * ⚠️ ES LA RESPUESTA A «¿POR QUÉ NADIE HIZO NADA DURANTE CUARENTA MINUTOS?».
 * Por eso se muestran TODAS las entradas y no sólo la última: la llamada que
 * no atendieron es la que explica la demora, y si se pisara con la siguiente
 * el hilo diría que se resolvió rápido.
 *
 * ⚠️ NO SÓLO COLOR: cada clase de entrada lleva su ícono y su palabra. El
 * rojo es el 8% de los varones, y una bitácora que se lee mal en una auditoría
 * no sirve para lo que existe.
 */
export function HiloBitacora({ entradas }: { entradas: Entrada[] }) {
  if (entradas.length === 0) {
    return (
      <p className="text-textMuted text-sm text-center py-6">
        Todavía no hay entradas. La primera queda al registrar lo que hiciste.
      </p>
    );
  }

  return (
    <ol className="space-y-3" aria-label="Bitácora de atención">
      {entradas.map((e) => (
        <li key={e.id} className="flex gap-3">
          <Icono accion={e.accion} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-textPrimary text-sm font-medium">
                {e.usuario_nombre ?? 'usuario eliminado'}
              </span>
              {/* ⚠️ 24 horas. Una entrada de bitácora con la hora ambigua es
                  una bitácora que no sirve para lo que existe: contestar qué
                  se hizo y cuándo. */}
              <span className="text-textMuted text-xs">{fechaHora(e.created_at)}</span>
              <Etiqueta accion={e.accion} />
            </div>

            {e.paso_accion && (
              <p className="text-textSecondary text-sm">{e.paso_accion}</p>
            )}

            {e.resultado_nombre && (
              <p className="text-accentMint text-sm">
                Resultado: {e.resultado_nombre}
              </p>
            )}
            {/* Si el catálogo cambió y el nombre ya no está, se muestra el
                código: ver `NO_RESPONDE` es feo, una etiqueta inventada es
                peligrosa. */}
            {!e.resultado_nombre && e.resultado_codigo && (
              <p className="text-accentMint text-sm">Resultado: {e.resultado_codigo}</p>
            )}

            {e.escalado_a_nombre && (
              <p className="text-statusWarning text-sm">
                Escalada a {e.escalado_a_nombre}
              </p>
            )}

            {/* `break-words` porque una nota larga no puede romper la caja. */}
            {e.nota && (
              <p className="text-textSecondary text-sm bg-bgStart/60 rounded-md px-2 py-1 mt-1 break-words whitespace-pre-wrap">
                {e.nota}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Icono({ accion }: { accion: Entrada['accion'] }) {
  const comun = 'w-4 h-4 shrink-0 mt-1';
  if (accion === 'escalada') return <ArrowUpCircle className={`${comun} text-statusWarning`} aria-hidden="true" />;
  if (accion === 'cierre') return <CheckCircle2 className={`${comun} text-accentMint`} aria-hidden="true" />;
  return <MessageSquare className={`${comun} text-accentBlue`} aria-hidden="true" />;
}

function Etiqueta({ accion }: { accion: Entrada['accion'] }) {
  const texto = accion === 'escalada' ? 'escalada' : accion === 'cierre' ? 'cierre' : 'registro';
  const color =
    accion === 'escalada'
      ? 'text-statusWarning border-borderWarning'
      : accion === 'cierre'
        ? 'text-accentMint border-borderAccent'
        : 'text-textMuted border-borderDefault';
  return (
    <span className={`text-[0.65rem] uppercase tracking-wide border rounded px-1.5 py-0.5 ${color}`}>
      {texto}
    </span>
  );
}

/** El tiempo que lleva abierta, para el encabezado del modal. */
export function DesdeQueOcurrio({ desde }: { desde: string }) {
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 60000));
  return (
    <span className="flex items-center gap-1 text-textMuted text-xs">
      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
      {minutos < 60 ? `${minutos} min sin resolver` : `${Math.floor(minutos / 60)} h sin resolver`}
    </span>
  );
}
