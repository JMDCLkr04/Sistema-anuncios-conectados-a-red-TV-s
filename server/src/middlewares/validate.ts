import type { ZodType } from 'zod';
import type { NextFunction, Request, Response } from 'express';

/**
 * Middleware de validación: convierte el cuerpo o la query en datos tipados y
 * saneados. Si la validación falla se delega al manejador central de errores
 * (ISO 27001 A.8.26 / A.8.28: validación de entradas y codificación segura).
 */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(result.error);
      return;
    }
    // `req.query` es de sólo lectura en Express 5: se guarda en `res.locals`.
    _res.locals.query = result.data;
    next();
  };
}
