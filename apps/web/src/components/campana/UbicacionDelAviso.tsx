import { ExternalLink, MapPin } from 'lucide-react';
import type { Aviso } from '../../store/campanaStore';
import { desde, fechaHora } from '../../services/fechas';

type ConUbicacion = Pick<Aviso, 'latitud' | 'longitud' | 'ubicacion_at' | 'lugar' | 'direccion'>;

/**
 * DÓNDE ESTABA EL VEHÍCULO, Y CUÁNDO.
 *
 * ⚠️ UN SOLO COMPONENTE PARA LOS TRES LUGARES: el aviso crítico, la lista de
 * la campana y la ventana de la bitácora. Tres formatos distintos es la forma
 * de que uno se quede atrás — el día que se corrija uno, los otros dos siguen
 * mostrando lo viejo.
 *
 * De lo más útil a lo más crudo:
 *   1. el NOMBRE del lugar guardado o la geocerca que contiene el punto;
 *   2. la dirección que trae el evento, si la trae;
 *   3. las COORDENADAS;
 *   4. y si no hay posición, lo DICE. Un hueco es indistinguible de una
 *      pantalla rota.
 *
 * ⚠️ LA POSICIÓN SIEMPRE VA CON SU HORA. Es la del último punto conocido,
 * no la de ahora: un camión que dejó de reportar hace seis horas tiene una
 * posición de hace seis horas, y mostrarla como actual es peor que no
 * mostrarla. Por eso se lee «dónde estaba» y «cuándo», nunca «dónde está».
 */
export function UbicacionDelAviso({ aviso }: { aviso: ConUbicacion }) {
  const hayPunto = aviso.latitud !== null && aviso.longitud !== null;

  return (
    <div className="flex items-start gap-3 min-w-0" role="group" aria-label="Dónde estaba">
      <MapPin className="w-4 h-4 text-accentMint shrink-0 mt-1" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-textMuted text-xs uppercase tracking-wide">Dónde estaba</p>
        {hayPunto ? (
          <>
            {/* `break-words`: un nombre de lugar largo no puede romper la caja. */}
            <p className="text-textPrimary text-sm break-words">
              {aviso.lugar ?? aviso.direccion ?? coordenadas(aviso.latitud!, aviso.longitud!)}
            </p>
            <p className="text-textMuted text-xs break-words">
              {aviso.ubicacion_at
                ? `Posición del ${fechaHora(aviso.ubicacion_at)} · ${desde(aviso.ubicacion_at)}`
                : 'Posición sin hora registrada'}
              {' · '}
              <a
                href={enlaceAlMapa(aviso.latitud!, aviso.longitud!)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accentBlue hover:underline"
              >
                Abrir en Google Maps
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            </p>
          </>
        ) : (
          <p className="text-textSecondary text-sm">
            Sin posición: este vehículo no tiene un punto registrado.
          </p>
        )}
      </div>
    </div>
  );
}

/** Cinco decimales: alrededor de un metro. Más es ruido del GPS. */
function coordenadas(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** Google Maps, en una pestaña nueva: el operador sigue con la alerta a la vista. */
export function enlaceAlMapa(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}
