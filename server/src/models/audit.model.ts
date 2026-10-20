import { query } from '../config/db.js';

/**
 * MODELO de Bitácora. Solo inserción y consulta: la aplicación nunca borra ni
 * modifica eventos (ISO 27001 A.8.15 registro de eventos, A.5.33 protección de
 * los registros).
 */
export interface AuditRow {
  id: string;
  user_id: string | null;
  username: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  outcome: 'success' | 'failure';
  ip: string | null;
  created_at: Date;
  details: unknown;
}

export interface AuditInput {
  userId?: string | null;
  username?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  outcome?: 'success' | 'failure';
  ip?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | null;
}

export async function insert(input: AuditInput): Promise<void> {
  await query(
    `INSERT INTO audit_logs (user_id, username, action, entity, entity_id, outcome, ip, user_agent, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.userId ?? null,
      input.username ?? null,
      input.action,
      input.entity ?? null,
      input.entityId ?? null,
      input.outcome ?? 'success',
      input.ip ?? null,
      input.userAgent?.slice(0, 300) ?? null,
      input.details ? JSON.stringify(input.details) : null,
    ],
  );
}

export async function list(limit = 100): Promise<AuditRow[]> {
  const { rows } = await query<AuditRow>(
    `SELECT id::text, user_id, username, action, entity, entity_id, outcome, ip::text AS ip, created_at, details
       FROM audit_logs
      ORDER BY created_at DESC, audit_logs.id DESC
      LIMIT $1`,
    [Math.min(Math.max(limit, 1), 500)],
  );
  return rows;
}
