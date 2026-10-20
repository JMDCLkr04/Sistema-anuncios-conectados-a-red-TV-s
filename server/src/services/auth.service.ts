import jwt from 'jsonwebtoken';

import { config } from '../config/env.js';
import type { Role, SessionUser } from '../domain/types.js';
import * as userModel from '../models/user.model.js';
import { conflict, forbidden, notFound, unauthorized } from '../utils/errors.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import type { AuditContext } from './audit.service.js';
import * as audit from './audit.service.js';
import type { CreateUserInput, UpdateUserInput } from '../validation/schemas.js';

/**
 * SERVICIO de identidad y acceso.
 * ISO 27001 A.5.15 control de acceso, A.5.16 gestión de identidades,
 * A.5.17 información de autenticación, A.5.18 derechos de acceso,
 * A.8.2 acceso privilegiado, A.8.5 autenticación segura.
 */
export interface SessionTokenPayload {
  sub: string;
  username: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface LoginResult {
  user: SessionUser;
  token: string;
  expiresInSeconds: number;
}

export async function login(
  credentials: { username: string; password: string },
  context: AuditContext,
): Promise<LoginResult> {
  const user = await userModel.findByUsername(credentials.username);

  // Mensaje genérico + verificación de hash aunque el usuario no exista:
  // evita enumeración de cuentas y ataques de temporización.
  const hash = user?.password_hash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const passwordOk = await verifyPassword(credentials.password, hash);

  if (!user || !passwordOk) {
    await audit.record(
      { ...context, userId: user?.id ?? null, username: user?.username ?? credentials.username },
      {
        action: 'auth.login',
        entity: 'user',
        entityId: user?.id ?? null,
        outcome: 'failure',
        details: { reason: user ? 'password_invalido' : 'usuario_inexistente' },
      },
    );
    throw unauthorized('Usuario o contraseña incorrectos.');
  }

  if (!user.active) {
    await audit.record(
      { ...context, userId: user.id, username: user.username },
      { action: 'auth.login', entity: 'user', entityId: user.id, outcome: 'failure', details: { reason: 'cuenta_inactiva' } },
    );
    throw forbidden('La cuenta está deshabilitada. Contacte al administrador.');
  }

  const token = signSessionToken({ id: user.id, username: user.username, role: user.role });
  await userModel.touchLastLogin(user.id);
  await audit.record(
    { ...context, userId: user.id, username: user.username },
    { action: 'auth.login', entity: 'user', entityId: user.id, outcome: 'success', details: { role: user.role } },
  );

  return {
    user: { id: user.id, username: user.username, role: user.role },
    token,
    expiresInSeconds: sessionExpiresInSeconds(),
  };
}

export async function logout(context: AuditContext): Promise<void> {
  await audit.record(context, { action: 'auth.logout', entity: 'user', entityId: context.userId ?? null });
}

export function signSessionToken(user: SessionUser): string {
  return jwt.sign({ sub: user.id, username: user.username, role: user.role }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    issuer: 'anuncios-mvp',
    audience: 'pantallas-lan',
  });
}

export function sessionExpiresInSeconds(): number {
  const decoded = jwt.decode(
    jwt.sign({ sub: 'probe', username: 'probe', role: 'client' }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    }),
  ) as { exp?: number; iat?: number } | null;
  if (decoded?.exp && decoded.iat) return decoded.exp - decoded.iat;
  return 8 * 3600;
}

export function verifySessionToken(token: string): SessionTokenPayload {
  try {
    const payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'anuncios-mvp',
      audience: 'pantallas-lan',
    });
    if (typeof payload === 'string') throw unauthorized();
    const { sub, username, role } = payload as jwt.JwtPayload;
    if (typeof sub !== 'string' || typeof username !== 'string') throw unauthorized();
    if (role !== 'admin' && role !== 'client') throw unauthorized();
    return { sub, username, role };
  } catch {
    throw unauthorized('Sesión inválida o expirada.');
  }
}

export async function getProfile(userId: string): Promise<SessionUser> {
  const row = await userModel.findById(userId);
  if (!row || !row.active) throw unauthorized('La sesión ya no es válida.');
  return { id: row.id, username: row.username, role: row.role };
}

export async function listUsers() {
  const rows = await userModel.list();
  return rows;
}

export async function createUser(input: CreateUserInput, context: AuditContext) {
  const existing = await userModel.findByUsername(input.username);
  if (existing) throw conflict('Ya existe una cuenta con ese nombre de usuario.');

  const created = await userModel.create({
    username: input.username,
    passwordHash: await hashPassword(input.password),
    role: input.role as Role,
    active: input.active,
  });

  await audit.record(context, {
    action: 'user.create',
    entity: 'user',
    entityId: created.id,
    details: { username: created.username, role: created.role },
  });
  return created;
}

export async function updateUser(id: string, input: UpdateUserInput, context: AuditContext) {
  const target = await userModel.findById(id);
  if (!target) throw notFound('La cuenta no existe.');

  const isDemotingOrDisabling =
    (input.role !== undefined && input.role !== 'admin' && target.role === 'admin') ||
    (input.active === false && target.role === 'admin');
  if (isDemotingOrDisabling && (await userModel.countActiveAdmins()) <= 1) {
    throw conflict('No es posible dejar el sistema sin administradores activos.');
  }

  const updated = await userModel.update(id, {
    role: input.role as Role | undefined,
    active: input.active,
    passwordHash: input.password ? await hashPassword(input.password) : undefined,
  });
  if (!updated) throw notFound('La cuenta no existe.');

  await audit.record(context, {
    action: 'user.update',
    entity: 'user',
    entityId: id,
    details: {
      role: input.role ?? null,
      active: input.active ?? null,
      passwordChanged: Boolean(input.password),
    },
  });
  return updated;
}

export async function deleteUser(id: string, context: AuditContext): Promise<void> {
  const target = await userModel.findById(id);
  if (!target) throw notFound('La cuenta no existe.');
  if (target.role === 'admin' && (await userModel.countActiveAdmins()) <= 1) {
    throw conflict('No es posible eliminar al último administrador activo.');
  }
  await userModel.remove(id);
  await audit.record(context, {
    action: 'user.delete',
    entity: 'user',
    entityId: id,
    details: { username: target.username },
  });
}
