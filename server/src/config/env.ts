import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { z } from 'zod';

/**
 * Configuración centralizada y validada (ISO 27001 A.8.9 gestión de
 * configuración y A.5.17 autenticación): si el entorno está mal configurado,
 * el proceso NO arranca en lugar de degradar la seguridad.
 */

// Raíz del monolito: <raíz>/server/src/config → <raíz>
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(moduleDir, '../../..');

// `.env` vive en la raíz del proyecto (compartido con docker compose).
dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), quiet: true });

const csv = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_BASE_URL: z.string().default('http://localhost:5173'),
  CORS_ORIGINS: csv.default(['http://localhost:5173']),
  WS_ALLOWED_ORIGINS: csv.default(['http://localhost:5173']),
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(1000).default(15_000),

  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default('8h'),
  SESSION_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default('sid'),

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  ADMIN_USERNAME: z.string().regex(/^[a-zA-Z0-9._-]{3,60}$/).default('admin'),
  ADMIN_PASSWORD: z.string().default('Admin2026!Cambiame'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(10).default(300),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(5),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Configuración de entorno inválida:\n${issues}\nRevise el archivo .env (guía en .env.example).`);
}

const raw = parsed.data;
const isProduction = raw.NODE_ENV === 'production';

/** Devuelve una clave efímera solo en desarrollo; en producción es obligatoria. */
function resolveJwtSecret(): { secret: string; ephemeral: boolean } {
  const provided = raw.JWT_SECRET?.trim();
  if (provided && provided.length >= 32 && !provided.startsWith('cambie-esta-clave')) {
    return { secret: provided, ephemeral: false };
  }
  if (isProduction) {
    throw new Error(
      'JWT_SECRET ausente o demasiado corto (<32 caracteres). Configure una clave aleatoria antes de desplegar (ISO 27001 A.8.24).',
    );
  }
  return { secret: randomBytes(48).toString('hex'), ephemeral: true };
}

const jwt = resolveJwtSecret();

export const config = {
  isProduction,
  isTest: raw.NODE_ENV === 'test',
  nodeEnv: raw.NODE_ENV,
  host: raw.APP_HOST,
  port: raw.PORT,
  clientBaseUrl: raw.CLIENT_BASE_URL,
  corsOrigins: raw.CORS_ORIGINS,
  wsAllowedOrigins: raw.WS_ALLOWED_ORIGINS,
  trustedProxyHops: raw.TRUSTED_PROXY_HOPS,
  databaseUrl: raw.DATABASE_URL,
  dbPoolMax: raw.DB_POOL_MAX,
  dbStatementTimeoutMs: raw.DB_STATEMENT_TIMEOUT_MS,
  jwtSecret: jwt.secret,
  jwtSecretIsEphemeral: jwt.ephemeral,
  jwtExpiresIn: raw.JWT_EXPIRES_IN,
  sessionCookieName: raw.SESSION_COOKIE_NAME,
  bcryptRounds: raw.BCRYPT_ROUNDS,
  bootstrapAdmin: { username: raw.ADMIN_USERNAME, password: raw.ADMIN_PASSWORD },
  rateLimit: {
    windowMs: raw.RATE_LIMIT_WINDOW_MS,
    max: raw.RATE_LIMIT_MAX,
    loginMax: raw.LOGIN_RATE_LIMIT_MAX,
  },
  logLevel: raw.LOG_LEVEL,
  version: '0.1.0-mvp',
} as const;

export type AppConfig = typeof config;
