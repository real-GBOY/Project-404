import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import jwt from "jsonwebtoken";
import { io as connectClient, type Socket } from "socket.io-client";
import { AppModule } from "@core/app.module.js";
import { currentExecutor } from "@core/kernel/db/db.js";
import { migrateToLatest } from "@core/kernel/db/migrate.js";
import { FILE_STORAGE, REQUIRE_EMAIL_VERIFICATION } from "@core/kernel/tokens.js";
import type { IFileStorage } from "@core/contracts/index.js";
import { SeedService } from "@core/bootstrap/seed.service.js";
import { IdentityService } from "@core/identity/application/identity-service.js";
import { OrganizationService } from "@core/organizations/application/organization-service.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import { MessagingService } from "@core/messaging/application/messaging-service.js";
import {
  type Ack,
  type ConversationReadPayload,
  type MessageCreatedPayload,
  MessagingCommand,
  MessagingEvent,
  type PresenceUpdatePayload,
  type RealtimeReadyPayload,
  RealtimeSystemEvent,
  type TypingPayload,
} from "@core/messaging/contracts/realtime-events.js";
import type { ConversationDto, MessageSyncResult, SendMessageResult } from "@core/messaging/contracts/messaging-types.js";
import { applyTestConfig, asSystem, asUser, get, hasTestDb, resetSchema, TEST_DATABASE_URL } from "@core/tests/helpers.js";

const suite = hasTestDb ? describe : describe.skip;

/**
 * Real sockets against a real listening server: Fastify + Socket.IO + the
 * outbox worker running for real (autostart, nudged after commit) — nothing is
 * driven by hand. Identity always comes from a signed JWT, as in production.
 */
