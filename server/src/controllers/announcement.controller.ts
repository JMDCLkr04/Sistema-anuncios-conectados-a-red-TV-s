import type { Request, Response } from 'express';

import type { Announcement } from '../domain/types.js';
import * as announcementService from '../services/announcement.service.js';
import * as auditService from '../services/audit.service.js';
import type { CreateAnnouncementInput, ListQuery, UpdateAnnouncementInput } from '../validation/schemas.js';
import { toAnnouncement } from '../views/presenters.js';
import { forbidden } from '../utils/errors.js';

/**
 * CONTROLADOR de anuncios. `admin` administra el ciclo completo; `client`
 * únicamente puede leer lo publicado (ISO 27001 A.5.15 / A.8.3).
 */
function requireActor(req: Request) {
  if (!req.user) throw forbidden('Se requiere una sesión activa.');
  return req.user;
}

export async function list(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  const filters = (res.locals.query ?? {}) as ListQuery;

  if (actor.role === 'client') {
    // El observador nunca recibe borradores ni anuncios fuera de ventana.
    const rows = await announcementService.listActiveForScreen(null);
    const body: Announcement[] = rows.map(toAnnouncement);
    res.status(200).json({ announcements: body, scope: 'published' });
    return;
  }

  const rows = await announcementService.list({
    status: filters.status,
    priority: filters.priority,
    search: filters.search,
    limit: filters.limit ?? 100,
  });
  res.status(200).json({ announcements: rows.map(toAnnouncement), scope: 'all' });
}

/** Feed vigente: usado por visores y pantallas (datos no sensibles). */
export async function listActive(_req: Request, res: Response): Promise<void> {
  // Si quien consulta es una pantalla, se respeta la asignación por pantalla.
  const screen = res.locals.screen as { id: string; name: string } | undefined;
  const rows = await announcementService.listActiveForScreen(screen?.id ?? null);
  res.status(200).json({
    announcements: rows.map(toAnnouncement),
    serverTime: new Date().toISOString(),
  });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const row = await announcementService.getById(String(req.params.id));
  if (req.user?.role === 'client' && row.status !== 'published') {
    throw forbidden('Sólo puede consultar anuncios publicados.');
  }
  res.status(200).json({ announcement: toAnnouncement(row) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  const context = auditService.contextFromRequest(req);
  const created = await announcementService.create(req.body as CreateAnnouncementInput, actor, context);
  res.status(201).json({ announcement: toAnnouncement(created) });
}

export async function update(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  const context = auditService.contextFromRequest(req);
  const updated = await announcementService.update(
    String(req.params.id),
    req.body as UpdateAnnouncementInput,
    actor,
    context,
  );
  res.status(200).json({ announcement: toAnnouncement(updated) });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  const context = auditService.contextFromRequest(req);
  await announcementService.remove(String(req.params.id), actor, context);
  res.status(204).send();
}
