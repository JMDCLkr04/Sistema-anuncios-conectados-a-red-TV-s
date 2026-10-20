import type { ReactNode } from 'react';

import type { SocketStatus } from '../../services/websocket';

/**
 * VISTA: indicador del estado del canal en tiempo real.
 * Comunica la situación con texto (no sólo color) y con un icono accesible,
 * criterio 1.4.1 de WCAG 2.2.
 */
const LABELS: Record<SocketStatus, { text: string; icon: string; className: string }> = {
  online: { text: 'En tiempo real', icon: '●', className: 'text-brand-800 bg-brand-100 border-brand-300' },
  connecting: {
    text: 'Conectando…',
    icon: '◐',
    className: 'text-slate-800 bg-slate-100 border-slate-300',
  },
  offline: {
    text: 'Sin conexión, reintentando',
    icon: '▲',
    className: 'text-urgent-900 bg-urgent-100 border-urgent-200',
  },
};

export function ConnectionIndicator({ status }: { status: SocketStatus }) {
  const view = LABELS[status];
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 text-sm font-semibold ${view.className}`}
    >
      <span aria-hidden="true">{view.icon}</span>
      {view.text}
    </span>
  );
}

/** VISTA: aviso de error de formulario reutilizable. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      id="form-error"
      className="rounded-lg border-2 border-urgent-200 bg-urgent-50 p-3 font-semibold text-urgent-900"
    >
      {message}
    </div>
  );
}

/** VISTA: fila de etiqueta y valor para fichas descriptivas. */
export function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-semibold uppercase tracking-wide text-brand-800">{label}</dt>
      <dd className="mt-1 text-slate-900">{children}</dd>
    </div>
  );
}
