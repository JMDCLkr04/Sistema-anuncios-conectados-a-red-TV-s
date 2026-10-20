import pg from 'pg';

import { config } from './env.js';
import { logger } from './logger.js';

/**
 * Capa de conexión a PostgreSQL (infraestructura compartida por los modelos).
 * Buenas prácticas aplicadas: pool acotado, tiempo máximo de sentencia,
 * `application_name` identificable y errores nunca silenciados.
 */
const { Pool } = pg;

// `BIGSERIAL` (id de bitácora) se entrega como string para no perder precisión.
pg.types.setTypeParser(20, (value) => value);

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: 'anuncios-mvp',
  statement_timeout: config.dbStatementTimeoutMs,
  query_timeout: config.dbStatementTimeoutMs,
});

pool.on('error', (error) => {
  logger.error('Error inesperado en un cliente del pool de PostgreSQL', {
    error: error.message,
    code: (error as { code?: string }).code,
  });
});

export type QueryParams = readonly unknown[];

/** Ejecuta una consulta parametrizada (nunca se concatenan valores en SQL). */
export async function query<T extends pg.QueryResultRow>(
  text: string,
  params: QueryParams = [],
): Promise<pg.QueryResult<T>> {
  const startedAt = Date.now();
  try {
    return await pool.query<T>(text, params as unknown[]);
  } catch (error) {
    logger.error('Fallo la consulta SQL', {
      sql: text.split('\n')[0]?.trim(),
      params,
      durationMs: Date.now() - startedAt,
      error: (error as Error).message,
    });
    throw error;
  }
}

/** Ejecuta varias sentencias dentro de una transacción (todo o nada). */
export async function withTransaction<T>(
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function pingDatabase(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
