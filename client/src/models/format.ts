/**
 * Utilidades de formato y fechas para la interfaz.
 * Se usan en `lang="es"` (documento) y en tablas de datos accesibles: las
 * fechas se acompañan siempre de texto comprensible (WCAG 3.1.1, 3.1.5).
 */
const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('es-ES', {
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha inválida';
  return dateFormatter.format(date);
}

export function formatTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return timeFormatter.format(date);
}

/** Rango de vigencia legible: "Hasta 20 may 2026, 18:00" / "Siempre vigente". */
export function formatWindow(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt && !endsAt) return 'Siempre vigente';
  if (startsAt && endsAt) return `Del ${formatDateTime(startsAt)} al ${formatDateTime(endsAt)}`;
  if (startsAt) return `Desde el ${formatDateTime(startsAt)}`;
  return `Hasta el ${formatDateTime(endsAt)}`;
}

/** Indica si el anuncio está publicado y dentro de su ventana temporal. */
export function isLive(startsAt: string | null, endsAt: string | null, now = new Date()): boolean {
  const time = now.getTime();
  if (startsAt && Date.parse(startsAt) > time) return false;
  if (endsAt && Date.parse(endsAt) <= time) return false;
  return true;
}

/** Convierte un ISO-8601 al formato `datetime-local` de los formularios. */
export function toDateTimeLocal(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Convierte el valor de `datetime-local` a ISO-8601 (o `null`). */
export function fromDateTimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
