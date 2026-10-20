import { ZodError } from 'zod';
import type { NextFunction, Request, Response } from 'express';

import { logger } from '../config/logger.js';
import type { ApiErrorBody } from '../domain/types.js';
import { AppError, notFound } from '../utils/errors.js';
import { toFieldErrors } from '../validation/schemas.js';

/** 404 uniforme para rutas no registradas. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(notFound(`No existe la ruta ${req.method} ${req.originalUrl}.`));
}

/**
 * Manejador central de errores.
 * Nunca filtra trazas ni detalles del motor de base de datos al cliente
 * (ISO 27001 A.8.8, A.8.15); todo detalle queda en la bitácora del servidor.
 */
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;

  if (error instanceof ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Revise los datos ingresados.',
        fields: toFieldErrors(error),
      },
    };
    res.status(400).json(body);
    return;
  }

  if (error instanceof AppError) {
    if (error.status >= 500) {
      logger.error('Error de aplicación', {
        requestId: req.requestId,
        path: req.originalUrl,
        code: error.code,
        message: error.message,
        cause: error.cause instanceof Error ? error.cause.message : undefined,
      });
    }
    const body: ApiErrorBody = {
      error: {
        code: error.code,
        message: error.expose ? error.message : 'Ocurrió un error interno. Intente nuevamente.',
        ...(error.fields ? { fields: error.fields } : {}),
      },
    };
    res.status(error.status).json(body);
    return;
  }

  // SQLSTATE 23505 => violación de unicidad
  const pgCode = (error as { code?: string }).code;
  if (pgCode === '23505') {
    res.status(409).json({
      error: { code: 'CONFLICT', message: 'El registro ya existe (valor duplicado).' },
    } satisfies ApiErrorBody);
    return;
  }
  if (pgCode === '23503') {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Referencia inválida a otro registro.' },
    } satisfies ApiErrorBody);
    return;
  }

  logger.error('Error no controlado', {
    requestId: req.requestId,
    path: req.originalUrl,
    method: req.method,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack?.split('\n').slice(0, 4).join(' | ') : undefined,
  });

  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno. Intente nuevamente.' },
  } satisfies ApiErrorBody);
}
