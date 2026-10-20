import { useEffect, useRef, useState } from 'react';

/**
 * VISTA: acción destructiva con confirmación en dos pasos.
 *
 * Se evita `window.confirm` (no accesible ni estilizable) y se implementa un
 * patrón accesible:
 *  - El foco se mueve al botón de confirmación al abrir el paso 2
 *    (criterio 2.4.3 orden del foco).
 *  - `Escape` cancela la acción (criterio 2.1.2 sin trampa de teclado).
 *  - El texto de confirmación es explícito: nombra el objeto afectado
 *    (criterio 3.3.4 / 2.4.6 encabezados y etiquetas).
 */
export function ConfirmAction({
  label,
  confirmLabel,
  subject,
  onConfirm,
  busy = false,
  description,
}: {
  label: string;
  confirmLabel: string;
  subject: string;
  onConfirm: () => void;
  busy?: boolean;
  description?: string;
}) {
  const [armed, setArmed] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (armed) confirmRef.current?.focus();
  }, [armed]);

  const cancel = () => {
    setArmed(false);
    triggerRef.current?.focus();
  };

  if (!armed) {
    return (
      <button
        ref={triggerRef}
        type="button"
        className="btn btn--danger"
        onClick={() => setArmed(true)}
        disabled={busy}
      >
        {label}
      </button>
    );
  }

  return (
    <span
      role="group"
      aria-label={`Confirmar ${label.toLowerCase()}`}
      className="inline-flex flex-wrap items-center gap-2"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          cancel();
        }
      }}
    >
      <span className="text-sm font-semibold text-urgent-900">
        {description ?? `¿Confirma ${confirmLabel.toLowerCase()} “${subject}”?`}
      </span>
      <button ref={confirmRef} type="button" className="btn btn--danger" onClick={onConfirm} disabled={busy}>
        Sí, {confirmLabel.toLowerCase()}
      </button>
      <button type="button" className="btn btn--secondary" onClick={cancel}>
        Cancelar
      </button>
    </span>
  );
}
