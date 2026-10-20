import type { Role, SessionUser } from '../domain/types.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Usuario autenticado; ausente en rutas públicas. */
      user?: SessionUser;
      /** Identificador de correlación del ciclo petición/respuesta. */
      requestId?: string;
    }
  }
}

export {};
