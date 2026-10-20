import type { ReactNode } from 'react';

/**
 * VISTA: campo de formulario con etiqueta, ayuda y error accesibles.
 *
 * Cumple WCAG 2.2:
 *  - 1.3.1 y 3.3.2: `<label for>` asociado al control; nunca se usa el
 *    placeholder como sustituto de la etiqueta.
 *  - 3.3.1 y 3.3.3: el error se comunica con texto y `aria-describedby`.
 *  - 3.3.2: los campos obligatorios se marcan en la etiqueta y con `required`.
 */
export interface FieldA11yProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-errormessage'?: string;
  required?: boolean;
  'aria-required'?: boolean;
}

export function Field({
  id,
  label,
  hint,
  error,
  required = false,
  optionalText = 'opcional',
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  optionalText?: string;
  children: (a11y: FieldA11yProps) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold text-brand-900">
        {label}{' '}
        {required ? (
          <span className="text-urgent-800">(obligatorio)</span>
        ) : (
          <span className="font-normal text-slate-600">({optionalText})</span>
        )}
      </label>

      {hint && (
        <p id={hintId} className="text-sm text-slate-600">
          {hint}
        </p>
      )}

      {children({
        id,
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        ...(error ? { 'aria-invalid': true, 'aria-errormessage': errorId } : {}),
        ...(required ? { required, 'aria-required': true } : {}),
      })}

      {error && (
        <p id={errorId} className="text-sm font-semibold text-urgent-800">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      )}
    </div>
  );
}
