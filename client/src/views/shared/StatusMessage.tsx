import type { ReactNode } from 'react';

/**
 * VISTA: mensajes de estado accesibles.
 *
 * `role="status"` (cortesía) para cargas y `role="alert"` (asertivo) para
 * errores, conforme a WCAG 2.2 — criterio 4.1.3 (mensajes de estado).
 */
export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <p role="status" aria-live="polite" className="flex items-center gap-3 text-slate-700 py-6">
      <span
        aria-hidden="true"
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-700 border-t-transparent"
      />
      {label}
    </p>
  );
}

export function ErrorState({
  title = 'No se pudo completar la operación',
  message,
  onRetry,
  children,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border-2 border-urgent-200 bg-urgent-50 p-4 text-urgent-900"
    >
      <p className="font-bold">{title}</p>
      <p className="mt-1">{message}</p>
      {children}
      {onRetry && (
        <button type="button" className="btn btn--danger mt-3" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border-2 border-dashed border-brand-300 bg-brand-50 p-8 text-center">
      <p className="text-lg font-bold text-brand-900">{title}</p>
      <p className="mt-1 text-slate-700">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
