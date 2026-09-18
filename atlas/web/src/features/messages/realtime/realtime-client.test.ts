import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessagingCommand, RealtimeSystemEvent, type RealtimeReadyPayload } from "../contracts/realtime-events";
import { RealtimeClient, type SocketLike } from "./realtime-client";

type Handler = (...args: never[]) => void;

/** A controllable stand-in for a socket.io Socket. */
class FakeSocket implements SocketLike {
  connected = false;
  handlers = new Map<string, Handler[]>();
  emitted: Array<{ event: string; payload: unknown }> = [];
  acks = new Map<string, (payload: unknown) => unknown>();
  connectCalls = 0;
  disconnectCalls = 0;
  authFn!: (cb: (data: { token: string | null }) => void) => void;

  on(event: string, handler: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
  }
  off() {}
  emit(event: string, payload: unknown) {
    this.emitted.push({ event, payload });
  }
  timeout() {
    return { emitWithAck: async (event: string, payload: unknown) => this.acks.get(event)?.(payload) ?? { ok: true, data: {} } };
  }
  connect() {
    this.connectCalls++;
    this.connected = true;
  }
  disconnect() {
    this.disconnectCalls++;
    this.connected = false;
  }
  // server-side helpers
  fire(event: string, ...args: unknown[]) {
    for (const h of this.handlers.get(event) ?? []) (h as (...a: unknown[]) => void)(...args);
  }
  serverReady(over: Partial<RealtimeReadyPayload> = {}) {
    this.connected = true;
    this.fire(RealtimeSystemEvent.Ready, { userId: "u1", organizationId: "o1", tokenExpiresAt: Math.floor(Date.now() / 1000) + 900, onlineUserIds: ["u1"], ...over });
  }
}

