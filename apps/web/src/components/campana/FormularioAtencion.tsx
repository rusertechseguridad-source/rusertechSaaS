import { useState } from 'react';
import { AlertTriangle, ArrowUpCircle, Lock } from 'lucide-react';
import type { Protocolo } from '../../store/bitacoraStore';

interface Props {
  protocolo: Protocolo;
  guardando: boolean;
  onRegistrar: (entrada: { paso_id?: string; resultado_codigo?: string; nota?: string }) => void;
  onEscalar: (nota: string) => void;
}

/**
 * EL FORMULARIO DE ATENCIÓN — los pasos de ESTA alerta y sus resultados.
 *
 * ⚠️ LOS PASOS Y LOS RESULTADOS VIENEN DE LA BASE, no de una constante. Un
 * SOS y una parada prolongada no se atienden igual, y el cliente ajusta su
 * doctrina sin que nadie despliegue nada.
 *
 * ⚠️ REGISTRAR ES OBLIGATORIO y la pantalla lo dice ANTES de rechazar: el
 * botón queda deshabilitado hasta que haya un resultado elegido o una nota
 * escrita. El servidor lo vuelve a comprobar —y el CHECK de la tabla también—
 * pero hacérselo descubrir al operador con un error es una forma cara de
 * explicar una regla.
 */
export function FormularioAtencion({ protocolo, guardando, onRegistrar, onEscalar }: Props) {
  const [pasoId, setPasoId] = useState<string>('');
  const [resultado, setResultado] = useState<string>('');
  const [nota, setNota] = useState<string>('');

  const elegido = protocolo.resultados.find((r) => r.codigo === resultado) ?? null;
  const diceAlgo = resultado.trim().length > 0 || nota.trim().length > 0;
  const bloqueado = Boolean(protocolo.motivo_sin_permiso_critica);

  return (
    <div className="space-y-4">
      {/* ⚠️ EL MOTIVO, VISIBLE. No se esconde el formulario: se muestra y se
          explica por qué no se puede usar. Un botón ausente es indistinguible
          de una función que no existe. */}
      {bloqueado && (
        <p className="flex items-start gap-2 rounded-lg border border-borderWarning bg-statusWarning/10 px-3 py-2 text-statusWarning text-sm">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{protocolo.motivo_sin_permiso_critica}</span>
        </p>
      )}

      {protocolo.pasos.length > 0 && (
        <fieldset disabled={bloqueado || guardando}>
          <legend className="text-textMuted text-xs uppercase tracking-wide mb-2">
            Paso del protocolo
            {protocolo.propio_del_cliente && ' · doctrina propia de tu empresa'}
          </legend>
          <div className="space-y-1">
            {protocolo.pasos.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 text-textSecondary text-sm cursor-pointer rounded px-2 py-1 hover:bg-bgSurfaceHigh"
              >
                <input
                  type="radio"
                  name="paso"
                  value={p.id}
                  checked={pasoId === p.id}
                  onChange={() => setPasoId(p.id)}
                  className="accent-accentGreen"
                />
                <span className="text-textMuted">{p.orden}.</span>
                <span className="break-words">{p.accion}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset disabled={bloqueado || guardando}>
        <legend className="text-textMuted text-xs uppercase tracking-wide mb-2">
          Resultado
        </legend>
        {protocolo.resultados.length === 0 ? (
          // Estado de borde real: un tipo de alerta sin doctrina cargada. En
          // vez de un hueco, se dice qué pasa y qué queda por hacer.
          <p className="text-textMuted text-sm">
            Este tipo de alerta todavía no tiene resultados cargados. Escribí lo que hiciste abajo.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {protocolo.resultados.map((r) => (
              <label
                key={r.codigo}
                className={`flex items-center gap-2 text-sm cursor-pointer rounded px-2 py-1.5 border ${
                  resultado === r.codigo
                    ? 'border-borderAccent bg-accentGreen/10 text-textPrimary'
                    : 'border-borderDefault text-textSecondary hover:bg-bgSurfaceHigh'
                }`}
              >
                <input
                  type="radio"
                  name="resultado"
                  value={r.codigo}
                  checked={resultado === r.codigo}
                  onChange={() => setResultado(r.codigo)}
                  className="accent-accentGreen"
                />
                <span className="break-words">{r.nombre}</span>
                {/* La marca sale de la columna `habilita_escalada`, no de
                    comparar el código contra «No responde». */}
                {r.habilita_escalada && (
                  <ArrowUpCircle className="w-3.5 h-3.5 text-statusWarning shrink-0" aria-label="habilita escalar" />
                )}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div>
        <label htmlFor="nota-atencion" className="block text-textMuted text-xs uppercase tracking-wide mb-1">
          Qué pasó {protocolo.resultados.length > 0 && '(opcional si elegiste un resultado)'}
        </label>
        <textarea
          id="nota-atencion"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          disabled={bloqueado || guardando}
          rows={2}
          maxLength={1000}
          placeholder="Llamé al conductor y no atendió"
          className="w-full rounded-lg border border-borderDefault bg-bgStart/60 px-3 py-2 text-textPrimary text-sm placeholder:text-textMuted focus:outline-none focus:ring-1 focus:ring-accentGreen disabled:opacity-50"
        />
      </div>

      {!diceAlgo && !bloqueado && (
        <p className="flex items-start gap-2 text-textMuted text-xs">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          Elegí un resultado o escribí qué hiciste. No se puede silenciar una alerta sin dejar constancia.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!diceAlgo || bloqueado || guardando}
          onClick={() =>
            onRegistrar({
              paso_id: pasoId || undefined,
              resultado_codigo: resultado || undefined,
              nota: nota.trim() || undefined,
            })
          }
          className="flex-1 min-w-[10rem] rounded-lg bg-gradient-accent px-4 py-2.5 font-display font-bold text-textOnAccent disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
        >
          {guardando ? 'Guardando…' : 'Registrar y atender'}
        </button>

        {/* ⚠️ ESCALAR ES UN BOTÓN DEL HILO, no un menú aparte, y muestra a
            quién antes de confirmar: que el operador vea a quién le está
            pasando el problema es la diferencia entre escalar y tirarlo por
            arriba del hombro. */}
        {protocolo.destino_de_escalada ? (
          <button
            type="button"
            disabled={guardando}
            onClick={() => onEscalar(nota.trim())}
            title={
              elegido?.habilita_escalada
                ? 'Este resultado habilita escalar'
                : 'Podés escalar en cualquier momento'
            }
            className="flex items-center justify-center gap-2 rounded-lg border border-borderWarning px-4 py-2.5 text-statusWarning text-sm font-medium hover:bg-statusWarning/10 disabled:opacity-40"
          >
            <ArrowUpCircle className="w-4 h-4" aria-hidden="true" />
            Escalar a {protocolo.destino_de_escalada.nombre ?? protocolo.destino_de_escalada.email}
          </button>
        ) : (
          <span className="flex items-center gap-2 rounded-lg border border-borderDefault px-4 py-2.5 text-textMuted text-sm">
            <ArrowUpCircle className="w-4 h-4" aria-hidden="true" />
            No hay a quién escalar en tu empresa
          </span>
        )}
      </div>
    </div>
  );
}
