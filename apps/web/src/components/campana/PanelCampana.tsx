import { AlertTriangle, Check, CircleDot, Inbox, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react';
import type { Aviso, EstadoConexion } from '../../store/campanaStore';
import { desde } from './AvisoCritico';

interface Props {
  avisos: Aviso[];
  conexion: EstadoConexion;
  cargando: boolean;
  error: string | null;
  sonidoActivo: boolean;
  silenciado: boolean;
  onAtender: (aviso: Aviso) => void;
  onAlternarSilencio: () => void;
  onActivarSonido: () => void;
}

/**
 * LA LISTA DE LA CAMPANA.
 *
 * ⚠️ LOS CUATRO ESTADOS DE BORDE, los cuatro visibles: cargando, error, vacío
 * y con datos. Un panel que sólo sabe dibujar la lista llena deja al operador
 * mirando un rectángulo en blanco sin saber si no hay alertas o si la consulta
 * se cayó — y esas dos cosas no se parecen en nada.
 *
 * ⚠️ EL ESTADO DE LA CONEXIÓN ES PARTE DE LA INFORMACIÓN. Si el flujo está
 * cortado, la lista puede estar vieja, y el operador tiene derecho a saberlo.
 * Callarlo sería mostrarle una pantalla tranquila mientras pasan cosas.
 */
export function PanelCampana({
  avisos, conexion, cargando, error, sonidoActivo, silenciado,
  onAtender, onAlternarSilencio, onActivarSonido,
}: Props) {
  return (
    <div
      className="absolute right-0 mt-2 w-[26rem] max-w-[calc(100vw-2rem)] rounded-xl border border-borderDefault bg-bgSurface shadow-card overflow-hidden z-50"
      role="region"
      aria-label="Alertas sin atender"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-borderDefault">
        <h2 className="font-display font-bold text-textPrimary">Alertas</h2>
        <div className="flex items-center gap-2">
          <IndicadorConexion conexion={conexion} />
          <BotonSonido
            sonidoActivo={sonidoActivo}
            silenciado={silenciado}
            onAlternarSilencio={onAlternarSilencio}
            onActivarSonido={onActivarSonido}
          />
        </div>
      </div>

      <div className="max-h-[26rem] overflow-y-auto">
        {cargando && avisos.length === 0 && (
          <p className="px-4 py-8 text-center text-textMuted text-sm">Buscando alertas…</p>
        )}

        {error && (
          <p className="px-4 py-3 text-sm text-statusDanger flex items-start gap-2 bg-statusDanger/10">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="break-words">{error}</span>
          </p>
        )}

        {!cargando && !error && avisos.length === 0 && (
          <div className="px-4 py-10 text-center">
            <Inbox className="w-8 h-8 mx-auto text-textMuted mb-2" aria-hidden="true" />
            <p className="text-textSecondary text-sm">No hay alertas sin atender.</p>
            <p className="text-textMuted text-xs mt-1">
              El motor sigue vigilando aunque esta lista esté vacía.
            </p>
          </div>
        )}

        <ul>
          {avisos.map((a) => (
            <FilaDeAviso key={`${a.fuente}:${a.id}`} aviso={a} onAtender={() => onAtender(a)} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function FilaDeAviso({ aviso, onAtender }: { aviso: Aviso; onAtender: () => void }) {
  const atendida = Boolean(aviso.atendida_por_nombre);

  return (
    <li className="border-b border-borderDefault/50 last:border-0">
      <div className="flex gap-3 px-4 py-3">
        {/* El punto de color sale del catálogo, y va ACOMPAÑADO del texto del
            nivel: quien no distingue el color lee la palabra. */}
        <CircleDot
          className="w-4 h-4 shrink-0 mt-1"
          style={{ color: aviso.color }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-textPrimary text-sm font-medium truncate">{aviso.titulo}</p>
            <span className="text-textMuted text-xs shrink-0">{desde(new Date(aviso.ocurrio_at))}</span>
          </div>
          <p className="text-textMuted text-xs">
            {aviso.patente ?? 'vehículo sin identificar'}
            {' · '}
            {aviso.clasificado ? etiquetaDeNivel(aviso.nivel_riesgo) : 'sin clasificar'}
            {aviso.fuente === 'evento' ? ' · evento del motor de geocercas' : ''}
          </p>

          {aviso.resuelta && (
            <p className="text-accentMint text-xs mt-1">
              Se resolvió sola — queda en el historial.
            </p>
          )}

          {atendida ? (
            <p className="text-accentMint text-xs mt-1 flex items-center gap-1">
              <Check className="w-3 h-3" aria-hidden="true" />
              Atendida por {aviso.atendida_por_nombre}
            </p>
          ) : (
            <button
              type="button"
              onClick={onAtender}
              className="mt-2 rounded-md border border-borderAccent px-3 py-1 text-xs text-accentGreen hover:bg-accentGreen/10 focus:outline-none focus:ring-1 focus:ring-accentGreen"
            >
              Atender
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * EL BOTÓN DE SONIDO — dos cosas distintas en un solo lugar.
 *
 * ⚠️ «Activar» y «silenciar» NO son lo mismo, y confundirlos deja al operador
 * creyendo que apagó algo que nunca estuvo encendido:
 *
 *   · ACTIVAR es el gesto que el navegador exige antes de dejar sonar nada.
 *     Sin él no hay sonido, y la falla es muda.
 *   · SILENCIAR es la decisión de la persona, y se recuerda entre sesiones.
 *
 * Por eso la pantalla muestra el estado real y no un ícono optimista. Y
 * silenciar **no oculta el aviso rojo**: apaga el ruido, no la información.
 */
function BotonSonido({
  sonidoActivo, silenciado, onAlternarSilencio, onActivarSonido,
}: Pick<Props, 'sonidoActivo' | 'silenciado' | 'onAlternarSilencio' | 'onActivarSonido'>) {
  if (!sonidoActivo) {
    return (
      <button
        type="button"
        onClick={onActivarSonido}
        className="flex items-center gap-1 rounded-md border border-borderWarning px-2 py-1 text-xs text-statusWarning hover:bg-statusWarning/10"
        title="El navegador bloquea el audio hasta que lo activás con un clic"
      >
        <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
        Activar sonido
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onAlternarSilencio}
      className="flex items-center gap-1 rounded-md border border-borderDefault px-2 py-1 text-xs text-textSecondary hover:bg-bgSurfaceHigh"
      aria-pressed={silenciado}
    >
      {silenciado ? (
        <><VolumeX className="w-3.5 h-3.5" aria-hidden="true" /> Silenciado</>
      ) : (
        <><Volume2 className="w-3.5 h-3.5" aria-hidden="true" /> Con sonido</>
      )}
    </button>
  );
}

function IndicadorConexion({ conexion }: { conexion: EstadoConexion }) {
  if (conexion === 'en_vivo') {
    return (
      <span className="flex items-center gap-1 text-xs text-accentMint" title="Recibiendo alertas en vivo">
        <Wifi className="w-3.5 h-3.5" aria-hidden="true" /> En vivo
      </span>
    );
  }
  return (
    <span
      className="flex items-center gap-1 text-xs text-statusWarning"
      title="Sin conexión en vivo: la lista puede estar desactualizada"
    >
      <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
      {conexion === 'conectando' ? 'Conectando' : 'Sin conexión'}
    </span>
  );
}

/** El nombre del nivel, en castellano, sin inventar ninguno. */
function etiquetaDeNivel(codigo: string | null): string {
  if (!codigo) return 'sin clasificar';
  // Se muestra el código tal cual si no hay traducción: ver el código real es
  // peor que una etiqueta linda y mucho mejor que una etiqueta equivocada.
  const NOMBRES: Record<string, string> = {
    panorama_normal: 'panorama normal',
    anomalia: 'anomalía',
    riesgo_critico: 'riesgo crítico',
    activacion_policial: 'activación policial',
  };
  return NOMBRES[codigo] ?? codigo;
}
