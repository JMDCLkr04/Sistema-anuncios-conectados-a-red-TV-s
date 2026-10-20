/**
 * Modelo de dominio compartido (contrato único backend ⇄ frontend).
 *
 * Forma parte del monolito modular: al vivir dentro del mismo repositorio,
 * el contrato de datos no se duplica ni se desincroniza. El frontend importa
 * estos tipos con `import type`, por lo que nada de código de servidor viaja
 * al bundle del navegador.
 */

/** Roles del sistema. `admin` publica anuncios; `client` solo observa. */
export type Role = 'admin' | 'client';

/** Nivel de urgencia de un anuncio. `critical` se resalta con rojo. */
export type Priority = 'critical' | 'high' | 'normal' | 'low';

/** Ciclo de vida de un anuncio. */
export type AnnouncementStatus = 'draft' | 'published' | 'expired';

export interface SessionUser {
  id: string;
  username: string;
  role: Role;
}

export interface UserSummary extends SessionUser {
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: Priority;
  status: AnnouncementStatus;
  /** ISO-8601 o `null` si no tiene programación. */
  startsAt: string | null;
  endsAt: string | null;
  /** Pantallas destino. Si `allScreens` es `true`, la lista va vacía. */
  screenIds: string[];
  allScreens: boolean;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Cuerpo aceptado por los endpoints de escritura de anuncios. */
export interface AnnouncementInput {
  title: string;
  body: string;
  priority: Priority;
  status: AnnouncementStatus;
  startsAt: string | null;
  endsAt: string | null;
  screenIds: string[];
  allScreens: boolean;
}

export interface Screen {
  id: string;
  name: string;
  location: string;
  active: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  /** Nº de anuncios publicados dirigidos a esta pantalla. */
  publishedCount: number;
}

/**
 * Pantalla con su token en claro. Solo se devuelve UNA vez, en el momento
 * de la creación (ISO 27001 A.8.24: el servidor almacena únicamente el hash).
 */
export interface ScreenWithToken extends Screen {
  token: string;
}

export interface ScreenInput {
  name: string;
  location: string;
  active: boolean;
}

export interface AuditLogEntry {
  id: string;
  username: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  outcome: 'success' | 'failure';
  ip: string | null;
  createdAt: string;
  details: Record<string, unknown> | null;
}

export interface AuthResponse {
  user: SessionUser;
  /** Token de sesión (JWT) para autenticar el WebSocket. */
  token: string;
  expiresInSeconds: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    /** Errores por campo, cuando la validación falla. */
    fields?: Record<string, string>;
  };
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  uptimeSeconds: number;
  version: string;
  serverTime: string;
}
