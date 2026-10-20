import type { AnnouncementStatus, Priority, Role } from './domain';

/**
 * Metadatos de PRESENTACIÓN (capa de modelo de la vista).
 *
 * `Record<Priority, …>` obliga al compilador a exigir una entrada por cada
 * urgencia del dominio: si el backend añade un nivel, el frontend no compila.
 * Así se evita la desincronización sin duplicar el contrato.
 */
export interface PriorityView {
  label: string;
  /** Texto corto para móviles y tablas densas. */
  shortLabel: string;
  description: string;
  /** Clase estática declarada en `styles/global.css`. */
  badgeClass: string;
  cardClass: string;
  /** Rol ARIA: `alert` se anuncia de inmediato al lector de pantalla. */
  ariaRole: 'alert' | 'status';
  isUrgent: boolean;
  rank: number;
}

export const PRIORITY_VIEW: Record<Priority, PriorityView> = {
  critical: {
    label: 'Crítico',
    shortLabel: 'Crítico',
    description: 'Emergencia. Se muestra primero, en rojo y con aviso inmediato.',
    badgeClass: 'badge badge--critical',
    cardClass: 'announcement announcement--critical',
    ariaRole: 'alert',
    isUrgent: true,
    rank: 0,
  },
  high: {
    label: 'Alto',
    shortLabel: 'Alto',
    description: 'Prioridad alta: importante para la operación.',
    badgeClass: 'badge badge--high',
    cardClass: 'announcement announcement--high',
    ariaRole: 'status',
    isUrgent: false,
    rank: 1,
  },
  normal: {
    label: 'Normal',
    shortLabel: 'Normal',
    description: 'Información general de la institución.',
    badgeClass: 'badge badge--normal',
    cardClass: 'announcement',
    ariaRole: 'status',
    isUrgent: false,
    rank: 2,
  },
  low: {
    label: 'Bajo',
    shortLabel: 'Bajo',
    description: 'Recordatorio o aviso menor.',
    badgeClass: 'badge badge--low',
    cardClass: 'announcement announcement--low',
    ariaRole: 'status',
    isUrgent: false,
    rank: 3,
  },
};

export const PRIORITY_ORDER: readonly Priority[] = ['critical', 'high', 'normal', 'low'];

export const STATUS_VIEW: Record<AnnouncementStatus, { label: string; className: string }> = {
  draft: { label: 'Borrador', className: 'bg-slate-100 text-slate-700' },
  published: { label: 'Publicado', className: 'bg-brand-100 text-brand-900' },
  expired: { label: 'Expirado', className: 'bg-urgent-100 text-urgent-900' },
};

export const ROLE_VIEW: Record<Role, { label: string; description: string }> = {
  admin: {
    label: 'Administrador',
    description: 'Publica anuncios, gestiona pantallas y cuentas.',
  },
  client: {
    label: 'Observador',
    description: 'Solo consulta los anuncios publicados.',
  },
};

/** Ordena por urgencia y, a igualdad, por fecha de creación descendente. */
export function compareByUrgency(
  a: Pick<{ priority: Priority; createdAt: string }, 'priority' | 'createdAt'>,
  b: Pick<{ priority: Priority; createdAt: string }, 'priority' | 'createdAt'>,
): number {
  const byPriority = PRIORITY_VIEW[a.priority].rank - PRIORITY_VIEW[b.priority].rank;
  if (byPriority !== 0) return byPriority;
  return b.createdAt.localeCompare(a.createdAt);
}