suite("AURIC Core — realtime messaging (WebSocket)", () => {
  let app: NestFastifyApplication;
  let baseUrl: string;

  let alice: string; // org A admin
  let bob: string; // org A admin
  let carol: string; // org A admin
  let eve: string; // org A admin, never in the test conversations
  let grace: string; // org A member, NO roles (no messaging permissions)
  let dave: string; // org B admin
  let orgA: string;
  let orgB: string;
  const emails = new Map<string, string>();

  const sockets: Socket[] = [];
  const pw = "correct horse battery";
  const svc = () => get<MessagingService>(app as never, MessagingService);

  /** Sign an access token exactly the way `JwtService` does (same secret/issuer/claims). */
  function token(userId: string, org: string | null, expiresInSec = 300): string {
    return jwt.sign({ email: emails.get(userId) ?? "x@t.test", org, perms: [] }, "test-secret", {
      subject: userId,
      issuer: "auric-core",
      expiresIn: expiresInSec,
      algorithm: "HS256",
    });
  }

  beforeAll(async () => {
    applyTestConfig();
    await resetSchema();
    await migrateToLatest(TEST_DATABASE_URL);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(REQUIRE_EMAIL_VERIFICATION)
      .useValue(false)
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix("api");
    await app.init(); // OnApplicationBootstrap: attaches Socket.IO to Fastify's server, starts the outbox worker
    await app.get(SeedService).seed();
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();

    const ids = app.get(IdentityService);
    const orgs = app.get(OrganizationService);
    const rbac = app.get(RbacService);
    const reg = async (name: string) => {
      const email = `${name}+${Date.now()}@t.test`;
      const id = (await ids.register({ email, password: pw, displayName: name })).id;
      emails.set(id, email);
      return id;
    };
    [alice, bob, carol, eve, grace, dave] = (await Promise.all(["alice", "bob", "carol", "eve", "grace", "dave"].map(reg))) as [
      string, string, string, string, string, string,
    ];
    orgA = (await orgs.createOrganization({ name: "Org A", createdBy: alice })).id;
    orgB = (await orgs.createOrganization({ name: "Org B", createdBy: dave })).id;
    for (const u of [bob, carol, eve, grace]) {
      await asUser(alice, orgA, () => orgs.addMember({ organizationId: orgA, userId: u, actorId: alice }));
    }
    for (const u of [bob, carol, eve]) await asUser(alice, orgA, () => rbac.assignRole(u, "admin", alice));
  }, 90_000);

  // Every test starts with nobody connected, so presence/room assertions are exact.
  afterEach(async () => {
    for (const s of sockets.splice(0)) s.disconnect();
    await new Promise((r) => setTimeout(r, 120));
  });

  afterAll(async () => {
    for (const s of sockets) s.disconnect();
    await app?.close();
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  function open(auth: { token?: string }): Socket {
    const s = connectClient(baseUrl, { auth, transports: ["websocket"], reconnection: false, forceNew: true });
    sockets.push(s);
    return s;
  }

  /** Connect and wait for the server's `realtime:ready` (rooms restored, presence registered). */
  async function connect(userId: string, org: string | null = orgA, expiresInSec = 300): Promise<{ socket: Socket; ready: RealtimeReadyPayload }> {
    const socket = open({ token: token(userId, org, expiresInSec) });
    const ready = await once<RealtimeReadyPayload>(socket, RealtimeSystemEvent.Ready);
    return { socket, ready };
  }

  function once<T>(socket: Socket, event: string, where: (p: T) => boolean = () => true, ms = 4000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off(event, handler);
        reject(new Error(`timed out waiting for "${event}"`));
      }, ms);
      const handler = (payload: T) => {
        if (!where(payload)) return;
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(payload);
      };
      socket.on(event, handler);
    });
  }

  /** Assert that NO matching event arrives within `ms` (the negative half of every isolation test). */
  function never<T>(socket: Socket, event: string, where: (p: T) => boolean = () => true, ms = 500): Promise<void> {
    return new Promise((resolve, reject) => {
      const handler = (payload: T) => {
        if (where(payload)) reject(new Error(`unexpected "${event}" received`));
      };
      socket.on(event, handler);
      setTimeout(() => {
        socket.off(event, handler);
        resolve();
      }, ms);
    });
  }

  const cmd = <T>(socket: Socket, name: string, payload: unknown): Promise<Ack<T>> =>
    socket.timeout(4000).emitWithAck(name, payload) as Promise<Ack<T>>;

  const newConversation = (owner: string, members: string[], title = "Team") =>
    asUser(owner, orgA, () => svc().createConversation(owner, { type: "group", title, memberIds: members }));

  const uuid = () => crypto.randomUUID();

  /** REST call as a user, exactly like the web client's axios. */
  async function rest<T>(userId: string, path: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
    const res = await fetch(`${baseUrl}/api${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token(userId, orgA)}`, "content-type": "application/json", ...(init.headers ?? {}) },
    });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
  }

  // ── authentication ─────────────────────────────────────────────────────────

  describe("connection authentication", () => {
    const rejected = (socket: Socket) =>
      new Promise<{ code?: string; message: string }>((resolve, reject) => {
        socket.on("connect_error", (err: Error & { data?: { code?: string } }) =>
          resolve({ ...(err.data?.code ? { code: err.data.code } : {}), message: err.message }),
        );
        socket.on("connect", () => reject(new Error("connection should have been rejected")));
      });

    it("rejects a connection with no token", async () => {
      expect((await rejected(open({}))).code).toBe("auth.unauthenticated");
    });

    it("rejects a garbage token", async () => {
      expect((await rejected(open({ token: "not.a.jwt" }))).code).toBe("auth.invalid_token");
    });

    it("rejects a token signed with the wrong secret", async () => {
      const forged = jwt.sign({ email: "x", org: orgA, perms: [] }, "wrong-secret", { subject: alice, issuer: "auric-core" });
      expect((await rejected(open({ token: forged }))).code).toBe("auth.invalid_token");
    });

    it("rejects an expired token", async () => {
      const expired = jwt.sign({ email: "x", org: orgA, perms: [] }, "test-secret", {
        subject: alice, issuer: "auric-core", expiresIn: -10,
      });
      expect((await rejected(open({ token: expired }))).code).toBe("auth.token_expired");
    });

    it("rejects an orgless token (no tenant to scope the connection to)", async () => {
      expect((await rejected(open({ token: token(alice, null) }))).code).toBe("tenant.required");
    });

    it("rejects a token claiming an organization the user does not belong to", async () => {
      // dave is only in org B; a token claiming org A must not get in
      expect((await rejected(open({ token: token(dave, orgA) }))).code).toBe("auth.not_a_member");
    });

    it("accepts a valid token and derives identity from it alone", async () => {
      const { ready } = await connect(alice);
      expect(ready).toMatchObject({ userId: alice, organizationId: orgA });
      expect(ready.onlineUserIds).toContain(alice);
      expect(ready.tokenExpiresAt).toBeGreaterThan(Date.now() / 1000);
    });
  });

  // ── rooms ──────────────────────────────────────────────────────────────────

  describe("conversation rooms", () => {
    it("auto-joins the rooms the database says you belong to — nothing more", async () => {
      const conv = await newConversation(alice, [bob]);
      const { socket: aliceS } = await connect(alice);
      const { socket: bobS } = await connect(bob);
      const { socket: eveS } = await connect(eve);

      const gotBob = once<MessageCreatedPayload>(bobS, MessagingEvent.MessageCreated, (p) => p.message.conversationId === conv.id);
      const eveSilent = never<MessageCreatedPayload>(eveS, MessagingEvent.MessageCreated, (p) => p.message.conversationId === conv.id);
      const sent = await cmd<SendMessageResult>(aliceS, MessagingCommand.MessageCreate, { conversationId: conv.id, body: "hi bob", clientMessageId: uuid() });
      expect(sent.ok).toBe(true);
      expect((await gotBob).message.body).toBe("hi bob");
      await eveSilent;
    });

    it("a client 'join' for someone else's conversation grants NOTHING", async () => {
      const conv = await newConversation(alice, [bob]);
      const { socket: eveS } = await connect(eve);
      const join = await cmd(eveS, MessagingCommand.ConversationJoin, { conversationId: conv.id });
      expect(join).toMatchObject({ ok: false, error: { code: "messaging.conversation_not_found" } });

      const { socket: aliceS } = await connect(alice);
      const silent = never<MessageCreatedPayload>(eveS, MessagingEvent.MessageCreated, (p) => p.message.conversationId === conv.id);
      await cmd(aliceS, MessagingCommand.MessageCreate, { conversationId: conv.id, body: "for members only", clientMessageId: uuid() });
      await silent;
    });

    it("a member's join succeeds (idempotent)", async () => {
      const conv = await newConversation(alice, [bob]);
      const { socket: bobS } = await connect(bob);
      expect(await cmd(bobS, MessagingCommand.ConversationJoin, { conversationId: conv.id })).toMatchObject({ ok: true });
      expect(await cmd(bobS, MessagingCommand.ConversationJoin, { conversationId: conv.id })).toMatchObject({ ok: true });
    });

    it("cross-tenant: Tenant B can neither join Tenant A's room nor receive its events", async () => {
      const conv = await newConversation(alice, [bob]);
      const { socket: daveS } = await connect(dave, orgB);
      const join = await cmd(daveS, MessagingCommand.ConversationJoin, { conversationId: conv.id });
      expect(join).toMatchObject({ ok: false, error: { code: "messaging.conversation_not_found" } });

      // …and cannot send into it or mark it read either
      expect(await cmd(daveS, MessagingCommand.MessageCreate, { conversationId: conv.id, body: "x", clientMessageId: uuid() }))
        .toMatchObject({ ok: false, error: { code: "messaging.conversation_not_found" } });
      expect(await cmd(daveS, MessagingCommand.ConversationRead, { conversationId: conv.id }))
        .toMatchObject({ ok: false, error: { code: "messaging.conversation_not_found" } });

      const { socket: aliceS } = await connect(alice);
      const silent = never<unknown>(daveS, MessagingEvent.MessageCreated);
      await cmd(aliceS, MessagingCommand.MessageCreate, { conversationId: conv.id, body: "tenant A eyes only", clientMessageId: uuid() });
      await silent;
    });

    it("adding a member joins their live sockets; removing one drops them from the room", async () => {
      const conv = await newConversation(alice, [bob]);
      const { socket: aliceS } = await connect(alice);
      const { socket: carolS } = await connect(carol);

      const added = once<{ conversationId: string }>(carolS, MessagingEvent.ConversationMemberAdded, (p) => p.conversationId === conv.id);
      await asUser(alice, orgA, () => svc().addMembers(alice, conv.id, [carol]));
      await added;

      const live = once<MessageCreatedPayload>(carolS, MessagingEvent.MessageCreated, (p) => p.message.conversationId === conv.id);
      await cmd(aliceS, MessagingCommand.MessageCreate, { conversationId: conv.id, body: "welcome carol", clientMessageId: uuid() });
      expect((await live).message.body).toBe("welcome carol");

      const removed = once<{ userId: string }>(carolS, MessagingEvent.ConversationMemberRemoved, (p) => p.userId === carol);
      await asUser(alice, orgA, () => svc().removeMember(alice, conv.id, carol));
      await removed;

      const silent = never<MessageCreatedPayload>(carolS, MessagingEvent.MessageCreated, (p) => p.message.conversationId === conv.id);
      await cmd(aliceS, MessagingCommand.MessageCreate, { conversationId: conv.id, body: "carol is gone", clientMessageId: uuid() });
      await silent;
      // and she cannot talk her way back in
      expect(await cmd(carolS, MessagingCommand.ConversationJoin, { conversationId: conv.id })).toMatchObject({ ok: false });
    });
  });

  // ── message flow ───────────────────────────────────────────────────────────

  describe("real-time message delivery", () => {
    it("acks the sender immediately and fans the COMMITTED message out to every member — no polling", async () => {
      const conv = await newConversation(alice, [bob, carol]);
      const { socket: aliceS } = await connect(alice);
      const { socket: bobS } = await connect(bob);
      const { socket: carolS } = await connect(carol);

      const started = Date.now();
      const bobGets = once<MessageCreatedPayload>(bobS, MessagingEvent.MessageCreated, (p) => p.message.conversationId === conv.id);
      const carolGets = once<MessageCreatedPayload>(carolS, MessagingEvent.MessageCreated, (p) => p.message.conversationId === conv.id);
      const aliceGets = once<MessageCreatedPayload>(aliceS, MessagingEvent.MessageCreated, (p) => p.message.conversationId === conv.id);

      const clientMessageId = uuid();
      const ack = await cmd<SendMessageResult>(aliceS, MessagingCommand.MessageCreate, {
        conversationId: conv.id, body: "Do you have anything around 5 million?", clientMessageId,
      });
      expect(ack.ok).toBe(true);

      const [b, c, a] = await Promise.all([bobGets, carolGets, aliceGets]);
      for (const got of [a, b, c]) {
        expect(got.message.body).toBe("Do you have anything around 5 million?");
        expect(got.message.senderId).toBe(alice); // identity from the token, not the payload
        expect(got.message.clientMessageId).toBe(clientMessageId);
      }
      // The database is the source of truth: the broadcast message is the persisted one.
      const stored = await asUser(alice, orgA, () => svc().listMessages(alice, conv.id, { limit: 10 }));
      expect(stored.messages.map((m) => m.id)).toEqual([b.message.id]);
      expect(Date.now() - started).toBeLessThan(1500);
    });

    it("ignores identity fields smuggled into the payload", async () => {
      const conv = await newConversation(alice, [bob]);
      const { socket: bobS } = await connect(bob);
      const ack = await cmd<SendMessageResult>(bobS, MessagingCommand.MessageCreate, {
        conversationId: conv.id, body: "who am i", clientMessageId: uuid(),
        senderId: alice, userId: alice, organizationId: orgB, permissions: ["*:*"],
      });
      expect(ack.ok && ack.data.message.senderId).toBe(bob);
    });

    it("is idempotent over the socket: a retry with the same clientMessageId never duplicates or re-broadcasts", async () => {
      const conv = await newConversation(alice, [bob]);
      const { socket: aliceS } = await connect(alice);
      const { socket: bobS } = await connect(bob);
      let received = 0;
      bobS.on(MessagingEvent.MessageCreated, (p: MessageCreatedPayload) => {
        if (p.message.conversationId === conv.id) received++;
      });

      const clientMessageId = uuid();
      const first = await cmd<SendMessageResult>(aliceS, MessagingCommand.MessageCreate, { conversationId: conv.id, body: "once", clientMessageId });
      const retry = await cmd<SendMessageResult>(aliceS, MessagingCommand.MessageCreate, { conversationId: conv.id, body: "once", clientMessageId });
      expect(first.ok && retry.ok && first.data.message.id === retry.data.message.id).toBe(true);
      expect(retry.ok && retry.data.deduplicated).toBe(true);

      await new Promise((r) => setTimeout(r, 400));
      expect(received).toBe(1);
      const history = await asUser(alice, orgA, () => svc().listMessages(alice, conv.id, { limit: 10 }));
      expect(history.messages).toHaveLength(1);
    });

    it("validates payloads and requires the idempotency key", async () => {
      const conv = await newConversation(alice, [bob]);
      const { socket } = await connect(alice);
      expect(await cmd(socket, MessagingCommand.MessageCreate, { conversationId: conv.id, body: "no key" }))
        .toMatchObject({ ok: false, error: { code: "request.invalid_body" } });
      expect(await cmd(socket, MessagingCommand.MessageCreate, { conversationId: conv.id, body: "   ", clientMessageId: uuid() }))
        .toMatchObject({ ok: false, error: { code: "request.invalid_body" } });
      expect(await cmd(socket, MessagingCommand.MessageCreate, "garbage")).toMatchObject({ ok: false });
    });

    it("enforces live RBAC: a connected user without send:message is refused", async () => {
      const conv = await newConversation(alice, [bob]);
      const { socket: graceS } = await connect(grace); // may connect; may not send
      expect(await cmd(graceS, MessagingCommand.MessageCreate, { conversationId: conv.id, body: "hi", clientMessageId: uuid() }))
        .toMatchObject({ ok: false, error: { code: "auth.forbidden" } });
    });

    it("carries attachment METADATA over the wire, never file bytes", async () => {
      const conv = await newConversation(alice, [bob]);
      const { socket: aliceS } = await connect(alice);
      const { socket: bobS } = await connect(bob);
      const file = await asUser(alice, orgA, () =>
        app.get<IFileStorage>(FILE_STORAGE, { strict: false }).upload({
          content: Buffer.from("PDF-BYTES-THAT-MUST-NOT-BE-BROADCAST"), originalName: "floor_plan.pdf", contentType: "application/pdf", ownerId: alice,
        }),
      );
      const gets = once<MessageCreatedPayload>(bobS, MessagingEvent.MessageCreated, (p) => p.message.conversationId === conv.id);
      await cmd(aliceS, MessagingCommand.MessageCreate, { conversationId: conv.id, body: "floor plan", clientMessageId: uuid(), attachmentFileIds: [file.id] });
      const got = await gets;
      expect(got.message.attachments[0]).toMatchObject({ fileId: file.id, fileName: "floor_plan.pdf", contentType: "application/pdf" });
      expect(JSON.stringify(got)).not.toContain("PDF-BYTES");
    });
  });

  // ── typing ─────────────────────────────────────────────────────────────────

  describe("typing indicators", () => {
    it("fan out to the other members (not the typist), throttled, without touching PostgreSQL", async () => {
      const conv = await newConversation(alice, [bob]);
      const { socket: aliceS } = await connect(alice);
      const { socket: bobS } = await connect(bob);
      await new Promise((r) => setTimeout(r, 200));

      const rowCounts = async () =>
        asSystem(async () => ({
          messages: Number((await currentExecutor().selectFrom("messaging_messages").select((eb) => eb.fn.countAll().as("n")).executeTakeFirstOrThrow()).n),
          outbox: Number((await currentExecutor().selectFrom("outbox_messages").select((eb) => eb.fn.countAll().as("n")).executeTakeFirstOrThrow()).n),
          audit: Number((await currentExecutor().selectFrom("audit_logs").select((eb) => eb.fn.countAll().as("n")).executeTakeFirstOrThrow()).n),
        }));
      const before = await rowCounts();

      let starts = 0;
      bobS.on(MessagingEvent.TypingStart, (p: TypingPayload) => p.conversationId === conv.id && starts++);
      const echo = never<TypingPayload>(aliceS, MessagingEvent.TypingStart, (p) => p.conversationId === conv.id);

      const first = once<TypingPayload>(bobS, MessagingEvent.TypingStart, (p) => p.conversationId === conv.id);
      for (let i = 0; i < 20; i++) await cmd(aliceS, MessagingCommand.TypingStart, { conversationId: conv.id }); // a burst of keystrokes
      expect(await first).toEqual({ conversationId: conv.id, userId: alice });
      const stop = once<TypingPayload>(bobS, MessagingEvent.TypingStop, (p) => p.conversationId === conv.id);
      await cmd(aliceS, MessagingCommand.TypingStop, { conversationId: conv.id });
      expect((await stop).userId).toBe(alice);
      await echo;

      expect(starts).toBe(1); // 20 keystrokes → 1 fan-out
      expect(await rowCounts()).toEqual(before); // ephemeral: zero rows written
    });

    it("refuses typing events for a conversation you have not joined", async () => {
      const conv = await newConversation(alice, [bob]);
      const { socket: eveS } = await connect(eve);
      expect(await cmd(eveS, MessagingCommand.TypingStart, { conversationId: conv.id })).toMatchObject({
        ok: false, error: { code: "messaging.not_joined" },
      });
    });

    it("emits a typing stop when the typist's socket drops", async () => {
      const conv = await newConversation(alice, [bob]);
      const { socket: aliceS } = await connect(alice);
      const { socket: bobS } = await connect(bob);
      await cmd(aliceS, MessagingCommand.TypingStart, { conversationId: conv.id });
      const stop = once<TypingPayload>(bobS, MessagingEvent.TypingStop, (p) => p.conversationId === conv.id);
      aliceS.disconnect();
      expect((await stop).userId).toBe(alice);
    });
  });

  // ── read receipts ──────────────────────────────────────────────────────────

  describe("read receipts", () => {
    it("moves the cursor and broadcasts a read event to the conversation", async () => {
      const conv = await newConversation(alice, [bob]);
      const { socket: aliceS } = await connect(alice);
      const { socket: bobS } = await connect(bob);
      const sent = await cmd<SendMessageResult>(aliceS, MessagingCommand.MessageCreate, { conversationId: conv.id, body: "read me", clientMessageId: uuid() });
      await once(bobS, MessagingEvent.MessageCreated, (p: MessageCreatedPayload) => p.message.conversationId === conv.id);

      const seen = once<ConversationReadPayload>(aliceS, MessagingEvent.ConversationRead, (p) => p.conversationId === conv.id);
      const ack = await cmd<{ lastReadMessageId: string }>(bobS, MessagingCommand.ConversationRead, { conversationId: conv.id });
      const messageId = sent.ok ? sent.data.message.id : "";
      expect(ack.ok && ack.data.lastReadMessageId).toBe(messageId);
      expect(await seen).toMatchObject({ conversationId: conv.id, userId: bob, lastReadMessageId: messageId });

      const view = await asUser(bob, orgA, () => svc().getConversation(bob, conv.id));
      expect(view.me?.unreadCount).toBe(0);
    });
  });

  // ── presence ───────────────────────────────────────────────────────────────

  describe("presence", () => {
    it("announces first-connect and last-disconnect once per user, not per tab", async () => {
      const { socket: aliceS } = await connect(alice);
      const updates: PresenceUpdatePayload[] = [];
      aliceS.on(MessagingEvent.PresenceUpdate, (p: PresenceUpdatePayload) => p.userId === carol && updates.push(p));

      const first = await connect(carol);
      await new Promise((r) => setTimeout(r, 150));
      const second = await connect(carol); // second tab
      await new Promise((r) => setTimeout(r, 150));
      expect(updates.map((u) => u.status)).toEqual(["online"]);
      expect(second.ready.onlineUserIds).toContain(carol);

      first.socket.disconnect(); // one tab closes — still online
      await new Promise((r) => setTimeout(r, 150));
      expect(updates.map((u) => u.status)).toEqual(["online"]);
      second.socket.disconnect();
      await new Promise((r) => setTimeout(r, 200));
      expect(updates.map((u) => u.status)).toEqual(["online", "offline"]);
    });

    it("is scoped to the tenant — org B never sees org A's users come and go", async () => {
      const { socket: daveS } = await connect(dave, orgB);
      const silent = never<PresenceUpdatePayload>(daveS, MessagingEvent.PresenceUpdate, (p) => p.userId === bob);
      const { socket } = await connect(bob);
      socket.disconnect();
      await silent;
    });
  });

  // ── reconnect / resync ─────────────────────────────────────────────────────

  describe("reconnect and resync", () => {
    it("recovers everything missed while offline (creates, edits, deletes) via REST sync, then resumes live", async () => {
      const conv = await newConversation(alice, [bob]);
      const { socket: aliceS } = await connect(alice);
      let { socket: bobS } = await connect(bob);

      // bob is caught up, and remembers his cursor
      const first = await cmd<SendMessageResult>(aliceS, MessagingCommand.MessageCreate, { conversationId: conv.id, body: "before", clientMessageId: uuid() });
      await once(bobS, MessagingEvent.MessageCreated, (p: MessageCreatedPayload) => p.message.conversationId === conv.id);
      const cursor = first.ok ? first.data.message.changeSeq : 0;

      // the network drops
      bobS.disconnect();
      await new Promise((r) => setTimeout(r, 200));

      // while bob is gone…
      const missed1 = await cmd<SendMessageResult>(aliceS, MessagingCommand.MessageCreate, { conversationId: conv.id, body: "missed one", clientMessageId: uuid() });
      await cmd(aliceS, MessagingCommand.MessageCreate, { conversationId: conv.id, body: "missed two", clientMessageId: uuid() });
      await asUser(alice, orgA, () => svc().editMessage(alice, conv.id, missed1.ok ? missed1.data.message.id : "", "missed one (edited)"));

      // reconnect: a fresh socket does NOT replay anything by itself…
      const replay = never<MessageCreatedPayload>(open({ token: token(bob, orgA) }), MessagingEvent.MessageCreated);
      await replay;

      // …the client reconciles through REST from its last cursor
      const sync = await rest<MessageSyncResult>(bob, `/conversations/${conv.id}/sync?afterChangeSeq=${cursor}`);
      expect(sync.status).toBe(200);
      const bodies = new Map(sync.body.messages.map((m) => [m.id, m.body]));
      expect(bodies.get(missed1.ok ? missed1.data.message.id : "")).toBe("missed one (edited)");
      expect([...bodies.values()]).toContain("missed two");
      expect(sync.body.hasMore).toBe(false);

      // and live delivery continues on the new connection
      ({ socket: bobS } = await connect(bob));
      const live = once<MessageCreatedPayload>(bobS, MessagingEvent.MessageCreated, (p) => p.message.conversationId === conv.id);
      await cmd(aliceS, MessagingCommand.MessageCreate, { conversationId: conv.id, body: "back online", clientMessageId: uuid() });
      expect((await live).message.body).toBe("back online");
    });

    it("restores authorized subscriptions on reconnect from the database — and only those", async () => {
      const conv = await newConversation(alice, [bob]);
      const { socket: bobS } = await connect(bob);
      bobS.disconnect();
      // membership changes while bob is offline
      await asUser(alice, orgA, () => svc().removeMember(alice, conv.id, bob));

      const { socket: bobAgain } = await connect(bob);
      const { socket: aliceS } = await connect(alice);
      const silent = never<MessageCreatedPayload>(bobAgain, MessagingEvent.MessageCreated, (p) => p.message.conversationId === conv.id);
      await cmd(aliceS, MessagingCommand.MessageCreate, { conversationId: conv.id, body: "bob was removed", clientMessageId: uuid() });
      await silent;
    });

    it("REST history + resync refuse non-members and other tenants (HTTP guards, same rules)", async () => {
      const conv = await newConversation(alice, [bob]);
      expect((await rest(eve, `/conversations/${conv.id}/messages`)).status).toBe(404);
      expect((await rest(eve, `/conversations/${conv.id}/sync?afterChangeSeq=0`)).status).toBe(404);
      const asDave = await fetch(`${baseUrl}/api/conversations/${conv.id}/messages`, { headers: { authorization: `Bearer ${token(dave, orgB)}` } });
      expect(asDave.status).toBe(404);
      const noAuth = await fetch(`${baseUrl}/api/conversations/${conv.id}/messages`);
      expect(noAuth.status).toBe(401);
      expect((await rest<{ items: ConversationDto[] }>(bob, "/conversations")).body.items.map((c) => c.id)).toContain(conv.id);
    });

    it("cursor-paginates history over REST (latest first, scroll upward)", async () => {
      const conv = await newConversation(alice, [bob]);
      const { socket: aliceS } = await connect(alice);
      for (let i = 1; i <= 12; i++) {
        await cmd(aliceS, MessagingCommand.MessageCreate, { conversationId: conv.id, body: `h${i}`, clientMessageId: uuid() });
      }
      const p1 = await rest<{ messages: Array<{ body: string }>; olderCursor: number | null }>(bob, `/conversations/${conv.id}/messages?limit=5`);
      expect(p1.body.messages.map((m) => m.body)).toEqual(["h8", "h9", "h10", "h11", "h12"]);
      const p2 = await rest<{ messages: Array<{ body: string }>; olderCursor: number | null }>(bob, `/conversations/${conv.id}/messages?limit=5&before=${p1.body.olderCursor}`);
      expect(p2.body.messages.map((m) => m.body)).toEqual(["h3", "h4", "h5", "h6", "h7"]);
    });
  });

  // ── token lifecycle ────────────────────────────────────────────────────────

  describe("token expiry", () => {
    it("closes a socket whose token lapses without a refresh", async () => {
      const { socket } = await connect(alice, orgA, 2);
      const expired = once(socket, RealtimeSystemEvent.AuthExpired, () => true, 5000);
      const closed = new Promise<void>((resolve) => socket.on("disconnect", () => resolve()));
      await expired;
      await closed;
      expect(socket.connected).toBe(false);
    }, 10_000);

    it("stays connected across expiry when the client swaps in a fresh token (auth:refresh)", async () => {
      const conv = await newConversation(alice, [bob]);
      const { socket } = await connect(alice, orgA, 2);
      const ack = await cmd<{ tokenExpiresAt: number }>(socket, MessagingCommand.AuthRefresh, { token: token(alice, orgA, 300) });
      expect(ack.ok).toBe(true);
      await new Promise((r) => setTimeout(r, 2600)); // past the ORIGINAL expiry
      expect(socket.connected).toBe(true);
      expect(await cmd(socket, MessagingCommand.MessageCreate, { conversationId: conv.id, body: "still here", clientMessageId: uuid() })).toMatchObject({ ok: true });
    }, 10_000);

    it("refuses to swap in a token for a different user or organization", async () => {
      const { socket } = await connect(alice, orgA);
      expect(await cmd(socket, MessagingCommand.AuthRefresh, { token: token(bob, orgA) })).toMatchObject({ ok: false, error: { code: "auth.identity_mismatch" } });
      expect(await cmd(socket, MessagingCommand.AuthRefresh, { token: token(dave, orgB) })).toMatchObject({ ok: false, error: { code: "auth.identity_mismatch" } });
      expect(await cmd(socket, MessagingCommand.AuthRefresh, { token: "junk-token-value" })).toMatchObject({ ok: false });
    });

    it("rejects commands once the token has expired, even before the socket is closed", async () => {
      const { socket } = await connect(alice, orgA, 1);
      await new Promise((r) => setTimeout(r, 1300));
      const conv = await newConversation(alice, [bob]);
      const res = await socket.timeout(2000).emitWithAck(MessagingCommand.MessageCreate, { conversationId: conv.id, body: "late", clientMessageId: uuid() }).catch(() => null);
      // either the command was refused, or the socket was already closed — never accepted
      expect(res === null || (res as Ack<unknown>).ok === false).toBe(true);
    });
  });
});
