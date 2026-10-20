import type { Request, Response } from 'express';

import * as screenService from '../services/screen.service.js';
import * as auditService from '../services/audit.service.js';
import { toScreen, toScreenWithToken } from '../views/presenters.js';
import * as hub from '../websocket/hub.js';
import { forbidden, internal } from '../utils/errors.js';
import { config } from '../config/env.js';

/**
 * CONTROLADOR de pantallas. Todas las rutas son de administración y quedan
 * limitadas a la red local (RFC 1918) por el middleware `requirePrivateNetwork`.
 */
function requireActor(req: Request) {
  if (!req.user) throw forbidden('Se requiere una sesión activa.');
  return req.user;
}

export async function list(_req: Request, res: Response): Promise<void> {
  const rows = await screenService.list();
  res.status(200).json({
    screens: rows.map(toScreen),
    connectedScreenIds: hub.connectedScreenIds(),
  });
}

export async function create(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  const context = auditService.contextFromRequest(req);
  const { row, token } = await screenService.create(req.body, actor, context);

  hub.notifyScreensChanged();
  // El token se muestra una única vez; el servidor guarda sólo su hash.
  res.status(201).json({
    screen: toScreenWithToken(row, token),
    connectionHint: buildConnectionHint(token),
  });
}

export async function update(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  const context = auditService.contextFromRequest(req);
  const updated = await screenService.update(String(req.params.id), req.body, actor, context);
  hub.notifyScreensChanged();
  res.status(200).json({ screen: toScreen(updated) });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  const context = auditService.contextFromRequest(req);
  await screenService.remove(String(req.params.id), actor, context);
  hub.notifyScreensChanged();
  res.status(204).send();
}

/** Rotación de credenciales: invalida el token anterior de inmediato. */
export async function rotateToken(req: Request, res: Response): Promise<void> {
  const actor = requireActor(req);
  const context = auditService.contextFromRequest(req);
  const { row, token } = await screenService.rotateToken(String(req.params.id), actor, context);
  hub.notifyScreensChanged();
  res.status(200).json({
    screen: toScreenWithToken(row, token),
    connectionHint: buildConnectionHint(token),
  });
}

/** Enlace que se abre en el dispositivo/pantalla dentro de la LAN. */
function buildConnectionHint(token: string): string {
  const base = config.clientBaseUrl.replace(/\/$/, '');
  if (!base) throw internal('CLIENT_BASE_URL no está configurada.');
  return `${base}/pantalla/${encodeURIComponent(token)}`;
}
