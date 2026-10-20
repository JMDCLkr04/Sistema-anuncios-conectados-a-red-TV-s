import type { SessionUser } from '../domain/types.js';
import * as announcementModel from '../models/announcement.model.js';
import type { AnnouncementRow, ListFilters } from '../models/announcement.model.js';
import { notFound } from '../utils/errors.js';
import type { AuditContext } from './audit.service.js';
import * as audit from './audit.service.js';
import type { CreateAnnouncementInput, UpdateAnnouncementInput } from '../validation/schemas.js';

/**
 * SERVICIO de anuncios: reglas de negocio + notificación en tiempo real.
 * Es el único punto por el que se mutan anuncios, garantizando que toda
 * escritura quede auditada y se propague por WebSocket (RFC 6455).
 */
export type Notifier = {
  publishUpsert(row: AnnouncementRow): void;
  publishRemoved(id: string): void;
  publishAuditEvent(event: { action: string; username: string | null; createdAt: string }): void;
};

/** Se inyecta desde el servidor para evitar dependencias circulares. */
let notifier: Notifier = {
  publishUpsert: () => undefined,
  publishRemoved: () => undefined,
  publishAuditEvent: () => undefined,
};

export function setNotifier(next: Notifier): void {
  notifier = next;
}

export async function list(filters: ListFilters): Promise<AnnouncementRow[]> {
  return announcementModel.list(filters);
}

export async function getById(id: string): Promise<AnnouncementRow> {
  const row = await announcementModel.findById(id);
  if (!row) throw notFound('El anuncio no existe.');
  return row;
}

export async function listActiveForScreen(screenId: string | null): Promise<AnnouncementRow[]> {
  return announcementModel.findActiveForScreen(screenId);
}

export async function create(
  input: CreateAnnouncementInput,
  actor: SessionUser,
  context: AuditContext,
): Promise<AnnouncementRow> {
  const created = await announcementModel.create({ ...input, createdBy: actor.id });
  await audit.record(context, {
    action: 'announcement.create',
    entity: 'announcement',
    entityId: created.id,
    details: { title: created.title, priority: created.priority, status: created.status },
  });
  notifier.publishUpsert(created);
  notifier.publishAuditEvent({
    action: 'announcement.create',
    username: actor.username,
    createdAt: new Date().toISOString(),
  });
  return created;
}

export async function update(
  id: string,
  input: UpdateAnnouncementInput,
  actor: SessionUser,
  context: AuditContext,
): Promise<AnnouncementRow> {
  await getById(id);
  const updated = await announcementModel.update(id, input);
  if (!updated) throw notFound('El anuncio no existe.');

  await audit.record(context, {
    action: 'announcement.update',
    entity: 'announcement',
    entityId: id,
    details: { title: updated.title, status: updated.status, priority: updated.priority },
  });
  notifier.publishUpsert(updated);
  notifier.publishAuditEvent({
    action: 'announcement.update',
    username: actor.username,
    createdAt: new Date().toISOString(),
  });
  return updated;
}

export async function remove(id: string, actor: SessionUser, context: AuditContext): Promise<void> {
  const existing = await getById(id);
  const deleted = await announcementModel.remove(id);
  if (!deleted) throw notFound('El anuncio no existe.');

  await audit.record(context, {
    action: 'announcement.delete',
    entity: 'announcement',
    entityId: id,
    details: { title: existing.title },
  });
  notifier.publishRemoved(id);
  notifier.publishAuditEvent({
    action: 'announcement.delete',
    username: actor.username,
    createdAt: new Date().toISOString(),
  });
}

/** Job periódico: expira anuncios cuya ventana terminó y avisa a las pantallas. */
export async function expireDue(): Promise<number> {
  const expired = await announcementModel.expireDue();
  for (const row of expired) notifier.publishUpsert(row);
  return expired.length;
}
