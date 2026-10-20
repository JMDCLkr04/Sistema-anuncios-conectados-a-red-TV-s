import type { NextFunction, Request, Response } from 'express';

import { config } from '../config/env.js';
import type { Role, SessionUser } from '../domain/types.js';
import * as userModel from '../models/user.model.js';
import { forbidden, unauthorized } from '../utils/errors.js';
import { isPrivateAddress, normalizeIp } from '../utils/network.js';
import { verifySessionToken } from '../services/auth.service.js';
import * as screenService from '../services/screen.service.js';

/**
 * Middlewares de control de acceso (ISO 27001 A.5.15, A.5.18, A.8.3).
 * Principio de "denegar por defecto": toda ruta protegida exige sesión válida.
 */

function extractToken(req: Request): string | null {
  const header = req.get('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  const cookie = (req.cookies as Record<string, string> | undefined)?.[config.sessionCookieName];
  return cookie ?? null;
}

/** Verifica la sesión y confirma contra la base de datos que sigue vigente. */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) throw unauthorized('Se requiere iniciar sesión.');

    const payload = verifySessionToken(token);
    const row = await userModel.findById(payload.sub);
    // Se consulta la base de datos en cada petición para que deshabilitar una
    // cuenta revoque el acceso de inmediato (revocación efectiva de derechos).
    if (!row || !row.active) throw unauthorized('La cuenta ya no está activa.');
    if (row.role !== payload.role) throw unauthorized('La sesión cambió de rol. Vuelva a iniciar sesión.');

    req.user = { id: row.id, username: row.username, role: row.role } satisfies SessionUser;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Autenticación del feed de solo lectura: acepta la sesión del navegador
 * (`admin`/`client`) o el token propio de una pantalla (`?token=pnt_…`), que
 * no dispone de cookie. La identidad de la pantalla queda en `res.locals.screen`.
 */
export async function authenticateScreenOrUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const queryToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    if (queryToken.startsWith('pnt_')) {
      const screen = await screenService.authenticateToken(queryToken);
      res.locals.screen = { id: screen.id, name: screen.name };
      next();
      return;
    }
    await authenticate(req, res, next);
  } catch (error) {
    next(error);
  }
}

/** Autorización por rol. `client` nunca alcanza rutas de administración. */
export function requireRole(...roles: readonly Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized('Se requiere iniciar sesión.'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(forbidden('Su rol no permite ejecutar esta acción.'));
      return;
    }
    next();
  };
}

/**
 * Restringe la operación al espacio de direcciones privadas (RFC 1918).
 * Se aplica a acciones que sólo tienen sentido dentro de la red local, como el
 * alta de pantallas: una pantalla no debe registrarse desde Internet.
 */
export function requirePrivateNetwork(req: Request, _res: Response, next: NextFunction): void {
  const ip = normalizeIp(req.ip ?? req.socket.remoteAddress);
  if (!isPrivateAddress(ip)) {
    next(
      forbidden(
        `Operación permitida solo desde la red local (RFC 1918). Origen detectado: ${ip ?? 'desconocido'}.`,
      ),
    );
    return;
  }
  next();
}
