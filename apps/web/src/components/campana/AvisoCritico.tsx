import { AlertTriangle, ChevronDown, Clock, Truck, VolumeX } from 'lucide-react';
import type { Aviso } from '../../store/campanaStore';
import { CapaSuperpuesta } from '../CapaSuperpuesta';
import { UbicacionDelAviso } from './UbicacionDelAviso';
import { desde, fechaHora } from '../../services/fechas';

interface Props {
  aviso: Aviso;
  sonidoActivo: boolean;
  onAtender: () => void;
  onActivarSonido: () => void;
  onMinimizar: () => void;
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
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ SE MINIMIZA. NO SE DESCARTA. Y la diferencia es todo
 * ══════════════════════════════════════════════════════════════════════════
 *
 * El bloqueo medido: con una crítica en pantalla, el administrador no podía
 * llegar a Gestión de Usuarios para otorgar el permiso que hace falta para
 * atenderla. La alerta exigía una acción que ella misma impedía.
 *
 * La salida NO es una X. Una crítica sin atender que se puede hacer
 * desaparecer con un clic es exactamente lo que la bitácora vino a impedir
 * —silenciar sin decir qué se hizo— con un botón en vez de un INSERT.
 *
 * Minimizar corre la superposición y deja una franja fija: la alerta sigue
 * a la vista, el sonido sigue sonando, y «Atender» sigue a un clic. Lo único
 * que se recupera es la pantalla de atrás.
 */
export function AvisoCritico({
  aviso, sonidoActivo, onAtender, onActivarSonido, onMinimizar,
}: Props) {
  const cuando = new Date(aviso.ocurrio_at);

  return (
    // ⚠️ PORTAL — mismo motivo que el modal: el fondo oscurecido tapaba
    // sólo la barra superior y el mapa quedaba nítido detrás de una alerta
    // crítica. Ver `CapaSuperpuesta`.
    <CapaSuperpuesta>
      <div
        className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center bg-bgOverlay backdrop-blur-sm p-4 py-8 overflow-y-auto"
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
            /* ⚠️ 24 horas, explícito. Un incidente de las 20:19 mostrado como
               08:19 hace que el operador le dicte al cliente la hora
               equivocada. Ver `services/fechas.ts`. */
            valor={`${fechaHora(cuando)} · ${desde(cuando)}`}
          />
          {/* ⚠️ El mismo componente que la lista y la bitácora: un formato. */}
          <UbicacionDelAviso aviso={aviso} />

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

          {/* ⚠️ MINIMIZAR, NO DESCARTAR. El texto lo dice para que nadie lo
              confunda con una X: la alerta no se va, se corre. */}
          <button
            type="button"
            onClick={onMinimizar}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-borderDefault px-4 py-2 text-textSecondary text-sm hover:bg-bgSurfaceHigh focus:outline-none focus:ring-1 focus:ring-accentGreen"
          >
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
            Minimizar — sigue sin atender y sigue sonando
          </button>
          </div>
        </div>
      </div>
    </CapaSuperpuesta>
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

/**
 * LA FRANJA — la crítica minimizada.
 *
 * ⚠️ NO TIENE CÓMO DESCARTARSE, y es la mitad del arreglo. Si tuviera una X,
 * minimizar sería otro nombre para silenciar y el operador podría hacer
 * desaparecer una crítica sin dejar constancia — justo lo que la bitácora
 * existe para impedir. Las dos únicas salidas son atenderla o volver a
 * abrirla.
 *
 * ⚠️ `position: fixed` abajo y no arriba: la barra superior tiene la campana,
 * el menú y el usuario, y taparlos dejaría al administrador sin llegar a
 * Gestión de Usuarios — que es el bloqueo que se está corrigiendo.
 *
 * ⚠️ El sonido NO se toca acá. Minimizar es «no me tapes la pantalla», no «no
 * me avises». Silenciar tiene su propio botón, en el panel, y es por usuario.
 */
export function FranjaCritica({
  aviso, cantidad, onAtender, onAmpliar,
}: {
  aviso: Aviso;
  cantidad: number;
  onAtender: () => void;
  onAmpliar: () => void;
}) {
  return (
    // ⚠️ PORTAL. Declarada `bottom-0`, se dibujaba ARRIBA: el borde inferior
    // de la barra superior, no el de la pantalla. Es el mismo bloque
    // contenedor, y en esta se veía de la forma más engañosa — parecía
    // funcionar.
    <CapaSuperpuesta>
      <div
        className="fixed bottom-0 left-0 right-0 z-[55] border-t-2 border-statusDanger bg-bgSurface shadow-danger"
        role="status"
        aria-live="polite"
      >
      <div className="flex items-center gap-3 px-4 py-2.5 max-w-5xl mx-auto">
        {/* No sólo color: ícono y palabra, como en el aviso completo. */}
        <AlertTriangle className="w-5 h-5 text-statusDanger shrink-0 animate-pulse" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-textPrimary text-sm font-medium truncate">
            <span className="text-statusDanger uppercase text-xs tracking-wide mr-2">
              Sin atender
            </span>
            {aviso.titulo} · {aviso.patente ?? 'vehículo sin identificar'}
          </p>
          <p className="text-textMuted text-xs">
            {fechaHora(aviso.ocurrio_at)} · {desde(aviso.ocurrio_at)}
            {cantidad > 1 && ` · y ${cantidad - 1} más`}
          </p>
        </div>
        <button
          type="button"
          onClick={onAmpliar}
          className="rounded-lg border border-borderDefault px-3 py-1.5 text-textSecondary text-sm hover:bg-bgSurfaceHigh shrink-0"
        >
          Ampliar
        </button>
        <button
          type="button"
          onClick={onAtender}
          className="rounded-lg bg-gradient-danger px-4 py-1.5 font-display font-bold text-textPrimary text-sm shrink-0 hover:brightness-110"
        >
          Atender
        </button>
        </div>
      </div>
    </CapaSuperpuesta>
  );
}
