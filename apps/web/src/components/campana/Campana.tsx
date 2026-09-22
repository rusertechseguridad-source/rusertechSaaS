import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import {
  criticasVivas,
  pendientesVisibles,
  sincronizarAlarma,
  useCampanaStore,
  type Aviso,
} from '../../store/campanaStore';
import { sonido } from '../../services/sonido';
import { AvisoCritico } from './AvisoCritico';
import { PanelCampana } from './PanelCampana';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * LA CAMPANA — siempre visible en la barra superior
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ SIEMPRE VISIBLE, Y ES UNA REGLA DEL PRODUCTO: «un botón ausente es
 * indistinguible de una función que no existe». La campana no se esconde
 * cuando no hay alertas — se muestra apagada y dice que no hay ninguna. Si
 * desapareciera, el operador no tendría forma de distinguir «no pasa nada» de
 * «esto dejó de funcionar».
 *
 * Este componente hace tres cosas y nada más: conectar el flujo, decidir qué
 * alerta crítica se muestra arriba de todo, y montar las dos piezas que
 * dibujan. La lógica de qué suena vive en el store; cómo suena, en el servicio
 * de sonido; cómo se ve, en los dos componentes de al lado.
 */
export function Campana() {
  const {
    avisos, conexion, cargando, error, panelAbierto,
    cargarPendientes, conectar, desconectar, atender, abrirPanel,
  } = useCampanaStore();

  // El servicio de sonido no es un store de React: se escucha para que la
  // pantalla muestre el estado REAL del audio y no el que supone.
  const [, refrescar] = useState(0);
  useEffect(() => sonido.suscribir(() => refrescar((n) => n + 1)), []);

  useEffect(() => {
    void cargarPendientes();
    conectar();
    return () => desconectar();
    // Se conecta una vez por montaje. El store maneja los reintentos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⚠️ Al volver a la pestaña se vuelve a pedir la lista. Un navegador que
  // estuvo en segundo plano puede haber tenido el flujo congelado sin avisar:
  // la base es la que dice la verdad.
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') void cargarPendientes(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [cargarPendientes]);

  const pendientes = pendientesVisibles(avisos);
  const criticas = criticasVivas(avisos);
  // La más vieja primero: la que lleva más tiempo esperando es la que más
  // urge, no la última que llegó.
  const enPantalla = criticas[criticas.length - 1];

  const activarSonido = async () => {
    await sonido.activar();
    // Si ya había críticas esperando, el gesto también tiene que arrancar la
    // alarma: si no, el operador activa el sonido y no oye nada.
    sincronizarAlarma(useCampanaStore.getState().avisos);
  };

  const atenderAviso = async (aviso: Aviso) => { await atender(aviso); };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => abrirPanel(!panelAbierto)}
        aria-expanded={panelAbierto}
        aria-label={
          pendientes.length === 0
            ? 'Alertas: ninguna sin atender'
            : `Alertas: ${pendientes.length} sin atender`
        }
        className="relative p-2 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-bgSurfaceHigh focus:outline-none focus:ring-1 focus:ring-accentGreen"
      >
        <Bell className={`w-5 h-5 ${criticas.length > 0 ? 'text-statusDanger' : ''}`} />
        {pendientes.length > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full text-[0.65rem] font-bold flex items-center justify-center ${
              criticas.length > 0
                ? 'bg-statusDanger text-textPrimary'
                : 'bg-statusWarning text-textOnAccent'
            }`}
          >
            {pendientes.length > 99 ? '99+' : pendientes.length}
          </span>
        )}
      </button>

      {panelAbierto && (
        <PanelCampana
          avisos={avisos}
          conexion={conexion}
          cargando={cargando}
          error={error}
          sonidoActivo={sonido.activo}
          silenciado={sonido.silenciado}
          onAtender={atenderAviso}
          onAlternarSilencio={() => { sonido.silenciado = !sonido.silenciado; }}
          onActivarSonido={activarSonido}
        />
      )}

      {/* ⚠️ El aviso rojo se muestra AUNQUE el sonido esté silenciado. Silenciar
          es «no me hagas ruido», no «no me cuentes lo que pasa». */}
      {enPantalla && (
        <AvisoCritico
          aviso={enPantalla}
          sonidoActivo={sonido.activo}
          onAtender={() => atenderAviso(enPantalla)}
          onActivarSonido={activarSonido}
        />
      )}
    </div>
  );
}
