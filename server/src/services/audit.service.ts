import type { Request } from 'express';

import * as auditModel from '../models/audit.model.js';
import { logger } from '../config/logger.js';
import { normalizeIp } from '../utils/network.js';

/**
 * SERVICIO de auditoría: centraliza la escritura de la bitácora para que los
 * controladores no repitan código y ningún evento relevante se olvide.
 * ISO 27001 A.8.15 (registro de eventos) y A.8.16 (actividades de monitoreo).
 */
export interface AuditContext {
  userId?: string | null;
  username?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export function contextFromRequest(req: Request): AuditContext {
  return {
    userId: req.user?.id ?? null,
    username: req.user?.username ?? null,
    ip: normalizeIp(req.ip ?? req.socket.remoteAddress),
    userAgent: req.get('user-agent') ?? null,
  };
}

export async function record(
  context: AuditContext,
  event: {
    action: string;
    entity?: string;
    entityId?: string | null;
    outcome?: 'success' | 'failure';
    details?: Record<string, unknown> | null;
  },
): Promise<void> {
  const entry = {
    userId: context.userId ?? null,
    username: context.username ?? null,
    ip: context.ip ?? null,
    userAgent: context.userAgent ?? null,
    action: event.action,
    entity: event.entity ?? null,
    entityId: event.entityId ?? null,
    outcome: event.outcome ?? 'success',
    details: event.details ?? null,
  };

  logger.info(`audit:${event.action}`, {
    username: entry.username,
    entity: entry.entity,
    entityId: entry.entityId,
    outcome: entry.outcome,
    ip: entry.ip,
  });

  try {
    await auditModel.insert(entry);
  } catch (error) {
    // La bitácora nunca debe tumbar la operación de negocio, pero sí gritar.
    logger.error('No se pudo persistir el evento de auditoría', {
      action: event.action,
      error: (error as Error).message,
    });
  }
}
