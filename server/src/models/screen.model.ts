import { query } from '../config/db.js';

/** MODELO de Pantalla (dispositivo de visualización en la red local). */
export interface ScreenRow {
  id: string;
  name: string;
  location: string;
  token_hash: string;
  active: boolean;
  last_seen_at: Date | null;
  created_at: Date;
  published_count: string;
}

const SELECT_COLUMNS = `
  s.id, s.name, s.location, s.token_hash, s.active, s.last_seen_at, s.created_at,
  (SELECT count(*)
     FROM announcements a
    WHERE a.status = 'published'
      AND (
        NOT EXISTS (SELECT 1 FROM announcement_screens sa WHERE sa.announcement_id = a.id)
        OR EXISTS (SELECT 1 FROM announcement_screens sa WHERE sa.announcement_id = a.id AND sa.screen_id = s.id)
      )
  ) AS published_count
`;

export async function list(): Promise<ScreenRow[]> {
  const { rows } = await query<ScreenRow>(
    `SELECT ${SELECT_COLUMNS} FROM screens s ORDER BY s.name`,
  );
  return rows;
}

export async function findById(id: string): Promise<ScreenRow | null> {
  const { rows } = await query<ScreenRow>(
    `SELECT ${SELECT_COLUMNS} FROM screens s WHERE s.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function findByTokenHash(tokenHash: string): Promise<ScreenRow | null> {
  const { rows } = await query<ScreenRow>(
    `SELECT ${SELECT_COLUMNS} FROM screens s WHERE s.token_hash = $1 AND s.active = TRUE`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

export async function create(input: {
  name: string;
  location: string;
  tokenHash: string;
  active?: boolean;
}): Promise<ScreenRow> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO screens (name, location, token_hash, active)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [input.name, input.location, input.tokenHash, input.active ?? true],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error('No se pudo registrar la pantalla.');
  const created = await findById(id);
  if (!created) throw new Error('No se pudo leer la pantalla recién creada.');
  return created;
}

export async function update(
  id: string,
  changes: { name?: string; location?: string; active?: boolean; tokenHash?: string },
): Promise<ScreenRow | null> {
  const { rowCount } = await query(
    `UPDATE screens
        SET name       = COALESCE($2, name),
            location   = COALESCE($3, location),
            active     = COALESCE($4, active),
            token_hash = COALESCE($5, token_hash)
      WHERE id = $1`,
    [id, changes.name ?? null, changes.location ?? null, changes.active ?? null, changes.tokenHash ?? null],
  );
  if ((rowCount ?? 0) === 0) return null;
  return findById(id);
}

export async function remove(id: string): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM screens WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

/** Registra el último contacto del dispositivo (útil para monitoreo, ISO 27001 A.8.16). */
export async function touchLastSeen(id: string): Promise<Date | null> {
  const { rows } = await query<{ last_seen_at: Date }>(
    `UPDATE screens SET last_seen_at = now() WHERE id = $1 RETURNING last_seen_at`,
    [id],
  );
  return rows[0]?.last_seen_at ?? null;
}
