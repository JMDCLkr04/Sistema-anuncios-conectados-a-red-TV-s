import type { AnnouncementRow } from '../models/announcement.model.js';
import type { AuditRow } from '../models/audit.model.js';
import type { ScreenRow } from '../models/screen.model.js';
import type { UserRow } from '../models/user.model.js';
import type {
  Announcement,
  AuditLogEntry,
  Role,
  Screen,
  ScreenWithToken,
  SessionUser,
  UserSummary,
} from '../domain/types.js';

/**
 * VISTA (presentadores). En un MVC de monolito modular, la "vista" es la
 * representación que se entrega al cliente: aquí se traduce el modelo
 * relacional (snake_case, `Date`, columnas internas) al contrato público de la
 * API (camelCase, ISO-8601) y se decide explícitamente qué campos se exponen.
 *
 * Regla de seguridad: nada que no se defina aquí llega al cliente
 * (nunca `password_hash`, `token_hash`, ni identificadores internos).
 */
const iso = (value: Date | null): string | null => (value ? value.toISOString() : null);

export function toAnnouncement(row: AnnouncementRow): Announcement {
  const screenIds = row.screen_ids ?? [];
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    priority: row.priority,
    status: row.status,
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    screenIds,
    allScreens: screenIds.length === 0,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toScreen(row: ScreenRow): Screen {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    active: row.active,
    lastSeenAt: iso(row.last_seen_at),
    createdAt: row.created_at.toISOString(),
    publishedCount: Number(row.published_count ?? '0'),
  };
}

/** El token en claro sólo se devuelve al administrador en el momento de crearlo. */
export function toScreenWithToken(row: ScreenRow, token: string): ScreenWithToken {
  return { ...toScreen(row), token };
}

export function toUserSummary(row: UserRow): UserSummary {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    active: row.active,
    createdAt: row.created_at.toISOString(),
    lastLoginAt: iso(row.last_login_at),
  };
}

export function toSessionUser(row: UserRow): SessionUser {
  return { id: row.id, username: row.username, role: row.role as Role };
}

export function toAuditEntry(row: AuditRow): AuditLogEntry {
  return {
    id: row.id,
    username: row.username,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    outcome: row.outcome,
    ip: row.ip,
    createdAt: row.created_at.toISOString(),
    details: (row.details as Record<string, unknown> | null) ?? null,
  };
}
