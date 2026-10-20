import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';

import { WebSocket, WebSocketServer } from 'ws';

import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  HEARTBEAT_INTERVAL_MS,
  MAX_MESSAGE_BYTES,
  WS_PATH,
  parseClientMessage,
} from '../domain/protocol.js';
import type { ClientKind, ServerMessage } from '../domain/protocol.js';
import { isWithinWindow } from '../domain/priorities.js';
import type { Announcement, SessionUser } from '../domain/types.js';
import * as announcementModel from '../models/announcement.model.js';
import { toAnnouncement } from '../views/presenters.js';
import { verifySessionToken } from '../services/auth.service.js';
import * as screenService from '../services/screen.service.js';
import * as announcementService from '../services/announcement.service.js';
import { isAllowedOrigin, normalizeIp } from '../utils/network.js';
import { unauthorized } from '../utils/errors.js';

/**
 * HUB DE TIEMPO REAL — WebSocket sobre RFC 6455.
 *
 * Responsabilidades:
 *  1. Validar el handshake (origen dentro de la lista blanca + credencial).
 *  2. Mantener un registro de conexiones clasificadas por perfil
 *     (`admin` / `client` / `screen`).
 *  3. Difundir sólo lo que a cada perfil le corresponde (mínimo privilegio).
 *  4. Sostener el latido con control frames ping/pong (RFC 6455 §5.5.2-5.5.3),
 *     cerrando conexiones zombis para liberar recursos.
 *
 * El direccionamiento es propio de una red local (RFC 1918); combinado con la
 * lista blanca de orígenes, un navegador de Internet no puede abrir el socket.
 */
interface Connection {
  id: string;
  ws: WebSocket;
  kind: ClientKind;
  user: SessionUser | null;
  screenId: string | null;
  screenName: string | null;
  ip: string | null;
  origin: string | null;
  alive: boolean;
  connectedAt: number;
}

const MAX_CONNECTIONS_PER_IP = 12;

let wss: WebSocketServer | null = null;
let heartbeat: NodeJS.Timeout | null = null;
const connections = new Map<string, Connection>();

function send(connection: Connection, message: ServerMessage): void {
  if (connection.ws.readyState !== WebSocket.OPEN) return;
  connection.ws.send(JSON.stringify(message));
}

function broadcast(message: ServerMessage, predicate: (connection: Connection) => boolean): void {
  for (const connection of connections.values()) {
    if (predicate(connection)) send(connection, message);
  }
}

function countByIp(ip: string | null): number {
  let total = 0;
  for (const connection of connections.values()) if (connection.ip === ip) total += 1;
  return total;
}

/** Un anuncio sólo se emite si está publicado y dentro de su ventana. */
function isVisible(announcement: Announcement): boolean {
  return announcement.status === 'published' && isWithinWindow(announcement);
}

/** ¿El anuncio está dirigido a esta pantalla? (sin asignaciones = todas) */
function targets(announcement: Announcement, screenId: string): boolean {
  return announcement.screenIds.length === 0 || announcement.screenIds.includes(screenId);
}

function rejects(socket: Duplex, status: number, reason: string): void {
  socket.write(
    `HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${reason}\n`,
  );
  socket.destroy();
}

async function resolveIdentity(
  request: IncomingMessage,
  url: URL,
): Promise<
  | { kind: 'screen'; screenId: string; screenName: string }
  | { kind: 'user'; user: SessionUser }
> {
  const token = url.searchParams.get('token')?.trim() ?? '';

  // 1) Token de pantalla (dispositivo): prefijo propio, validado contra el
  //    hash SHA-256 almacenado.
  if (token.startsWith('pnt_')) {
    const screen = await screenService.authenticateToken(token);
    return { kind: 'screen', screenId: screen.id, screenName: screen.name };
  }

  // 2) Sesión del navegador: el handshake es una petición HTTP normal, así que
  //    llega la cookie httpOnly y el token nunca se expone a JavaScript.
  const cookieToken = readCookie(request.headers.cookie, config.sessionCookieName);
  if (cookieToken) {
    const payload = verifySessionToken(cookieToken);
    return { kind: 'user', user: { id: payload.sub, username: payload.username, role: payload.role } };
  }

  // 3) Alternativa explícita por consulta (clientes no navegador).
  if (token) {
    const payload = verifySessionToken(token);
    return { kind: 'user', user: { id: payload.sub, username: payload.username, role: payload.role } };
  }

  throw unauthorized('Falta la credencial de conexión.');
}

