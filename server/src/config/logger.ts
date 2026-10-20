import { config } from './env.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Claves cuyo valor nunca debe aparecer en la bitácora (ISO 27001 A.8.11). */
const REDACTED_KEYS = [
  'password',
  'passwordHash',
  'password_hash',
  'token',
  'tokenHash',
  'jwt',
  'authorization',
  'cookie',
  'secret',
];

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = REDACTED_KEYS.some((needle) => key.toLowerCase().includes(needle))
      ? '[REDACTADO]'
      : redact(item, depth + 1);
  }
  return output;
}

function write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[config.logLevel]) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(context ? { ctx: redact(context) as Record<string, unknown> } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

/**
 * Bitácora estructurada en JSON con redacción de datos sensibles.
 * Los eventos de seguridad relevantes se persisten además en `audit_logs`.
 */
export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => write('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
};
