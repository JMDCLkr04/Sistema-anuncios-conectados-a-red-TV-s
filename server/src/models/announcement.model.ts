import type { PoolClient } from 'pg';

import { query, withTransaction } from '../config/db.js';
import type { AnnouncementStatus, Priority } from '../domain/types.js';

/**
 * MODELO de Anuncio. Incluye la relación N:M con pantallas, donde la ausencia
 * de filas en `announcement_screens` significa "emitir en todas las pantallas".
 */
export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  priority: Priority;
  status: AnnouncementStatus;
  starts_at: Date | null;
  ends_at: Date | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: Date;
  updated_at: Date;
  screen_ids: string[] | null;
}

const SELECT_COLUMNS = `
  a.id, a.title, a.body, a.priority, a.status, a.starts_at, a.ends_at,
  a.created_by, u.username AS created_by_name, a.created_at, a.updated_at,
  COALESCE(
    (SELECT array_agg(sa.screen_id::text ORDER BY sa.screen_id)
       FROM announcement_screens sa
      WHERE sa.announcement_id = a.id),
    ARRAY[]::text[]
  ) AS screen_ids
`;

const SELECT_BY_ID = `
  SELECT ${SELECT_COLUMNS}
    FROM announcements a
    LEFT JOIN users u ON u.id = a.created_by
   WHERE a.id = $1
`;

export interface ListFilters {
  status?: AnnouncementStatus;
  priority?: Priority;
  search?: string;
  limit?: number;
}

export async function list(filters: ListFilters = {}): Promise<AnnouncementRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`a.status = $${params.length}`);
  }
  if (filters.priority) {
    params.push(filters.priority);
    conditions.push(`a.priority = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(`(a.title ILIKE $${params.length} OR a.body ILIKE $${params.length})`);
  }

  params.push(filters.limit ?? 100);

  const { rows } = await query<AnnouncementRow>(
    `SELECT ${SELECT_COLUMNS}
       FROM announcements a
       LEFT JOIN users u ON u.id = a.created_by
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY
        CASE a.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
        a.created_at DESC
      LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export async function findById(id: string): Promise<AnnouncementRow | null> {
  const { rows } = await query<AnnouncementRow>(SELECT_BY_ID, [id]);
  return rows[0] ?? null;
}

/**
 * Igual que `findById`, pero sobre una conexión concreta. Necesario para leer
 * de vuelta dentro de la MISMA transacción que escribió: otra conexión no vería
 * las filas aún no confirmadas (READ COMMITTED).
 */
async function findByIdOn(client: PoolClient, id: string): Promise<AnnouncementRow | null> {
  const { rows } = await client.query<AnnouncementRow>(SELECT_BY_ID, [id]);
  return rows[0] ?? null;
}

/** Anuncios vigentes para una pantalla (o para todas, si `screenId` es null). */
export async function findActiveForScreen(screenId: string | null): Promise<AnnouncementRow[]> {
  const { rows } = await query<AnnouncementRow>(
    `SELECT ${SELECT_COLUMNS}
       FROM announcements a
       LEFT JOIN users u ON u.id = a.created_by
      WHERE a.status = 'published'
        AND (a.starts_at IS NULL OR a.starts_at <= now())
        AND (a.ends_at   IS NULL OR a.ends_at   >  now())
        AND (
          $1::uuid IS NULL
          OR NOT EXISTS (SELECT 1 FROM announcement_screens sa WHERE sa.announcement_id = a.id)
          OR EXISTS (
               SELECT 1 FROM announcement_screens sa
                WHERE sa.announcement_id = a.id AND sa.screen_id = $1::uuid
             )
        )
      ORDER BY
        CASE a.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
        a.created_at DESC`,
    [screenId],
  );
  return rows;
}

export interface CreateAnnouncementData {
  title: string;
  body: string;
  priority: Priority;
  status: AnnouncementStatus;
  startsAt: string | null;
  endsAt: string | null;
  screenIds: string[];
  allScreens: boolean;
  createdBy: string | null;
}

export async function create(data: CreateAnnouncementData): Promise<AnnouncementRow> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO announcements (title, body, priority, status, starts_at, ends_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        data.title,
        data.body,
        data.priority,
        data.status,
        data.startsAt,
        data.endsAt,
        data.createdBy,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('No se pudo crear el anuncio.');
    if (!data.allScreens) await replaceScreens(client, id, data.screenIds);
    const created = await findByIdOn(client, id);
    if (!created) throw new Error('No se pudo leer el anuncio recién creado.');
    return created;
  });
}

export interface UpdateAnnouncementData {
  title?: string;
  body?: string;
  priority?: Priority;
  status?: AnnouncementStatus;
  startsAt?: string | null;
  endsAt?: string | null;
  screenIds?: string[];
  allScreens?: boolean;
}

export async function update(id: string, changes: UpdateAnnouncementData): Promise<AnnouncementRow | null> {
  return withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE announcements
          SET title     = COALESCE($2, title),
              body      = COALESCE($3, body),
              priority  = COALESCE($4, priority),
              status    = COALESCE($5, status),
              starts_at = CASE WHEN $6::boolean THEN $7::timestamptz ELSE starts_at END,
              ends_at   = CASE WHEN $8::boolean THEN $9::timestamptz ELSE ends_at END
        WHERE id = $1`,
      [
        id,
        changes.title ?? null,
        changes.body ?? null,
        changes.priority ?? null,
        changes.status ?? null,
        changes.startsAt !== undefined,
        changes.startsAt ?? null,
        changes.endsAt !== undefined,
        changes.endsAt ?? null,
      ],
    );
    if ((rowCount ?? 0) === 0) return null;

    if (changes.allScreens === true) {
      await replaceScreens(client, id, []);
    } else if (changes.screenIds !== undefined) {
      await replaceScreens(client, id, changes.screenIds);
    }
    return findByIdOn(client, id);
  });
}

export async function remove(id: string): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM announcements WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

/** Marca como `expired` los anuncios cuya ventana ya terminó. Devuelve los afectados. */
export async function expireDue(): Promise<AnnouncementRow[]> {
  const { rows } = await query<{ id: string }>(
    `UPDATE announcements
        SET status = 'expired'
      WHERE status = 'published'
        AND ends_at IS NOT NULL
        AND ends_at <= now()
      RETURNING id`,
  );
  if (rows.length === 0) return [];
  const expired = await Promise.all(rows.map((row) => findById(row.id)));
  return expired.filter((row): row is AnnouncementRow => row !== null);
}

async function replaceScreens(client: PoolClient, announcementId: string, screenIds: string[]): Promise<void> {
  await client.query(`DELETE FROM announcement_screens WHERE announcement_id = $1`, [announcementId]);
  const unique = [...new Set(screenIds)];
  if (unique.length === 0) return;
  await client.query(
    `INSERT INTO announcement_screens (announcement_id, screen_id)
     SELECT $1, s.id
       FROM screens s
      WHERE s.id = ANY($2::uuid[])
     ON CONFLICT DO NOTHING`,
    [announcementId, unique],
  );
}