/** Lectura mínima de cookies del handshake (sin dependencias adicionales). */
function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      const value = part.slice(separator + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

async function handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
  let url: URL;
  try {
    url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  } catch {
    rejects(socket, 400, 'Bad Request');
    return;
  }

  if (url.pathname !== WS_PATH) {
    rejects(socket, 404, 'Not Found');
    return;
  }

  // ISO 27001 A.8.20/A.8.22: sólo orígenes de la red local declarados.
  // Si la petición no trae `Origin` (cliente no navegador: kiosco, consola,
  // monitoreo) no hay riesgo CSRF y se permite; un navegador siempre lo envía,
  // de modo que un sitio de Internet nunca puede abrir el socket.
  const { allowed, origin } = isAllowedOrigin(request.headers.origin, config.wsAllowedOrigins);
  if (request.headers.origin !== undefined && !allowed) {
    logger.warn('Handshake WebSocket rechazado por origen no permitido', { origin });
    rejects(socket, 403, 'Forbidden');
    return;
  }

  const ip = normalizeIp(request.socket.remoteAddress);
  if (countByIp(ip) >= MAX_CONNECTIONS_PER_IP) {
    logger.warn('Handshake WebSocket rechazado por límite de conexiones por IP', { ip });
    rejects(socket, 429, 'Too Many Requests');
    return;
  }

  let identity: Awaited<ReturnType<typeof resolveIdentity>>;
  try {
    identity = await resolveIdentity(request, url);
  } catch (error) {
    logger.warn('Handshake WebSocket rechazado por credencial inválida', {
      ip,
      reason: (error as Error).message,
    });
    rejects(socket, 401, 'Unauthorized');
    return;
  }

  if (!wss) {
    rejects(socket, 503, 'Service Unavailable');
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    const kind: ClientKind =
      identity.kind === 'screen' ? 'screen' : identity.user.role === 'admin' ? 'admin' : 'client';

    const connection: Connection = {
      id: randomUUID(),
      ws,
      kind,
      user: identity.kind === 'user' ? identity.user : null,
      screenId: identity.kind === 'screen' ? identity.screenId : null,
      screenName: identity.kind === 'screen' ? identity.screenName : null,
      ip,
      origin,
      alive: true,
      connectedAt: Date.now(),
    };
    connections.set(connection.id, connection);

    logger.info('Conexión WebSocket establecida', {
      connectionId: connection.id,
      kind,
      username: connection.user?.username ?? null,
      screen: connection.screenName,
      ip,
    });

    send(connection, {
      type: 'hello',
      payload: {
        connectionId: connection.id,
        kind,
        serverTime: new Date().toISOString(),
        heartbeatSeconds: HEARTBEAT_INTERVAL_MS / 1000,
      },
      ts: Date.now(),
    });

    void sendInitialState(connection);

    ws.on('message', (data, isBinary) => {
      if (isBinary) return; // el protocolo del MVP es sólo texto JSON
      void onMessage(connection, data.toString());
    });

    ws.on('pong', () => {
      connection.alive = true;
    });

    ws.on('close', () => {
      connections.delete(connection.id);
      logger.info('Conexión WebSocket cerrada', {
        connectionId: connection.id,
        kind,
        durationMs: Date.now() - connection.connectedAt,
      });
    });

    ws.on('error', (error) => {
      logger.warn('Error en la conexión WebSocket', {
        connectionId: connection.id,
        error: (error as Error).message,
      });
    });
  });
}

async function sendInitialState(connection: Connection): Promise<void> {
  try {
    let rows = await announcementModel.list({ limit: 200 });

    if (connection.kind === 'screen') {
      rows = await announcementModel.findActiveForScreen(connection.screenId);
      if (connection.screenId) {
        const seenAt = await screenService.markSeen(connection.screenId);
        announceScreenSeen(connection.screenId, seenAt);
      }
    } else if (connection.kind === 'client') {
      // El rol observador recibe únicamente lo publicado y vigente.
      rows = await announcementModel.findActiveForScreen(null);
    }

    send(connection, {
      type: 'state',
      payload: {
        announcements: rows.map(toAnnouncement),
        serverTime: new Date().toISOString(),
      },
      ts: Date.now(),
    });
  } catch (error) {
    logger.error('No se pudo enviar el estado inicial por WebSocket', {
      connectionId: connection.id,
      error: (error as Error).message,
    });
    send(connection, {
      type: 'error',
      payload: { code: 'STATE_UNAVAILABLE', message: 'No fue posible sincronizar los anuncios.' },
      ts: Date.now(),
    });
  }
}

async function onMessage(connection: Connection, raw: string): Promise<void> {
  const message = parseClientMessage(raw);
  if (!message) {
    send(connection, {
      type: 'error',
      payload: { code: 'BAD_MESSAGE', message: 'Mensaje no reconocido por el protocolo.' },
      ts: Date.now(),
    });
    return;
  }

  switch (message.type) {
    case 'ping':
      send(connection, { type: 'pong', payload: { ts: message.payload.ts }, ts: Date.now() });
      break;
    case 'sync':
      await sendInitialState(connection);
      break;
    case 'subscribe':
    case 'heartbeat': {
      // Sólo la propia pantalla puede reportarse como activa.
      if (connection.kind !== 'screen' || !connection.screenId) return;
      const seenAt = await screenService.markSeen(connection.screenId);
      announceScreenSeen(connection.screenId, seenAt);
      break;
    }
  }
}

