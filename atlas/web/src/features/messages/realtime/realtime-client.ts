import { io, type Socket } from "socket.io-client";
import {
  type Ack,
  MessagingCommand,
  type MessagingClientEvents,
  RealtimeSystemEvent,
  type RealtimeReadyPayload,
} from "@auric/contracts/messaging";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "offline";

/** The slice of a socket.io `Socket` this client uses — small so tests can fake it. */
export interface SocketLike {
  connected: boolean;
  on(event: string, handler: (...args: never[]) => void): unknown;
  off(event: string, handler?: (...args: never[]) => void): unknown;
  emit(event: string, ...args: unknown[]): unknown;
  timeout(ms: number): { emitWithAck(event: string, payload: unknown): Promise<unknown> };
  connect(): unknown;
  disconnect(): unknown;
}

export interface RealtimeClientOptions {
  /** e.g. the API origin. */
  url: string;
  /** A token with at least `minSeconds` left (default: a little) — refreshed if needed. `null` = no session. */
  getToken: (minSeconds?: number) => Promise<string | null>;
  /** Test seam. Defaults to a real Socket.IO connection. */
  createSocket?: (url: string, auth: (cb: (data: { token: string | null }) => void) => void) => SocketLike;
  /** How long before token expiry the client swaps in a fresh token. */
  refreshLeadSeconds?: number;
}

type Listener = (payload: never) => void;

/**
 * The transport: one authenticated Socket.IO connection, and nothing else. It
 * knows how to stay connected across token expiry / network loss / server
 * restarts, and tells its owner when a (re)connection is READY — it does not
 * know what a message or a conversation is. State reconciliation after a
 * reconnect is the owner's job (`MessagingProvider`); Socket.IO reconnecting
 * guarantees a transport, not that no events were missed.
 *
 *  - No polling anywhere: liveness comes from Socket.IO's own heartbeat.
 *  - A fresh token is fetched for EVERY connection attempt (`auth` is a function),
 *    so a reconnect after the 15-minute access token lapsed authenticates properly.
 *  - Before the current token expires, `auth:refresh` swaps in a new one over the
 *    live socket — no disconnect, no missed events.
 *  - A server-initiated close (token expired, server restart) does not auto-reconnect
 *    in Socket.IO, so it is handled here.
 */
export class RealtimeClient {
  private socket: SocketLike | undefined;
  private status: ConnectionStatus = "idle";
  private everReady = false;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly statusListeners = new Set<(s: ConnectionStatus) => void>();
  private readonly readyListeners = new Set<(ready: RealtimeReadyPayload, isReconnect: boolean) => void>();
  private readonly eventListeners = new Map<string, Set<Listener>>();

  constructor(private readonly opts: RealtimeClientOptions) {}

  get connectionStatus(): ConnectionStatus {
    return this.status;
  }

  start(): void {
    if (this.socket) return;
    this.setStatus("connecting");
    const createSocket = this.opts.createSocket ?? defaultCreateSocket;
    const socket = createSocket(this.opts.url, (cb) => {
      void this.opts.getToken().then((token) => cb({ token }));
    });
    this.socket = socket;

    // (`connect` only means the transport is up — the connection is usable at `realtime:ready`.)
    socket.on(RealtimeSystemEvent.Ready, ((ready: RealtimeReadyPayload) => {
      const isReconnect = this.everReady;
      this.everReady = true;
      this.setStatus("connected");
      this.scheduleTokenRefresh(ready.tokenExpiresAt);
      for (const l of this.readyListeners) l(ready, isReconnect);
    }) as never);

    socket.on("disconnect", ((reason: string) => {
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      this.setStatus(this.everReady ? "reconnecting" : "connecting");
      // Socket.IO auto-reconnects for transport errors but NOT when the server closed us
      // (expired token, restart, eviction) — reconnect ourselves, after a short breather.
      if (reason === "io server disconnect") this.scheduleManualReconnect();
    }) as never);

    socket.on("connect_error", ((err: Error & { data?: { code?: string } }) => {
      this.setStatus(this.everReady ? "reconnecting" : "connecting");
      // A rejected handshake (bad/expired token) does not retry by itself either.
      const code = err.data?.code;
      if (code && code.startsWith("auth.")) this.scheduleManualReconnect();
    }) as never);

    // Forward every subscribed server event.
    for (const event of this.eventListeners.keys()) this.bind(event);
  }

