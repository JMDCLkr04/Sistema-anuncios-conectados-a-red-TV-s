import type { Announcement } from './types.js';

/**
 * Protocolo de aplicación sobre WebSocket.
 *
 * El transporte es WebSocket conforme a **RFC 6455** (handshake HTTP Upgrade,
 * tramas de texto JSON, control frames ping/pong para el latido). El
 * direccionamiento se realiza exclusivamente dentro del espacio privado
 * definido en **RFC 1918**, reforzado con la lista blanca de orígenes.
 */
export const WS_PATH = '/ws';

/** Tipos de mensaje enviados por el servidor. */
export type ServerMessageType =
  | 'hello'
  | 'state'
  | 'announcement:upsert'
  | 'announcement:remove'
  | 'screen:seen'
  | 'audit:event'
  | 'pong'
  | 'error';

export interface ServerMessageMap {
  hello: { connectionId: string; kind: ClientKind; serverTime: string; heartbeatSeconds: number };
  state: { announcements: Announcement[]; serverTime: string };
  'announcement:upsert': { announcement: Announcement };
  'announcement:remove': { id: string };
  'screen:seen': { screenId: string; lastSeenAt: string };
  'audit:event': { action: string; username: string | null; createdAt: string };
  pong: { ts: number };
  error: { code: string; message: string };
}

export type ServerMessage = {
  [K in ServerMessageType]: { type: K; payload: ServerMessageMap[K]; ts: number };
}[ServerMessageType];

/** Tipos de mensaje enviados por pantallas, visores y panel de administración. */
export type ClientMessageType = 'subscribe' | 'sync' | 'heartbeat' | 'ping';

export interface ClientMessageMap {
  subscribe: { screenId?: string };
  sync: Record<string, never>;
  heartbeat: { screenId?: string };
  ping: { ts: number };
}

export type ClientMessage = {
  [K in ClientMessageType]: { type: K; payload: ClientMessageMap[K] };
}[ClientMessageType];

/** Perfil de conexión: determina qué información recibe el socket. */
export type ClientKind = 'admin' | 'client' | 'screen';

/** Credenciales exigidas para cada perfil de conexión. */
export const CLIENT_KIND_BY_TOKEN: Record<ClientKind, string> = {
  admin: 'JWT con rol admin',
  client: 'JWT con rol client',
  screen: 'Token de pantalla generado por el administrador',
};

/** Intervalo del latido (control frame RFC 6455 §5.5.2). */
export const HEARTBEAT_INTERVAL_MS = 30_000;

/** Máximo de bytes aceptados por mensaje entrante (protección DoS). */
export const MAX_MESSAGE_BYTES = 8 * 1024;

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as { type?: unknown; payload?: unknown };
    if (typeof candidate.type !== 'string') return null;
    const payload = (typeof candidate.payload === 'object' && candidate.payload !== null
      ? candidate.payload
      : {}) as Record<string, unknown>;
    switch (candidate.type) {
      case 'subscribe':
      case 'sync':
      case 'heartbeat':
        return { type: candidate.type, payload } as ClientMessage;
      case 'ping':
        return { type: 'ping', payload: { ts: Number(payload.ts ?? Date.now()) } };
      default:
        return null;
    }
  } catch {
    return null;
  }
}