let socket: FakeSocket;
const make = (getToken: (min?: number) => Promise<string | null> = vi.fn(async () => "tok-1"), extra: Partial<ConstructorParameters<typeof RealtimeClient>[0]> = {}) => {
  socket = new FakeSocket();
  const client = new RealtimeClient({
    url: "http://api.test",
    getToken,
    createSocket: (_url, auth) => {
      socket.authFn = auth;
      return socket;
    },
    ...extra,
  });
  return { client, getToken };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("RealtimeClient — connection lifecycle", () => {
  it("is 'connecting' until the server's ready event, then 'connected'", () => {
    const { client } = make();
    const statuses: string[] = [];
    client.onStatus((s) => statuses.push(s));
    client.start();
    expect(client.connectionStatus).toBe("connecting");
    socket.serverReady();
    expect(client.connectionStatus).toBe("connected");
    expect(statuses).toEqual(["connecting", "connected"]);
  });

  it("asks for a FRESH token on every connection attempt (auth is a function, not a value)", async () => {
    const getToken = vi.fn().mockResolvedValueOnce("tok-a").mockResolvedValueOnce("tok-b");
    const { client } = make(getToken);
    client.start();
    const got: Array<string | null> = [];
    socket.authFn((d) => got.push(d.token));
    socket.authFn((d) => got.push(d.token));
    await vi.advanceTimersByTimeAsync(0);
    expect(got).toEqual(["tok-a", "tok-b"]);
  });

  it("flags the second ready as a RECONNECT so the owner reconciles state — reconnecting alone is not trusted", () => {
    const { client } = make();
    const seen: boolean[] = [];
    client.onReady((_r, isReconnect) => seen.push(isReconnect));
    client.start();
    socket.serverReady();
    socket.fire("disconnect", "transport close");
    expect(client.connectionStatus).toBe("reconnecting");
    socket.serverReady();
    expect(seen).toEqual([false, true]);
  });

  it("reconnects itself when the SERVER closed the socket (Socket.IO does not in that case)", () => {
    const { client } = make();
    client.start();
    socket.serverReady();
    socket.fire("disconnect", "io server disconnect");
    expect(socket.connectCalls).toBe(0);
    vi.advanceTimersByTime(1_000);
    expect(socket.connectCalls).toBe(1);
  });

  it("does NOT fight Socket.IO's own reconnect for ordinary transport loss", () => {
    const { client } = make();
    client.start();
    socket.serverReady();
    socket.fire("disconnect", "transport close");
    vi.advanceTimersByTime(5_000);
    expect(socket.connectCalls).toBe(0);
  });

  it("retries after a rejected handshake (expired token) with a fresh token", () => {
    const { client } = make();
    client.start();
    socket.fire("connect_error", Object.assign(new Error("expired"), { data: { code: "auth.token_expired" } }));
    expect(client.connectionStatus).toBe("connecting");
    vi.advanceTimersByTime(1_000);
    expect(socket.connectCalls).toBe(1);
  });

  it("stop() closes the socket and is idle", () => {
    const { client } = make();
    client.start();
    client.stop();
    expect(socket.disconnectCalls).toBe(1);
    expect(client.connectionStatus).toBe("idle");
  });
});

describe("RealtimeClient — token refresh over the live socket", () => {
  it("swaps in a new token shortly BEFORE expiry, without reconnecting", async () => {
    const getToken = vi.fn(async (min?: number) => (min ? "tok-fresh" : "tok-1"));
    const { client } = make(getToken, { refreshLeadSeconds: 60 });
    client.start();
    const exp = Math.floor(Date.now() / 1000) + 120;
    socket.serverReady({ tokenExpiresAt: exp });
    socket.acks.set(MessagingCommand.AuthRefresh, () => ({ ok: true, data: { tokenExpiresAt: exp + 900 } }));

    await vi.advanceTimersByTimeAsync(59_000); // 60s before expiry — not yet
    expect(getToken).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(getToken).toHaveBeenCalledWith(90); // demands more validity than the current token has
    expect(socket.disconnectCalls).toBe(0);
  });

  it("does nothing if it cannot get a token (the server will close us at expiry; the disconnect path recovers)", async () => {
    const { client } = make(vi.fn(async () => null), { refreshLeadSeconds: 60 });
    client.start();
    socket.serverReady({ tokenExpiresAt: Math.floor(Date.now() / 1000) + 90 });
    await vi.advanceTimersByTimeAsync(40_000);
    expect(socket.emitted).toEqual([]);
  });
});

describe("RealtimeClient — events and commands", () => {
  it("forwards subscribed server events, including ones subscribed before start()", () => {
    const { client } = make();
    const early = vi.fn();
    client.on("messaging:message:created", early);
    client.start();
    const late = vi.fn();
    client.on("messaging:typing:start", late);
    socket.fire("messaging:message:created", { message: { id: "m1" } });
    socket.fire("messaging:typing:start", { userId: "u2" });
    expect(early).toHaveBeenCalledWith({ message: { id: "m1" } });
    expect(late).toHaveBeenCalledWith({ userId: "u2" });
  });

  it("an unsubscribed handler stops receiving", () => {
    const { client } = make();
    client.start();
    const h = vi.fn();
    const off = client.on("x", h);
    off();
    socket.fire("x", 1);
    expect(h).not.toHaveBeenCalled();
  });

  it("commands reject while offline; typing (ephemeral) is silently dropped", async () => {
    const { client } = make();
    client.start();
    socket.connected = false;
    await expect(client.command(MessagingCommand.MessageCreate, { conversationId: "c", body: "x", clientMessageId: "12345678" })).rejects.toThrow(/not connected/);
    client.emitEphemeral(MessagingCommand.TypingStart, { conversationId: "c" });
    expect(socket.emitted).toEqual([]);
  });

  it("commands resolve with the server's ack", async () => {
    const { client } = make();
    client.start();
    socket.serverReady();
    socket.acks.set(MessagingCommand.MessageCreate, () => ({ ok: true, data: { message: { id: "m1" }, deduplicated: false } }));
    const ack = await client.command(MessagingCommand.MessageCreate, { conversationId: "c", body: "hi", clientMessageId: "12345678" });
    expect(ack).toMatchObject({ ok: true });
  });
});
