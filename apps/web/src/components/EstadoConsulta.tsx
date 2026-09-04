import React from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

/**
 * LOS TRES ESTADOS DE UNA CONSULTA, EN UN SOLO COMPONENTE.
 *
 * Por qué existe: cuatro pantallas —Viajes, Vehículos, Ubicaciones y Rutas—
 * guardaban el error en su store y **no lo leían**. Un 403 se veía exactamente
 * igual que una tabla vacía: el operador concluía "no hay datos" cuando lo que
 * pasaba era "no tenés permiso" o "el servidor no respondió".
 *
 * Es el mismo criterio que rige todo el proyecto: una pantalla no puede decir
 * que no hay nada cuando en realidad no pudo preguntar.
 *
 * Devuelve `null` cuando hay datos: la pantalla sigue pintando su tabla.
 */
interface Props {
  cargando: boolean;
  error?: string | null;
  vacio: boolean;
  /** Qué se estaba buscando: "viajes", "vehículos"… */
  entidad: string;
  /** Para que el operador pueda reintentar sin recargar la página. */
  onReintentar?: () => void;
  /** Mensaje propio para el caso vacío, si "No hay X" no alcanza. */
  mensajeVacio?: string;
}

export const EstadoConsulta: React.FC<Props> = ({
  cargando, error, vacio, entidad, onReintentar, mensajeVacio,
}) => {
  // El orden importa: el ERROR gana sobre el vacío. Una consulta que falló
  // devuelve una lista vacía, y mostrar "no hay datos" sería la mentira.
  if (error) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-8 h-8 text-statusDanger mx-auto mb-3" />
        <p className="text-statusDanger font-semibold mb-1">
          No se pudieron cargar los {entidad}
        </p>
        <p className="text-textMuted text-sm max-w-md mx-auto">{error}</p>
        {onReintentar && (
          <button
            onClick={onReintentar}
            className="mt-4 px-4 py-2 bg-bgSurfaceHigh hover:bg-bgSurface text-textPrimary text-sm font-medium rounded-lg border border-borderDefault transition-colors"
          >
            Reintentar
          </button>
        )}
      </div>
    );
  }

  if (cargando) {
    return (
      <div className="p-8 text-center text-textMuted">
        <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-accentBlue" />
        Cargando {entidad}…
      </div>
    );
  }

  if (vacio) {
    return (
      <div className="p-8 text-center text-textMuted">
        <Inbox className="w-8 h-8 mx-auto mb-3 opacity-50" />
        {mensajeVacio ?? `No hay ${entidad} para mostrar.`}
      </div>
    );
  }

  return null;
};