function announceScreenSeen(screenId: string, lastSeenAt: string): void {
  broadcast(
    { type: 'screen:seen', payload: { screenId, lastSeenAt }, ts: Date.now() },
    (connection) => connection.kind === 'admin',
  );
}

/* ------------------------------------------------------------------ *
 * API pública del hub (consumida por los servicios/controladores)
 * ------------------------------------------------------------------ */

/** Difunde un anuncio creado o modificado a quien corresponde. */
export function publishUpsert(row: announcementModel.AnnouncementRow): void {
  const announcement = toAnnouncement(row);
  broadcast({ type: 'announcement:upsert', payload: { announcement }, ts: Date.now() }, (connection) => {
    switch (connection.kind) {
      case 'admin':
        return true;
      case 'client':
        return isVisible(announcement);
      case 'screen':
        return (
          connection.screenId !== null &&
          isVisible(announcement) &&
          targets(announcement, connection.screenId)
        );
    }
  });
}

/** Notifica la eliminación: todos deben retirarlo de su rotación. */
export function publishRemoved(id: string): void {
  broadcast({ type: 'announcement:remove', payload: { id }, ts: Date.now() }, () => true);
}

/** Evento de auditoría en vivo; sólo el panel administrativo lo recibe. */
export function publishAuditEvent(event: {
  action: string;
  username: string | null;
  createdAt: string;
}): void {
  broadcast({ type: 'audit:event', payload: event, ts: Date.now() }, (c) => c.kind === 'admin');
}

export interface HubStats {
  total: number;
  byKind: Record<ClientKind, number>;
  screens: { id: string | null; name: string | null; connectedAt: string }[];
}

export function stats(): HubStats {
  const byKind: Record<ClientKind, number> = { admin: 0, client: 0, screen: 0 };
  const screens: HubStats['screens'] = [];
  for (const connection of connections.values()) {
    byKind[connection.kind] += 1;
    if (connection.kind === 'screen') {
      screens.push({
        id: connection.screenId,
        name: connection.screenName,
        connectedAt: new Date(connection.connectedAt).toISOString(),
      });
    }
  }
  return { total: connections.size, byKind, screens };
}

/** Adjunta el servidor WebSocket al servidor HTTP (mismo puerto del monolito). */
export function attachWebSocketServer(server: Server): void {
  wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_MESSAGE_BYTES,
    perMessageDeflate: false, // evita amplificación de memoria (DoS)
  });

  server.on('upgrade', (request, socket, head) => {
    void handleUpgrade(request, socket, head).catch((error: unknown) => {
      logger.error('Fallo inesperado en el handshake WebSocket', {
        error: (error as Error).message,
      });
      if (!socket.destroyed) rejects(socket, 500, 'Internal Server Error');
    });
  });

  // Latido: control frames ping/pong conforme a RFC 6455 §5.5.2 y §5.5.3.
  heartbeat = setInterval(() => {
    for (const connection of connections.values()) {
      if (!connection.alive) {
        logger.warn('Cerrando conexión WebSocket sin respuesta al latido', {
          connectionId: connection.id,
          kind: connection.kind,
        });
        connection.ws.terminate();
        connections.delete(connection.id);
        continue;
      }
      connection.alive = false;
      connection.ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);
  heartbeat.unref();

  // El servicio de anuncios nos inyecta el notificador (evita import circular).
  announcementService.setNotifier({
    publishUpsert,
    publishRemoved,
    publishAuditEvent,
  });

  logger.info('Servidor WebSocket listo (RFC 6455)', {
    path: WS_PATH,
    allowedOrigins: config.wsAllowedOrigins,
    heartbeatSeconds: HEARTBEAT_INTERVAL_MS / 1000,
  });
}

export function closeWebSocketServer(): void {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  for (const connection of connections.values()) connection.ws.close(1001, 'Servidor detenido');
  connections.clear();
  wss?.close();
  wss = null;
}

/** Notifica a los administradores cuando una pantalla se registra o actualiza. */
export function notifyScreensChanged(): void {
  broadcast(
    { type: 'screen:seen', payload: { screenId: 'refresh', lastSeenAt: new Date().toISOString() }, ts: Date.now() },
    (connection) => connection.kind === 'admin',
  );
}

/** Utilidad expuesta para depuración: pantallas conectadas ahora mismo. */
export function connectedScreenIds(): string[] {
  return [...connections.values()]
    .filter((connection) => connection.kind === 'screen' && connection.screenId)
    .map((connection) => connection.screenId as string);
}
