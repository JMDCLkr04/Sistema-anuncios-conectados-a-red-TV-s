import type { CookieOptions, Request, Response } from 'express';

import { config } from '../config/env.js';
import type { AuthResponse } from '../domain/types.js';
import * as authService from '../services/auth.service.js';
import * as auditService from '../services/audit.service.js';
import { toAuditEntry, toUserSummary } from '../views/presenters.js';
import * as auditModel from '../models/audit.model.js';

/**
 * CONTROLADOR de autenticación y cuentas.
 * Traduce HTTP ⇄ servicio; no contiene reglas de negocio ni SQL (MVC).
 */
function cookieOptions(): CookieOptions {
  return {
    httpOnly: true, // inaccesible para JavaScript: mitiga XSS (ISO 27001 A.8.28)
    secure: config.isProduction, // obligatorio HTTPS en producción (A.8.24)
    sameSite: 'strict', // mitiga CSRF (A.8.26)
    path: '/',
    maxAge: authService.sessionExpiresInSeconds() * 1000,
  };
}

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body as { username: string; password: string };
  const context = auditService.contextFromRequest(req);

  const result = await authService.login({ username, password }, context);

  res.cookie(config.sessionCookieName, result.token, cookieOptions());

  const body: AuthResponse = {
    user: result.user,
    token: result.token,
    expiresInSeconds: result.expiresInSeconds,
  };
  res.status(200).json(body);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const context = auditService.contextFromRequest(req);
  res.clearCookie(config.sessionCookieName, { path: '/' });
  await authService.logout(context);
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No hay sesión activa.' } });
    return;
  }
  res.status(200).json({ user: await authService.getProfile(user.id) });
}

/* ------------------------------- Cuentas ------------------------------- */

export async function listUsers(_req: Request, res: Response): Promise<void> {
  const users = await authService.listUsers();
  res.status(200).json({ users: users.map(toUserSummary) });
}

export async function createUser(req: Request, res: Response): Promise<void> {
  const context = auditService.contextFromRequest(req);
  const created = await authService.createUser(req.body, context);
  res.status(201).json({ user: toUserSummary(created) });
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const context = auditService.contextFromRequest(req);
  const updated = await authService.updateUser(String(req.params.id), req.body, context);
  res.status(200).json({ user: toUserSummary(updated) });
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  const context = auditService.contextFromRequest(req);
  await authService.deleteUser(String(req.params.id), context);
  res.status(204).send();
}

/** Bitácora para el panel administrativo (ISO 27001 A.8.15 / A.8.16). */
export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  const requested = Number(req.query.limit ?? 100);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 500) : 100;
  const rows = await auditModel.list(limit);
  res.status(200).json({ entries: rows.map(toAuditEntry) });
}
