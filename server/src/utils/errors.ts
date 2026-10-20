/**
 * Errores de aplicación con código estable.
 *
 * Las respuestas HTTP jamás exponen trazas ni mensajes del motor SQL
 * (ISO 27001 A.8.8 gestión de vulnerabilidades técnicas y A.8.15 bitácora).
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;
  readonly expose: boolean;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { fields?: Record<string, string>; expose?: boolean; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.fields = options.fields;
    this.expose = options.expose ?? status < 500;
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new AppError(400, 'BAD_REQUEST', message, { fields });

export const unauthorized = (message = 'Credenciales inválidas o sesión expirada.') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'No tiene permisos para ejecutar esta acción.') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'El recurso solicitado no existe.') =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);

export const tooManyRequests = (message = 'Demasiados intentos. Intente más tarde.') =>
  new AppError(429, 'TOO_MANY_REQUESTS', message);

export const internal = (message = 'Error interno del servidor.', cause?: unknown) =>
  new AppError(500, 'INTERNAL_ERROR', message, { expose: false, cause });
