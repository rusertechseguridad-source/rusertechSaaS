import { AlertTriangle, Clock, MapPin, Truck, VolumeX } from 'lucide-react';
import type { Aviso } from '../../store/campanaStore';

interface Props {
  aviso: Aviso;
  sonidoActivo: boolean;
  onAtender: () => void;
  onActivarSonido: () => void;
}

/**
 * EL AVISO ROJO — la alerta que no espera a que la busquen.
 *
 * ⚠️ TIENE QUE SENTIRSE URGENTE SIN PARECER UN ERROR DEL SISTEMA. La
 * diferencia está en el contenido, no en el color: un error dice que algo se
 * rompió; esto dice qué pasó, a qué vehículo, cuándo y dónde, y ofrece la
 * única acción que corresponde. Por eso el encabezado lleva el nombre del
 * hecho y no una palabra como «Error» o «Atención».
 *
 * ⚠️ NO SÓLO COLOR. Ícono, texto y borde. El rojo es el 8% de los varones:
 * una pantalla que sólo cambia de color para avisar que algo es grave no le
 * avisa nada a uno de cada doce operadores.
 *
 * ⚠️ `role="alertdialog"` y `aria-live="assertive"`: un lector de pantalla lo
 * anuncia apenas aparece, que es exactamente lo que hace el sonido para quien
 * puede oírlo.
 */
export function AvisoCritico({ aviso, sonidoActivo, onAtender, onActivarSonido }: Props) {
  const cuando = new Date(aviso.ocurrio_at);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-bgOverlay backdrop-blur-sm p-4 pt-20"
      role="alertdialog"
      aria-live="assertive"
      aria-labelledby="aviso-critico-titulo"
    >
      <div className="w-full max-w-lg rounded-xl border-2 border-statusDanger bg-bgSurface shadow-danger overflow-hidden">
        {/* La franja: el color sale del CATÁLOGO, no de una constante del
            código. Si mañana se decide que la activación policial es de otro
            color, se cambia una fila y esto lo respeta. */}
        <div
          className="flex items-center gap-3 px-5 py-3"
          style={{ backgroundColor: aviso.color }}
        >
          <AlertTriangle className="w-6 h-6 text-textOnAccent shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-textOnAccent font-display font-bold text-lg leading-tight truncate">
              {aviso.titulo}
            </p>
            {/* El texto que acompaña al color, para quien no lo distingue. */}
            <p className="text-textOnAccent/80 text-xs uppercase tracking-wide">
              {aviso.clasificado ? 'Alerta crítica' : 'Alerta sin clasificar'}
            </p>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <Dato icono={Truck} etiqueta="Vehículo" valor={aviso.patente ?? 'sin identificar'} />
          <Dato
            icono={Clock}
            etiqueta="Cuándo"
            valor={`${cuando.toLocaleString('es-AR')} · ${desde(cuando)}`}
          />
          <Dato
            icono={MapPin}
            etiqueta="Dónde"
            valor={
              aviso.direccion ??
              (aviso.latitud !== null && aviso.longitud !== null
                ? `${aviso.latitud.toFixed(5)}, ${aviso.longitud.toFixed(5)}`
                : 'sin ubicación en el aviso')
            }
          />

          {aviso.disparador && (
            <p className="text-textMuted text-sm bg-bgStart/60 rounded-lg px-3 py-2 break-words">
              {aviso.disparador}
            </p>
          )}

          {!aviso.clasificado && (
            <p className="text-statusWarning text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              {/* Visible en vez de invisible: el fallo seguro del backend deja
                  pasar lo que no pudo clasificar, y acá se dice por qué. */}
              <span>
                La gravedad de esta alerta no figura en el catálogo de niveles de riesgo.
                Se muestra igual para que no se pierda.
              </span>
            </p>
          )}

          {/* ⚠️ EL BOTÓN DE SONIDO VIVE ACÁ TAMBIÉN. Si el navegador todavía no
              dejó sonar, éste es el momento en que el operador se entera — y
              tiene el gesto a mano para arreglarlo sin buscar nada. */}
          {!sonidoActivo && (
            <button
              type="button"
              onClick={onActivarSonido}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-borderWarning bg-statusWarning/10 px-4 py-2 text-statusWarning text-sm font-medium hover:bg-statusWarning/20"
            >
              <VolumeX className="w-4 h-4" aria-hidden="true" />
              El sonido está apagado — activalo
            </button>
          )}

          <button
            type="button"
            onClick={onAtender}
            autoFocus
            className="w-full rounded-lg bg-gradient-danger px-4 py-3 font-display font-bold text-textPrimary shadow-danger hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-statusDanger focus:ring-offset-2 focus:ring-offset-bgSurface"
          >
            Atender esta alerta
          </button>
          <p className="text-textMuted text-xs text-center">
            Atenderla deja tu nombre registrado y apaga el sonido en todas las pantallas.
          </p>
        </div>
      </div>
    </div>
  );
}

function Dato({
  icono: Icono,
  etiqueta,
  valor,
}: {
  icono: typeof Truck;
  etiqueta: string;
  valor: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icono className="w-4 h-4 text-accentMint shrink-0 mt-1" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-textMuted text-xs uppercase tracking-wide">{etiqueta}</p>
        {/* `break-words` porque una dirección larga no puede romper la caja:
            es el estado de «texto muy largo» que pide la regla de resiliencia. */}
        <p className="text-textPrimary text-sm break-words">{valor}</p>
      </div>
    </div>
  );
}

/** «hace 4 minutos», sin traer una biblioteca de fechas para esto. */
export function desde(fecha: Date): string {
  const minutos = Math.max(0, Math.floor((Date.now() - fecha.getTime()) / 60000));
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} d`;
}
