import { Inject, Injectable, type BeforeApplicationShutdown, type OnApplicationBootstrap } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { Server, type Socket } from "socket.io";
import type { z } from "zod";
import type { Clock } from "@core/kernel/clock.js";
import type { AuricConfig } from "@core/kernel/config.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { AppError, Forbidden, Unauthenticated, ValidationError } from "@core/kernel/errors.js";
import { newId } from "@core/kernel/id.js";
import { withContext } from "@core/kernel/logging/context.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import {
  CLOCK,
  CONFIG,
  JWT_SERVICE,
  ORGANIZATION_PROVIDER,
  PERMISSION_PROVIDER,
  USER_PROVIDER,
} from "@core/kernel/tokens.js";
import type { IOrganizationProvider, IPermissionProvider, IUserProvider } from "@core/contracts/index.js";
import type { JwtService } from "@core/identity/infrastructure/jwt-service.js";
import {
  type Ack,
  MessagingCommand as Cmd,
  MessagingEvent,
  type PresenceUpdatePayload,
  type RealtimeReadyPayload,
  RealtimeSystemEvent,
  realtimeRooms,
} from "@core/messaging/contracts/realtime-events.js";
import { MessagingService } from "@core/messaging/application/messaging-service.js";
import {
  authRefreshCommandSchema,
  conversationCommandSchema,
  conversationReadCommandSchema,
  messageCreateCommandSchema,
} from "@core/messaging/validation/schemas.js";
import { PresenceRegistry } from "./presence-registry.js";
import { RealtimeBroadcaster } from "./realtime-broadcaster.js";

const log = moduleLogger("realtime");

/** Who a socket is. Set ONCE by the handshake from the verified JWT — never from a payload. */
interface SocketIdentity {
  userId: string;
  organizationId: string;
  /** Epoch seconds at which the token stops being accepted. */
  expiresAt: number;
}

interface SocketData {
  identity: SocketIdentity;
  expiryTimer?: NodeJS.Timeout;
  /** conversationId → last `typing:start` fan-out time (ms), for throttling. */
  typingSentAt: Map<string, number>;
  /** Timestamps (ms) of recent message sends — a sliding-window limiter. */
  sendTimes: number[];
}

const MAX_AUTO_JOIN = 1000;
const TYPING_MIN_INTERVAL_MS = 1500;
const SEND_LIMIT = { max: 30, windowMs: 10_000 };

const isLoopback =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/;

/**
 * The Socket.IO transport for messaging (and any product event that rides the
 * same seam). It is attached to the app's own HTTP server, so there is one port,
 * one process, one TLS/CORS story.
 *
 * Security, in order, for every connection and every command:
 *  1. handshake: verify the access JWT (`JWT_SERVICE`), require an active
 *     organization and live membership in it. Identity comes ONLY from the token.
 *  2. rooms: `org:*` / `user:*` are derived from that identity; `conversation:*`
 *     rooms are joined only after a live membership check against the database.
 *  3. commands: token still valid → payload validated → live RBAC → membership
 *     (in the service) → run inside the same ambient context + transaction
 *     machinery as an HTTP request, so RLS applies identically.
 */
