import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import bcrypt from 'bcryptjs';

import { config } from '../config/env.js';

/**
 * Criptografía aplicada (ISO 27001 A.8.24):
 *  - Contraseñas: bcrypt con coste configurable (12 por defecto). Nunca reversible.
 *  - Tokens de pantalla: 32 bytes aleatorios; en la base de datos solo se
 *    guarda SHA-256 y la comparación es de tiempo constante.
 *  - Sesiones: JWT firmados con HMAC-SHA256 y clave de ≥32 caracteres.
 */
export const PASSWORD_MIN_LENGTH = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, config.bcryptRounds);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export interface ScreenToken {
  /** Token en claro: se entrega una única vez al administrador. */
  token: string;
  /** Huella almacenada en la base de datos. */
  hash: string;
}

export function generateScreenToken(): ScreenToken {
  const token = `pnt_${randomBytes(32).toString('base64url')}`;
  return { token, hash: fingerprint(token) };
}

export function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Comparación de tiempo constante para evitar ataques de temporización. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
