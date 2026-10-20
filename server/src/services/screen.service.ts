import type { SessionUser } from '../domain/types.js';
import * as screenModel from '../models/screen.model.js';
import type { ScreenRow } from '../models/screen.model.js';
import { notFound, unauthorized } from '../utils/errors.js';
import { fingerprint, generateScreenToken, safeEqual } from '../utils/crypto.js';
import type { AuditContext } from './audit.service.js';
import * as audit from './audit.service.js';
import type { ScreenInput } from '../validation/schemas.js';

/**
 * SERVICIO de pantallas: alta de dispositivos, rotación de credenciales y
 * autenticación del WebSocket de cada pantalla.
 *
 * El token viaja en la URL de conexión; por eso se almacena únicamente su
 * huella SHA-256 y se compara en tiempo constante (ISO 27001 A.8.24, A.8.5).
 */
export async function list(): Promise<ScreenRow[]> {
  return screenModel.list();
}

export async function getById(id: string): Promise<ScreenRow> {
  const row = await screenModel.findById(id);
  if (!row) throw notFound('La pantalla no existe.');
  return row;
}

export async function create(
  input: ScreenInput,
  actor: SessionUser,
  context: AuditContext,
): Promise<{ row: ScreenRow; token: string }> {
  const { token, hash } = generateScreenToken();
  const row = await screenModel.create({
    name: input.name,
    location: input.location,
    tokenHash: hash,
    active: input.active,
  });

  await audit.record(context, {
    action: 'screen.create',
    entity: 'screen',
    entityId: row.id,
    details: { name: row.name, location: row.location, actor: actor.username },
  });
  return { row, token };
}

export async function update(
  id: string,
  input: Partial<ScreenInput>,
  actor: SessionUser,
  context: AuditContext,
): Promise<ScreenRow> {
  await getById(id);
  const updated = await screenModel.update(id, {
    name: input.name,
    location: input.location,
    active: input.active,
  });
  if (!updated) throw notFound('La pantalla no existe.');

  await audit.record(context, {
    action: 'screen.update',
    entity: 'screen',
    entityId: id,
    details: { name: updated.name, active: updated.active, actor: actor.username },
  });
  return updated;
}

export async function remove(id: string, actor: SessionUser, context: AuditContext): Promise<void> {
  const existing = await getById(id);
  const deleted = await screenModel.remove(id);
  if (!deleted) throw notFound('La pantalla no existe.');

  await audit.record(context, {
    action: 'screen.delete',
    entity: 'screen',
    entityId: id,
    details: { name: existing.name, actor: actor.username },
  });
}

/** Emite un token nuevo e invalida el anterior (respuesta a incidentes). */
export async function rotateToken(
  id: string,
  actor: SessionUser,
  context: AuditContext,
): Promise<{ row: ScreenRow; token: string }> {
  await getById(id);
  const { token, hash } = generateScreenToken();
  const row = await screenModel.update(id, { tokenHash: hash });
  if (!row) throw notFound('La pantalla no existe.');

  await audit.record(context, {
    action: 'screen.rotate_token',
    entity: 'screen',
    entityId: id,
    details: { actor: actor.username },
  });
  return { row, token };
}

/** Autentica un token de pantalla presentado en el handshake del WebSocket. */
export async function authenticateToken(token: string): Promise<ScreenRow> {
  if (!token.startsWith('pnt_')) throw unauthorized('Token de pantalla con formato inválido.');
  const row = await screenModel.findByTokenHash(fingerprint(token));
  if (!row) throw unauthorized('Token de pantalla inválido, revocado o pantalla inactiva.');
  if (!safeEqual(row.token_hash, fingerprint(token))) {
    throw unauthorized('Token de pantalla inválido.');
  }
  return row;
}

export async function markSeen(id: string): Promise<string> {
  const seen = await screenModel.touchLastSeen(id);
  return (seen ?? new Date()).toISOString();
}
