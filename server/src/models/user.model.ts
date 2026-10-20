import { query } from '../config/db.js';
import type { Role } from '../domain/types.js';

/**
 * MODELO de Usuario — única capa que conoce el SQL de `users`.
 * Los controladores nunca escriben SQL: sólo invocan estos métodos.
 */
export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: Role;
  active: boolean;
  created_at: Date;
  last_login_at: Date | null;
}

export async function findByUsername(username: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
    `SELECT id, username, password_hash, role, active, created_at, last_login_at
       FROM users
      WHERE lower(username) = lower($1)
      LIMIT 1`,
    [username],
  );
  return rows[0] ?? null;
}

export async function findById(id: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
    `SELECT id, username, password_hash, role, active, created_at, last_login_at
       FROM users
      WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function list(): Promise<UserRow[]> {
  const { rows } = await query<UserRow>(
    `SELECT id, username, password_hash, role, active, created_at, last_login_at
       FROM users
      ORDER BY role, username`,
  );
  return rows;
}

export async function create(input: {
  username: string;
  passwordHash: string;
  role: Role;
  active?: boolean;
}): Promise<UserRow> {
  const { rows } = await query<UserRow>(
    `INSERT INTO users (username, password_hash, role, active)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, password_hash, role, active, created_at, last_login_at`,
    [input.username, input.passwordHash, input.role, input.active ?? true],
  );
  const created = rows[0];
  if (!created) throw new Error('No se pudo crear el usuario.');
  return created;
}

export async function update(
  id: string,
  changes: { role?: Role; active?: boolean; passwordHash?: string },
): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
    `UPDATE users
        SET role          = COALESCE($2, role),
            active        = COALESCE($3, active),
            password_hash = COALESCE($4, password_hash)
      WHERE id = $1
      RETURNING id, username, password_hash, role, active, created_at, last_login_at`,
    [id, changes.role ?? null, changes.active ?? null, changes.passwordHash ?? null],
  );
  return rows[0] ?? null;
}

export async function touchLastLogin(id: string): Promise<void> {
  await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [id]);
}

export async function remove(id: string): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM users WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

/** Nº de administradores activos: evita quedarse sin control de acceso. */
export async function countActiveAdmins(): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM users WHERE role = 'admin' AND active = TRUE`,
  );
  return Number(rows[0]?.count ?? '0');
}
