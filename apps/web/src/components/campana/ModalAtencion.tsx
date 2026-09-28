import { useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { CapaSuperpuesta } from '../CapaSuperpuesta';
import { useBitacoraStore } from '../../store/bitacoraStore';
import { useCampanaStore } from '../../store/campanaStore';
import { FormularioAtencion } from './FormularioAtencion';
import { DesdeQueOcurrio, HiloBitacora } from './HiloBitacora';
import { UbicacionDelAviso } from './UbicacionDelAviso';

/**
 * LA VENTANA DE ATENCIÓN — el formulario y el hilo, juntos.
 *
 * ⚠️ JUNTOS A PROPÓSITO. El operador que va a registrar la tercera llamada
 * necesita ver las dos anteriores: sin el hilo a la vista, el formulario le
 * pide que decida sin la información que ya está en el sistema, y termina
 * repitiendo un paso que otro ya hizo.
 */
export function ModalAtencion() {
  const {
    abierta, protocolo, hilo, cargando, guardando, error,
    cerrarModal, registrar, escalar, cerrarAlerta,
  } = useBitacoraStore();
  const abrirBitacora = useBitacoraStore((s) => s.abrir);
  const recargarCampana = useCampanaStore((s) => s.cargarPendientes);
  const [motivoCierre, setMotivoCierre] = useState('');
  const [mostrarCierre, setMostrarCierre] = useState(false);

  if (!abierta) return null;

  /** Vuelve a pedir el protocolo y el hilo de ESTA misma alerta. */
  const reintentar = () => abrirBitacora(abierta);

  const cerrar = () => {
    setMotivoCierre('');
    setMostrarCierre(false);
    cerrarModal();
    // La campana se reconstruye desde la base: lo que pasó acá adentro tiene
    // que verse afuera sin esperar a la próxima reconexión.
    void recargarCampana();
  };

  return (
    // ⚠️ PORTAL. Sin esto, `fixed inset-0` mide la barra superior — 64 px de
    // alto — y no la ventana: la campana vive adentro de un `<nav>` con
    // `backdrop-blur`, que es bloque contenedor de los `fixed`. Ver
    // `CapaSuperpuesta`, donde está la medición.
    <CapaSuperpuesta>
      <div
        className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center bg-bgOverlay backdrop-blur-sm p-4 py-8 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-atencion"
      >
        {/* ⚠️ DESPLAZAMIENTO PROPIO Y ALTURA ACOTADA. El formulario más el
            hilo no entran en una pantalla, y el hilo CRECE con cada entrada:
            sin `max-h` y `overflow-y-auto` propios, la quinta entrada empuja
            los botones fuera de la vista y la ventana deja de poder usarse
            justo cuando más trabajo se hizo. `flex flex-col` para que el
            encabezado quede fijo y sólo desplace el cuerpo. */}
        <div className="w-full max-w-2xl max-h-[calc(100vh-4rem)] flex flex-col rounded-xl border border-borderDefault bg-bgSurface shadow-card">
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-borderDefault">
          <div className="min-w-0">
            <h2 id="titulo-atencion" className="font-display font-bold text-textPrimary truncate">
              {abierta.titulo}
            </h2>
            <div className="flex items-center gap-3 flex-wrap mt-0.5">
              <span className="text-textMuted text-xs">
                {abierta.patente ?? 'vehículo sin identificar'}
              </span>
              <DesdeQueOcurrio desde={abierta.ocurrio_at} />
            </div>
            {/* En el encabezado y no en el cuerpo: el cuerpo se desplaza, y el
                dónde tiene que seguir a la vista mientras se registra. */}
            <div className="mt-2">
              <UbicacionDelAviso aviso={abierta} />
            </div>
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar la ventana"
            className="p-1 rounded text-textMuted hover:text-textPrimary hover:bg-bgSurfaceHigh shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-5 space-y-5 overflow-y-auto">
          {error && (
            <p className="flex items-start gap-2 rounded-lg bg-statusDanger/10 border border-borderDanger px-3 py-2 text-statusDanger text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="break-words">{error}</span>
            </p>
          )}

          {cargando && <p className="text-textMuted text-sm">Buscando el protocolo…</p>}

          {/* ⚠️ LOS TRES ESTADOS SE DISTINGUEN, y éste es el que faltaba.
              Sin esta rama, un protocolo que no llegó —sin error, porque la
              petición nunca salió— dejaba el cuerpo del modal EN BLANCO: el
              encabezado con la X y nada abajo. Un hueco es indistinguible de
              una pantalla rota, y es exactamente lo que se reportó desde el
              navegador. Cargando dice «esperá»; el motivo dice «no podés»;
              esto dice «falló», y ofrece la salida. */}
          {!cargando && !protocolo && !error && (
            <div className="space-y-2">
              <p className="flex items-start gap-2 text-statusWarning text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  No se pudo cargar el protocolo de esta alerta. La alerta sigue abierta y sin
                  atender.
                </span>
              </p>
              <button
                type="button"
                onClick={() => { void reintentar(); }}
                className="rounded-lg border border-borderDefault px-4 py-2 text-textSecondary text-sm hover:bg-bgSurfaceHigh"
              >
                Reintentar
              </button>
            </div>
          )}

          {!cargando && protocolo && !protocolo.existe && (
            <p className="text-textMuted text-sm">
              Esta alerta ya no está disponible. Puede haberla cerrado otra persona.
            </p>
          )}

          {!cargando && protocolo?.existe && (
            <>
              <FormularioAtencion
                protocolo={protocolo}
                guardando={guardando}
                onRegistrar={async (entrada) => {
                  const ok = await registrar(entrada);
                  if (ok) void recargarCampana();
                }}
                onEscalar={async (nota) => {
                  await escalar(nota);
                }}
              />

              <section>
                <h3 className="text-textMuted text-xs uppercase tracking-wide mb-2">
                  Bitácora ({hilo.length})
                </h3>
                <HiloBitacora entradas={hilo} />
              </section>

              {/* ⚠️ CERRAR SÓLO PARA QUIEN PUEDE, Y CON MOTIVO ESCRITO.
                  La facultad sale de `roles.puede_cerrar_alertas`. Quien no la
                  tiene ve el bloque explicado, no un hueco. */}
              <section className="border-t border-borderDefault pt-4">
                {protocolo.puede_cerrar ? (
                  mostrarCierre ? (
                    <div className="space-y-2">
                      <label htmlFor="motivo-cierre" className="block text-textMuted text-xs uppercase tracking-wide">
                        Motivo del cierre (obligatorio)
                      </label>
                      <textarea
                        id="motivo-cierre"
                        rows={2}
                        maxLength={1000}
                        value={motivoCierre}
                        onChange={(e) => setMotivoCierre(e.target.value)}
                        placeholder="El cliente confirmó que el viaje siguió normal"
                        className="w-full rounded-lg border border-borderDefault bg-bgStart/60 px-3 py-2 text-textPrimary text-sm placeholder:text-textMuted focus:outline-none focus:ring-1 focus:ring-accentGreen"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={motivoCierre.trim().length === 0 || guardando}
                          onClick={async () => {
                            const ok = await cerrarAlerta(motivoCierre.trim());
                            if (ok) cerrar();
                          }}
                          className="rounded-lg bg-gradient-danger px-4 py-2 text-textPrimary text-sm font-medium disabled:opacity-40"
                        >
                          Confirmar cierre
                        </button>
                        <button
                          type="button"
                          onClick={() => setMostrarCierre(false)}
                          className="rounded-lg border border-borderDefault px-4 py-2 text-textSecondary text-sm"
                        >
                          Volver
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setMostrarCierre(true)}
                      className="flex items-center gap-2 text-accentMint text-sm hover:underline"
                    >
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      Cerrar esta alerta
                    </button>
                  )
                ) : (
                  <p className="text-textMuted text-xs">
                    Cerrar una alerta es facultad de un superior. Registrá lo que hiciste y, si no
                    podés resolverla, escalala.
                  </p>
                )}
              </section>
            </>
          )}
          </div>
        </div>
      </div>
    </CapaSuperpuesta>
  );
}
