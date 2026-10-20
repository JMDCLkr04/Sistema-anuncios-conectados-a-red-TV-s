import type { ApiErrorBody } from '../models/domain';

/**
 * Cliente HTTP de la API (infraestructura del MVC).
 *
 * - `credentials: 'include'`: la sesión viaja en una cookie httpOnly
 *   (inaccesible para JavaScript, mitiga XSS) y `SameSite=Strict` (mitiga CSRF).
 * - El encabezado `X-Requested-With` permite al backend distinguir peticiones
 *   de la propia aplicación.
 * - Toda respuesta de error se normaliza a `ApiError` con código y campos.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  /** `true` cuando el problema es de red o de servidor no disponible. */
  get isConnectivity(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

const API_BASE = '/api';

type QueryValue = string | number | boolean | undefined | null;

function buildUrl(path: string, params?: Record<string, QueryValue>): string {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return `${url.pathname}${url.search}`;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  params?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, signal } = options;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      credentials: 'include',
      signal,
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'No hay conexión con el servidor de anuncios. Verifique que está en la red local.',
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      errorBody?.error?.code ?? 'UNKNOWN_ERROR',
      errorBody?.error?.message ?? `La operación falló (HTTP ${response.status}).`,
      errorBody?.error?.fields ?? {},
    );
  }

  return payload as T;
}
