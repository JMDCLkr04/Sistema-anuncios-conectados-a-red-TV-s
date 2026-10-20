import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Announcement, AuditLogEntry, Role } from '../models/domain';
import { compareByUrgency, isLive } from '../models';
import { announcementApi, auditApi } from '../services/api';
import { ApiError } from '../services/http';
import { RealtimeSocket } from '../services/websocket';
import type { SocketStatus } from '../services/websocket';
import { toApiError } from './useAsyncResource';

/**
 * CONTROLADOR del feed en tiempo real.
 *
 * Une las dos fuentes de verdad del sistema:
 *  1. Carga inicial por HTTP (API REST) — estado consistente y completo.
 *  2. Flujo WebSocket (RFC 6455) — altas, cambios y bajas al instante.
 *
 * Además deduplica por identificador y ordena por urgencia, de modo que la
 * urgencia crítica siempre queda primero en cualquier vista.
 */
export type FeedMode = 'admin' | 'viewer' | 'screen';

export interface FeedActivity {
  action: string;
  username: string | null;
  createdAt: string;
}

export interface UseAnnouncementFeedOptions {
  mode: FeedMode;
  /** Token del dispositivo; sólo en modo `screen`. */
  screenToken?: string;
  /** Actividades de auditoría en vivo (sólo administración). */
  withActivity?: boolean;
}

export interface UseAnnouncementFeedResult {
  announcements: Announcement[];
  loading: boolean;
  error: ApiError | null;
  socketStatus: SocketStatus;
  lastSyncAt: string | null;
  activity: FeedActivity[];
  refresh: () => Promise<void>;
}

export function useAnnouncementFeed({
  mode,
  screenToken,
  withActivity = false,
}: UseAnnouncementFeedOptions): UseAnnouncementFeedResult {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('connecting');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [activity, setActivity] = useState<FeedActivity[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const sortFeed = useCallback(
    (list: Announcement[]): Announcement[] => {
      const visible = mode === 'admin' ? list : list.filter((item) => item.status === 'published' && isLive(item.startsAt, item.endsAt));
      return [...visible].sort(compareByUrgency);
    },
    [mode],
  );

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const response =
        mode === 'admin'
          ? await announcementApi.list({ limit: 200 })
          : await announcementApi.listActive(mode === 'screen' ? screenToken : undefined);
      if (!mountedRef.current) return;
      setAnnouncements(sortFeed(response.announcements));
      setError(null);
      setLastSyncAt(new Date().toISOString());
    } catch (caught) {
      if (!mountedRef.current) return;
      setError(toApiError(caught));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [mode, screenToken, sortFeed]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Conexión WebSocket: se reconstruye si cambia el modo o el token.
  useEffect(() => {
    const socket = new RealtimeSocket({
      ...(mode === 'screen' && screenToken ? { token: screenToken } : {}),
      onStatus: (status) => {
        if (mountedRef.current) setSocketStatus(status);
      },
      onMessage: (message) => {
        if (!mountedRef.current) return;
        switch (message.type) {
          case 'state':
            setAnnouncements(sortFeed(message.payload.announcements));
            setLastSyncAt(message.payload.serverTime);
            setError(null);
            setLoading(false);
            break;
          case 'announcement:upsert':
            setAnnouncements((current) => {
              const without = current.filter((item) => item.id !== message.payload.announcement.id);
              return sortFeed([...without, message.payload.announcement]);
            });
            break;
          case 'announcement:remove':
            setAnnouncements((current) => current.filter((item) => item.id !== message.payload.id));
            break;
          case 'audit:event':
            if (!withActivity) break;
            setActivity((current) =>
              [{ ...message.payload }, ...current].slice(0, 12),
            );
            break;
          case 'screen:seen':
          case 'error':
            break;
        }
      },
    });

    socket.connect();
    return () => socket.close();
  }, [mode, screenToken, sortFeed, withActivity]);

  return useMemo(
    () => ({
      announcements,
      loading,
      error,
      socketStatus,
      lastSyncAt,
      activity,
      refresh,
    }),
    [announcements, loading, error, socketStatus, lastSyncAt, activity, refresh],
  );
}

/** CONTROLADOR de la bitácora (panel administrativo). */
export function useAuditLog(limit = 100): {
  entries: AuditLogEntry[];
  loading: boolean;
  error: ApiError | null;
  reload: () => Promise<void>;
} {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await auditApi.list(limit);
      setEntries(response.entries);
      setError(null);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { entries, loading, error, reload };
}

/** Utilidad para la vista: rol legible sin lógica en el componente. */
export function describeRole(role: Role): string {
  return role === 'admin' ? 'Administrador' : 'Observador';
}
