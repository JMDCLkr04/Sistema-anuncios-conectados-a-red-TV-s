import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

/**
 * VISTA: límite de errores de React.
 * Evita la "pantalla en blanco": ante un fallo de render se muestra un mensaje
 * accesible con `role="alert"` y una acción de recuperación (WCAG 4.1.3).
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // En producción este mensaje se enviaría al colector de eventos de la API.
    console.error('Fallo de render en la interfaz', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="mx-auto max-w-2xl p-6">
        <div role="alert" className="rounded-lg border-2 border-urgent-200 bg-urgent-50 p-6">
          <h1 className="text-2xl font-extrabold text-urgent-900">La interfaz encontró un problema</h1>
          <p className="mt-2 text-slate-800">
            Se produjo un error inesperado al mostrar esta pantalla. Los anuncios publicados no se ven
            afectados; puede recargar la página para continuar.
          </p>
          <button
            type="button"
            className="btn btn--primary mt-4"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            Recargar la aplicación
          </button>
        </div>
      </div>
    );
  }
}