@Injectable()
export class RealtimeGateway implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private io: Server | undefined;
  private readonly presence = new PresenceRegistry();

  constructor(
    private readonly httpHost: HttpAdapterHost,
    private readonly broadcaster: RealtimeBroadcaster,
    private readonly messaging: MessagingService,
    @Inject(CONFIG) private readonly config: AuricConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(JWT_SERVICE) private readonly jwtService: JwtService,
    @Inject(USER_PROVIDER) private readonly users: IUserProvider,
    @Inject(ORGANIZATION_PROVIDER) private readonly orgs: IOrganizationProvider,
    @Inject(PERMISSION_PROVIDER) private readonly permissions: IPermissionProvider,
  ) {}

  onApplicationBootstrap(): void {
    const server = this.httpHost?.httpAdapter?.getHttpServer?.();
    if (!server) {
      log.debug("no HTTP server (test/worker context) — realtime gateway not attached");
      return;
    }
    const configured = this.config.corsOrigins.map((o) =>
      o.startsWith("*.") ? new RegExp(`${o.slice(1).replace(/[.]/g, "\\$&")}$`) : o,
    );
    const isDev = this.config.nodeEnv !== "production";

    this.io = new Server(server, {
      path: "/socket.io",
      // Frames are commands/acks, never file bytes (attachments go through Core files).
      maxHttpBufferSize: 256 * 1024,
      cors: {
        origin: (origin, cb) => {
          if (!origin) return cb(null, true);
          if (isDev && isLoopback.test(origin)) return cb(null, true);
          cb(null, configured.some((o) => (o instanceof RegExp ? o.test(origin) : o === origin)));
        },
        credentials: false,
      },
    });
    this.broadcaster.attach(this.io);
    this.io.use((socket, next) => void this.authenticate(socket).then(() => next(), next));
    this.io.on("connection", (socket) => void this.onConnection(socket as Socket));
    log.info("realtime gateway attached (socket.io, path /socket.io)");
  }

  beforeApplicationShutdown(): void {
    // Close sockets BEFORE Fastify closes the HTTP server, or open websockets hold shutdown open.
    this.broadcaster.attach(undefined);
    this.io?.disconnectSockets(true);
    this.io?.engine.close();
  }

  // ── handshake ────────────────────────────────────────────────────────────

  private async authenticate(socket: Socket): Promise<void> {
    const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
    if (typeof token !== "string" || token.length === 0) {
      throw handshakeError("auth.unauthenticated", "Authentication required.");
    }
    let identity: SocketIdentity;
    try {
      identity = await this.identityFromToken(token);
    } catch (err) {
      throw handshakeError(
        err instanceof AppError ? err.code : "auth.invalid_token",
        err instanceof AppError ? err.message : "Invalid authentication token.",
      );
    }
    (socket.data as SocketData) = { identity, typingSentAt: new Map(), sendTimes: [] };
  }

  /** Verify a JWT and confirm the user is an active member of the token's organization. */
  private async identityFromToken(token: string): Promise<SocketIdentity> {
    let claims: ReturnType<JwtService["verifyAccessToken"]>;
    try {
      claims = this.jwtService.verifyAccessToken(token);
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) throw Unauthenticated("auth.token_expired", "Your session has expired.");
      throw Unauthenticated("auth.invalid_token", "Invalid authentication token.");
    }
    if (!claims.org) throw Unauthenticated("tenant.required", "Select an organization before connecting.");
    const exp = (jwt.decode(token) as { exp?: number } | null)?.exp;
    if (!exp) throw Unauthenticated("auth.invalid_token", "Invalid authentication token.");

    const orgId = claims.org;
    const ok = await this.inContext({ userId: claims.sub, organizationId: orgId }, async () => {
      const user = await this.users.getUser(claims.sub);
      if (!user || user.status === "disabled") return false;
      return readInTenant(() => this.orgs.isMember(orgId, claims.sub));
    });
    if (!ok) throw Forbidden("auth.not_a_member", "You are not a member of this organization.");
    return { userId: claims.sub, organizationId: orgId, expiresAt: exp };
  }

  // ── connection lifecycle ─────────────────────────────────────────────────

  private async onConnection(socket: Socket): Promise<void> {
    const data = socket.data as SocketData;
    const { userId, organizationId } = data.identity;

    // Register handlers synchronously so nothing the client sends right after
    // `connect` is dropped; every handler re-checks authority itself.
    this.registerHandlers(socket);
    this.armExpiry(socket);

    socket.on("disconnect", () => {
      if (data.expiryTimer) clearTimeout(data.expiryTimer);
      for (const conversationId of data.typingSentAt.keys()) {
        this.io?.to(realtimeRooms.conversation(conversationId)).emit(MessagingEvent.TypingStop, { conversationId, userId });
      }
      if (this.presence.remove(organizationId, userId)) this.emitPresence(organizationId, userId, "offline");
    });

    await socket.join([realtimeRooms.org(organizationId), realtimeRooms.user(organizationId, userId)]);
    try {
      // Rooms mirror the database: join every conversation the user is an active member of.
      const ids = await this.inContext(data.identity, () => this.messaging.activeConversationIds(userId, MAX_AUTO_JOIN));
      if (socket.disconnected) return;
      await socket.join(ids.map(realtimeRooms.conversation));
      // A removal that committed between the read above and the join would have
      // tried to evict a socket that was not in the room yet. Re-read and converge:
      // any removal after THIS read finds the socket already joined and evicts it.
      const still = new Set(
        await this.inContext(data.identity, () => this.messaging.activeConversationIds(userId, MAX_AUTO_JOIN)),
      );
      for (const id of ids) if (!still.has(id)) await socket.leave(realtimeRooms.conversation(id));
    } catch (err) {
      log.error({ err, userId }, "failed to restore conversation rooms");
    }
    if (socket.disconnected) return;

    if (this.presence.add(organizationId, userId)) this.emitPresence(organizationId, userId, "online");
    const ready: RealtimeReadyPayload = {
      userId,
      organizationId,
      tokenExpiresAt: data.identity.expiresAt,
      onlineUserIds: this.presence.onlineUserIds(organizationId),
    };
    socket.emit(RealtimeSystemEvent.Ready, ready);
  }

  private emitPresence(organizationId: string, userId: string, status: "online" | "offline"): void {
    const payload: PresenceUpdatePayload = { userId, status, at: this.clock.now().toISOString() };
    this.io?.to(realtimeRooms.org(organizationId)).emit(MessagingEvent.PresenceUpdate, payload);
  }

  /** Disconnect when the token lapses without an `auth:refresh`. */
  private armExpiry(socket: Socket): void {
    const data = socket.data as SocketData;
    if (data.expiryTimer) clearTimeout(data.expiryTimer);
    const ms = Math.max(0, data.identity.expiresAt * 1000 - this.clock.now().getTime());
    data.expiryTimer = setTimeout(() => this.expire(socket), ms);
    data.expiryTimer.unref();
  }

  private expire(socket: Socket): void {
    socket.emit(RealtimeSystemEvent.AuthExpired, {});
    socket.disconnect(true);
  }

  // ── commands ─────────────────────────────────────────────────────────────

  private registerHandlers(socket: Socket): void {
    this.command(socket, Cmd.MessageCreate, messageCreateCommandSchema, async (cmd, id, data) => {
      this.enforceSendRate(data);
      await this.require(id.userId, "send", "message");
      const { conversationId, ...input } = cmd;
      return this.messaging.sendMessage(id.userId, conversationId, input);
    });

    this.command(socket, Cmd.ConversationJoin, conversationCommandSchema, async (cmd, id) => {
      await this.require(id.userId, "read", "conversation");
      // The whole point: asking to join grants nothing — membership is verified live.
      if (!(await this.messaging.isActiveMember(cmd.conversationId, id.userId))) {
        throw new AppError({ code: "messaging.conversation_not_found", message: "Conversation not found.", kind: "not_found" });
      }
      await socket.join(realtimeRooms.conversation(cmd.conversationId));
      // Same convergence check as on connect: membership may have been revoked mid-join.
      if (!(await this.messaging.isActiveMember(cmd.conversationId, id.userId))) {
        await socket.leave(realtimeRooms.conversation(cmd.conversationId));
        throw new AppError({ code: "messaging.conversation_not_found", message: "Conversation not found.", kind: "not_found" });
      }
      return { joined: true as const };
    });

    this.command(socket, Cmd.ConversationLeave, conversationCommandSchema, async (cmd) => {
      await socket.leave(realtimeRooms.conversation(cmd.conversationId));
      return { left: true as const };
    });

    this.command(socket, Cmd.ConversationRead, conversationReadCommandSchema, async (cmd, id) => {
      await this.require(id.userId, "read", "conversation");
      return this.messaging.markRead(id.userId, cmd.conversationId, cmd.messageId);
    });

    this.command(socket, Cmd.TypingStart, conversationCommandSchema, async (cmd, id, data) => {
      const room = realtimeRooms.conversation(cmd.conversationId);
      // Being in the room already proves membership (joined only after a live check;
      // removal drops the room), so typing costs no database round-trip.
      if (!socket.rooms.has(room)) throw notJoined();
      const now = Date.now();
      if (now - (data.typingSentAt.get(cmd.conversationId) ?? 0) >= TYPING_MIN_INTERVAL_MS) {
        data.typingSentAt.set(cmd.conversationId, now);
        socket.to(room).emit(MessagingEvent.TypingStart, { conversationId: cmd.conversationId, userId: id.userId });
      }
      return { ok: true as const };
    });

    this.command(socket, Cmd.TypingStop, conversationCommandSchema, async (cmd, id, data) => {
      const room = realtimeRooms.conversation(cmd.conversationId);
      if (!socket.rooms.has(room)) throw notJoined();
      data.typingSentAt.delete(cmd.conversationId);
      socket.to(room).emit(MessagingEvent.TypingStop, { conversationId: cmd.conversationId, userId: id.userId });
      return { ok: true as const };
    });

    // Swap in a fresh access token without reconnecting. Must be the SAME user and tenant.
    socket.on(Cmd.AuthRefresh, (raw: unknown, ack?: (a: Ack<unknown>) => void) => {
      void (async () => {
        const data = socket.data as SocketData;
        try {
          const parsed = authRefreshCommandSchema.safeParse(raw);
          if (!parsed.success) throw ValidationError("request.invalid_body", "A token is required.");
          const next = await this.identityFromToken(parsed.data.token);
          if (next.userId !== data.identity.userId || next.organizationId !== data.identity.organizationId) {
            throw Forbidden("auth.identity_mismatch", "A token for a different user or organization cannot be swapped in.");
          }
          data.identity = next;
          this.armExpiry(socket);
          ack?.({ ok: true, data: { tokenExpiresAt: next.expiresAt } });
        } catch (err) {
          ack?.(failure(err));
        }
      })();
    });
  }

  /**
   * Wraps one client → server command: token still valid → payload validated →
   * handler runs inside the actor's ambient context → errors become `{ok:false}` acks.
   */
  private command<S extends z.ZodTypeAny, R>(
    socket: Socket,
    name: string,
    schema: S,
    handler: (payload: z.infer<S>, identity: SocketIdentity, data: SocketData) => Promise<R>,
  ): void {
    socket.on(name, (raw: unknown, ack?: (a: Ack<R>) => void) => {
      void (async () => {
        const data = socket.data as SocketData;
        try {
          if (this.clock.now().getTime() >= data.identity.expiresAt * 1000) {
            this.expire(socket);
            throw Unauthenticated("auth.token_expired", "Your session has expired.");
          }
          const parsed = schema.safeParse(raw);
          if (!parsed.success) {
            throw ValidationError("request.invalid_body", "The request is invalid.", {
              fields: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
            });
          }
          const result = await this.inContext(data.identity, () => handler(parsed.data, data.identity, data));
          ack?.({ ok: true, data: result });
        } catch (err) {
          if (!(err instanceof AppError)) log.error({ err, command: name }, "realtime command failed");
          ack?.(failure(err));
        }
      })();
    });
  }

  private inContext<T>(identity: Pick<SocketIdentity, "userId" | "organizationId">, fn: () => Promise<T>): Promise<T> {
    return withContext(
      { correlationId: newId("evt"), userId: identity.userId, organizationId: identity.organizationId },
      fn,
    );
  }

  /** Live RBAC — a permission revoked after connect takes effect on the next command. */
  private async require(userId: string, action: string, resource: string): Promise<void> {
    const allowed = await readInTenant(() => this.permissions.can(userId, action, resource));
    if (!allowed) throw Forbidden("auth.forbidden", `Missing permission: ${action}:${resource}`);
  }

  private enforceSendRate(data: SocketData): void {
    const now = Date.now();
    data.sendTimes = data.sendTimes.filter((t) => now - t < SEND_LIMIT.windowMs);
    if (data.sendTimes.length >= SEND_LIMIT.max) {
      throw new AppError({ code: "messaging.rate_limited", message: "You are sending messages too quickly.", kind: "rate_limited" });
    }
    data.sendTimes.push(now);
  }
}

function notJoined(): AppError {
  return new AppError({
    code: "messaging.not_joined",
    message: "Join the conversation before sending typing events.",
    kind: "forbidden",
  });
}

function failure(err: unknown): { ok: false; error: { code: string; message: string } } {
  if (err instanceof AppError) return { ok: false, error: { code: err.code, message: err.message } };
  return { ok: false, error: { code: "internal", message: "Something went wrong." } };
}

/** socket.io surfaces `err.data` to the client's `connect_error`. */
function handshakeError(code: string, message: string): Error & { data: { code: string } } {
  return Object.assign(new Error(message), { data: { code } });
}
