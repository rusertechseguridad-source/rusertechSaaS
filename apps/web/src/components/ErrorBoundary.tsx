import React from 'react';

/**
 * BARRERA DE ERRORES DE RENDER.
 *
 * Sin esto, una excepción en cualquier componente desmonta el árbol entero y
 * la aplicación queda EN BLANCO, sin mensaje. Es la tercera vez que un
 * "la pantalla no se renderiza" llega como hallazgo de prueba, y las tres
 * veces el diagnóstico costó más que el error: una pantalla vacía no dice
 * nada.
 *
 * Con la barrera, el error se muestra donde ocurrió. La pantalla rota sigue
 * rota — pero ahora lo dice, y el resto de la aplicación sigue de pie.
 */

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Error de render:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-[50vh] flex items-center justify-center p-8">
        <div className="max-w-lg w-full bg-bgSurface border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-white font-bold mb-2">Esta pantalla encontró un error</p>
          <p className="text-textMuted text-sm mb-4">
            El resto de la aplicación sigue funcionando. Si el problema persiste,
            copiá el detalle de abajo al reportarlo.
          </p>
          <pre className="text-left text-[11px] text-red-400 bg-bgStart border border-borderDefault rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-4 px-4 py-2 text-sm font-bold rounded-lg bg-accentBlue/20 text-accentBlue border border-accentBlue/40 hover:bg-accentBlue/30 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }
}
