import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import { logger } from '../config/logger.js';

/**
 * Contexto y bitácora HTTP. Cada respuesta lleva un identificador de
 * correlación (`X-Request-Id`) que permite reconstruir un incidente
 * (ISO 27001 A.8.15 registro de eventos, A.8.16 monitoreo).
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const payload = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip,
      username: req.user?.username ?? null,
    };
    if (res.statusCode >= 500) logger.error('http', payload);
    else if (res.statusCode >= 400) logger.warn('http', payload);
    else logger.info('http', payload);
  });

  next();
}
