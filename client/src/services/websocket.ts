import type { ClientMessage, ServerMessage } from '../models/domain';

/**
 * Cliente WebSocket (RFC 6455) con reconexión y latido.
 *
 * Decisiones de seguridad y accesibilidad operativa:
 *  - La sesión del navegador NO necesita token en la URL: el handshake envía la
 *    cookie httpOnly del propio origen.
 *  - Las pantallas usan su token de dispositivo, que el backend valida contra
 *    el hash almacenado.
 *  - Reconexión con retroceso exponencial y jitter para no saturar el servidor
 *    (ISO 27001 A.8.6 uso responsable de los recursos).
 *  - Latido de aplicación (`ping`) complementario a los control frames del
 *    servidor, para detectar cortes en redes WiFi inestables.
 */

/** Ruta del WebSocket; debe coincidir con `WS_PATH` del dominio compartido. */
const WS_PATH = '/ws';

export type SocketStatus = 'connecting' | 'online' | 'offline';

export interface RealtimeSocketOptions {
  /** Token de pantalla (`pnt_…`). Omitir cuando la sesión usa cookie. */
  token?: string;
  onMessage: (message: ServerMessage) => void;
  onStatus?: (status: SocketStatus) => void;
  /** Intervalo del latido de aplicación (por defecto 25 s). */
  heartbeatMs?: number;
}

const MAX_BACKOFF_MS = 15_000;
const BASE_BACKOFF_MS = 800;

export class RealtimeSocket {
  private ws: WebSocket | null = null;
  private status: SocketStatus = 'offline';
  private attempts = 0;
  private closedByUser = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly options: RealtimeSocketOptions) {}

  get currentStatus(): SocketStatus {
    return this.status;
  }

  connect(): void {
    this.closedByUser = false;
    this.open();
  }

  close(): void {
    this.closedByUser = true;
    this.clearTimers();
    this.ws?.close(1000, 'Cliente desconectado');
    this.ws = null;
    this.setStatus('offline');
  }

  send(message: ClientMessage): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(message));
  }

  private buildUrl(): string {
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = new URL(`${scheme}//${window.location.host}${WS_PATH}`);
    if (this.options.token) url.searchParams.set('token', this.options.token);
    return url.toString();
  }

  private open(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.setStatus('connecting');

    let socket: WebSocket;
    try {
      socket = new WebSocket(this.buildUrl());
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = socket;

    socket.onopen = () => {
      this.attempts = 0;
      this.setStatus('online');
      this.startHeartbeat();
      // Pide una sincronización completa: ante una reconexión, el cliente no
      // confía en el estado que tenía en memoria.
      this.send({ type: 'sync', payload: {} });
    };

    socket.onmessage = (event: MessageEvent<string>) => {
      if (typeof event.data !== 'string') return;
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        if (message.type === 'pong') return;
        this.options.onMessage(message);
      } catch {
        // Un mensaje malformado se ignora: no debe tumbar la vista.
      }
    };

    socket.onerror = () => {
      // `onclose` se encarga de la reconexión.
    };

    socket.onclose = (event: CloseEvent) => {
      this.stopHeartbeat();
      this.ws = null;
      this.setStatus('offline');
      if (this.closedByUser || event.code === 1000) return;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.closedByUser || this.reconnectTimer) return;
    const exponential = Math.min(BASE_BACKOFF_MS * 2 ** this.attempts, MAX_BACKOFF_MS);
    const jitter = Math.random() * 400;
    this.attempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (document.visibilityState === 'visible') this.open();
      else this.scheduleReconnect();
    }, exponential + jitter);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const interval = this.options.heartbeatMs ?? 25_000;
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'heartbeat', payload: {} });
    }, interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private setStatus(next: SocketStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.options.onStatus?.(next);
  }
}
