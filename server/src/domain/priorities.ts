import type { AnnouncementStatus, Priority, Role } from './types.js';

/**
 * Metadatos de presentación de la urgencia.
 *
 * La clase CSS se declara de forma estática en `client/src/styles/global.css`
 * (no se generan clases dinámicas) para que Tailwind no necesite escanear
 * archivos del servidor y para garantizar el contraste mínimo exigido por
 * WCAG 2.2 — criterio 1.4.3 (contraste mínimo 4.5:1 para texto).
 */
export interface PriorityMeta {
  label: string;
  hint: string;
  /** 0 = más urgente. Se usa para ordenar el feed. */
  rank: number;
  /** Modificador CSS estático: `.badge--<key>`. */
  key: Priority;
  /** Rol ARIA con el que se anuncia el cambio a lectores de pantalla. */
  ariaRole: 'alert' | 'status';
  /** `true` solo para `critical`: habilita el color resaltante rojo. */
  isUrgent: boolean;
}

export const PRIORITIES = ['critical', 'high', 'normal', 'low'] as const;

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  critical: {
    label: 'Crítico',
    hint: 'Emergencia: se resalta en rojo y se anuncia de inmediato.',
    rank: 0,
    key: 'critical',
    ariaRole: 'alert',
    isUrgent: true,
  },
  high: {
    label: 'Alto',
    hint: 'Importante pero no emergencia.',
    rank: 1,
    key: 'high',
    ariaRole: 'status',
    isUrgent: false,
  },
  normal: {
    label: 'Normal',
    hint: 'Información general.',
    rank: 2,
    key: 'normal',
    ariaRole: 'status',
    isUrgent: false,
  },
  low: {
    label: 'Bajo',
    hint: 'Aviso menor o recordatorio.',
    rank: 3,
    key: 'low',
    ariaRole: 'status',
    isUrgent: false,
  },
};

export const ANNOUNCEMENT_STATUSES = ['draft', 'published', 'expired'] as const;

export const STATUS_LABEL: Record<AnnouncementStatus, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  expired: 'Expirado',
};

export const ROLES = ['admin', 'client'] as const;

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  client: 'Observador',
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  admin: 'Puede crear, editar y eliminar anuncios y pantallas.',
  client: 'Solo puede observar los anuncios publicados.',
};

/** Ordena por urgencia y luego por fecha de creación descendente. */
export function compareByUrgency(
  a: { priority: Priority; createdAt: string },
  b: { priority: Priority; createdAt: string },
): number {
  const byPriority = PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank;
  if (byPriority !== 0) return byPriority;
  return b.createdAt.localeCompare(a.createdAt);
}

/** Indica si el anuncio está dentro de su ventana de publicación. */
export function isWithinWindow(
  announcement: Pick<AnnouncementLike, 'startsAt' | 'endsAt'>,
  now: Date = new Date(),
): boolean {
  const time = now.getTime();
  if (announcement.startsAt && Date.parse(announcement.startsAt) > time) return false;
  if (announcement.endsAt && Date.parse(announcement.endsAt) <= time) return false;
  return true;
}

interface AnnouncementLike {
  startsAt: string | null;
  endsAt: string | null;
}
