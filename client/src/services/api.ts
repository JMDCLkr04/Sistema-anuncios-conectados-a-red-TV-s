import type {
  Announcement,
  AnnouncementInput,
  AnnouncementStatus,
  AuditLogEntry,
  AuthResponse,
  HealthStatus,
  Priority,
  Role,
  Screen,
  ScreenInput,
  ScreenWithToken,
  SessionUser,
  UserSummary,
} from '../models/domain';
import { request } from './http';

/**
 * SERVICIO de API: una función por operación del backend.
 * Los componentes y controladores nunca construyen URLs: así el contrato con
 * el monolito queda en un único archivo por módulo.
 */

/* ------------------------------ Identidad ------------------------------ */
export const authApi = {
  login: (username: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { username, password } }),

  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  me: () => request<{ user: SessionUser }>('/auth/me'),
};

/* ------------------------------ Anuncios ------------------------------- */
export interface AnnouncementFilters {
  status?: AnnouncementStatus;
  priority?: Priority;
  search?: string;
  limit?: number;
}

export const announcementApi = {
  list: (filters: AnnouncementFilters = {}) =>
    request<{ announcements: Announcement[]; scope: 'all' | 'published' }>('/announcements', {
      params: {
        status: filters.status,
        priority: filters.priority,
        search: filters.search,
        limit: filters.limit,
      },
    }),

  listActive: (screenToken?: string) =>
    request<{ announcements: Announcement[]; serverTime: string }>('/announcements/active', {
      params: { token: screenToken },
    }),

  get: (id: string) => request<{ announcement: Announcement }>(`/announcements/${encodeURIComponent(id)}`),

  create: (input: AnnouncementInput) =>
    request<{ announcement: Announcement }>('/announcements', { method: 'POST', body: input }),

  update: (id: string, input: Partial<AnnouncementInput>) =>
    request<{ announcement: Announcement }>(`/announcements/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: input,
    }),

  remove: (id: string) =>
    request<void>(`/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

/* ------------------------------- Pantallas ----------------------------- */
export const screenApi = {
  list: () =>
    request<{ screens: Screen[]; connectedScreenIds: string[] }>('/screens'),

  create: (input: ScreenInput) =>
    request<{ screen: ScreenWithToken; connectionHint: string }>('/screens', {
      method: 'POST',
      body: input,
    }),

  update: (id: string, input: Partial<ScreenInput>) =>
    request<{ screen: Screen }>(`/screens/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: input,
    }),

  remove: (id: string) =>
    request<void>(`/screens/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  rotateToken: (id: string) =>
    request<{ screen: ScreenWithToken; connectionHint: string }>(
      `/screens/${encodeURIComponent(id)}/rotate-token`,
      { method: 'POST' },
    ),
};

/* -------------------------------- Cuentas ------------------------------ */
export const userApi = {
  list: () => request<{ users: UserSummary[] }>('/users'),

  create: (input: { username: string; password: string; role: Role; active?: boolean }) =>
    request<{ user: UserSummary }>('/users', { method: 'POST', body: input }),

  update: (id: string, input: { role?: Role; active?: boolean; password?: string }) =>
    request<{ user: UserSummary }>(`/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: input,
    }),

  remove: (id: string) => request<void>(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

/* ------------------------- Bitácora y diagnóstico ---------------------- */
export const auditApi = {
  list: (limit = 100) => request<{ entries: AuditLogEntry[] }>('/audit', { params: { limit } }),
};

export const systemApi = {
  health: () => request<HealthStatus>('/health'),
  realtimeStats: () =>
    request<{
      realtime: {
        total: number;
        byKind: Record<'admin' | 'client' | 'screen', number>;
        screens: { id: string | null; name: string | null; connectedAt: string }[];
      };
    }>('/realtime/stats'),
};
