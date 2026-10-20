import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

import { config } from '../config/env.js';
import type { ApiErrorBody } from '../domain/types.js';

/**
 * Limitación de tasa (ISO 27001 A.8.7 protección contra amenazas,
 * A.8.8 gestión de vulnerabilidades técnicas): mitiga fuerza bruta,
 * enumeración de recursos y agotamiento del servidor.
 */
function rejectionBody(message: string): ApiErrorBody {
  return { error: { code: 'TOO_MANY_REQUESTS', message } };
}

const shared = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json(rejectionBody('Demasiadas solicitudes. Espere unos minutos e intente de nuevo.'));
  },
};

/** Límite general de la API. */
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  ...shared,
});

/** Límite estricto para intentos de inicio de sesión (fuerza bruta). */
export const loginLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.loginMax,
  skipSuccessfulRequests: true,
  ...shared,
  handler: (_req: Request, res: Response) => {
    res
      .status(429)
      .json(
        rejectionBody(
          'Se superó el número de intentos de inicio de sesión. La cuenta quedó protegida temporalmente.',
        ),
      );
  },
});

/** Límite para operaciones de escritura de contenido. */
export const writeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  ...shared,
  handler: (_req: Request, res: Response) => {
    res.status(429).json(rejectionBody('Ha creado o modificado contenido muy rápido. Intente en un minuto.'));
  },
});
