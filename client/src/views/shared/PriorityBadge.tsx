import type { Priority } from '../../models/domain';
import { PRIORITY_VIEW } from '../../models';

/**
 * VISTA: distintivo de urgencia.
 *
 * Accesibilidad:
 *  - Criterio 1.4.1 (uso del color): el significado no depende sólo del color;
 *    se añade la palabra ("Crítico") y un icono, y el color rojo se reserva
 *    para la urgencia máxima.
 *  - Criterio 1.3.1 (información y relaciones): el icono es decorativo
 *    (`aria-hidden`) para no duplicar la información.
 */
export function PriorityBadge({ priority, className = '' }: { priority: Priority; className?: string }) {
  const view = PRIORITY_VIEW[priority];
  return (
    <span className={`${view.badgeClass} ${className}`.trim()}>
      <span aria-hidden="true">{view.isUrgent ? '⚠' : '•'}</span>
      {view.label}
    </span>
  );
}

/** Texto auxiliar para tablas: describe la urgencia con palabras. */
export function PriorityDescription({ priority }: { priority: Priority }) {
  return <span className="text-slate-600 text-sm">{PRIORITY_VIEW[priority].description}</span>;
}