  stop(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.disconnect();
    this.socket = undefined;
    this.everReady = false;
    this.setStatus("idle");
  }

  /** Subscribe to a server → client event. Returns the unsubscribe function. */
  on<P>(event: string, handler: (payload: P) => void): () => void {
    const set = this.eventListeners.get(event) ?? new Set<Listener>();
    const first = set.size === 0;
    set.add(handler as Listener);
    this.eventListeners.set(event, set);
    if (first && this.socket) this.bind(event);
    return () => {
      set.delete(handler as Listener);
    };
  }

  onStatus(handler: (s: ConnectionStatus) => void): () => void {
    this.statusListeners.add(handler);
    return () => this.statusListeners.delete(handler);
  }

  /** Called on EVERY ready — `isReconnect` is true from the second one on. */
  onReady(handler: (ready: RealtimeReadyPayload, isReconnect: boolean) => void): () => void {
    this.readyListeners.add(handler);
    return () => this.readyListeners.delete(handler);
  }

  /** Fire-and-forget (typing). Dropped silently when offline — it is ephemeral by design. */
  emitEphemeral<C extends keyof MessagingClientEvents>(command: C, payload: MessagingClientEvents[C]["payload"]): void {
    if (this.socket?.connected) this.socket.emit(command, payload);
  }

  /** A command with a server acknowledgement. Rejects when offline or on timeout. */
  async command<C extends keyof MessagingClientEvents>(
    command: C,
    payload: MessagingClientEvents[C]["payload"],
    timeoutMs = 8000,
  ): Promise<Ack<MessagingClientEvents[C]["ack"]>> {
    if (!this.socket?.connected) throw new Error("realtime: not connected");
    return (await this.socket.timeout(timeoutMs).emitWithAck(command, payload)) as Ack<MessagingClientEvents[C]["ack"]>;
  }

  // ── internals ────────────────────────────────────────────────────────────

  private bind(event: string): void {
    this.socket?.on(event, ((payload: never) => {
      for (const l of this.eventListeners.get(event) ?? []) l(payload);
    }) as never);
  }

  private setStatus(next: ConnectionStatus): void {
    if (next === this.status) return;
    this.status = next;
    for (const l of this.statusListeners) l(next);
  }

  /** Swap in a fresh token over the live socket shortly before the current one lapses. */
  private scheduleTokenRefresh(expiresAtSeconds: number): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const lead = this.opts.refreshLeadSeconds ?? 60;
    const ms = Math.max(1_000, expiresAtSeconds * 1000 - Date.now() - lead * 1000);
    this.refreshTimer = setTimeout(() => {
      void (async () => {
        // Demand MORE than `lead` seconds of validity, so the still-valid current token is not handed back.
        const token = await this.opts.getToken(lead + 30);
        if (!token || !this.socket?.connected) return;
        try {
          const ack = (await this.socket.timeout(5000).emitWithAck(MessagingCommand.AuthRefresh, { token })) as Ack<{
            tokenExpiresAt: number;
          }>;
          if (ack.ok) this.scheduleTokenRefresh(ack.data.tokenExpiresAt);
        } catch {
          /* the server will close us at expiry; the disconnect path reconnects with a fresh token */
        }
      })();
    }, ms);
  }

  private scheduleManualReconnect(): void {
    if (this.reconnectTimer || !this.socket) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.socket?.connect();
    }, 1_000);
  }
}

function defaultCreateSocket(
  url: string,
  auth: (cb: (data: { token: string | null }) => void) => void,
): SocketLike {
  const socket: Socket = io(url, {
    path: "/socket.io",
    // WebSocket ONLY by default: realtime here means a real WebSocket, not HTTP long-polling in disguise.
    // A deployment behind a proxy that cannot upgrade connections can opt in to Socket.IO's
    // long-polling fallback with VITE_REALTIME_POLLING_FALLBACK=true (see docs/messaging.md §9).
    transports: import.meta.env.VITE_REALTIME_POLLING_FALLBACK === "true" ? ["websocket", "polling"] : ["websocket"],
    auth,
    reconnection: true,
    reconnectionDelay: 800,
    reconnectionDelayMax: 8_000,
    randomizationFactor: 0.4,
  });
  return socket as unknown as SocketLike;
}
