import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import { fixedClock } from "@core/kernel/clock.js";
import { currentExecutor, unitOfWork } from "@core/kernel/db/db.js";
import { FILE_STORAGE } from "@core/kernel/tokens.js";
import type { IFileStorage } from "@core/contracts/index.js";
import { OutboxWorker } from "@core/events/outbox/outbox-worker.js";
import { IdentityService } from "@core/identity/application/identity-service.js";
import { OrganizationService } from "@core/organizations/application/organization-service.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import { MessagingService } from "@core/messaging/application/messaging-service.js";
import { MessagingEvent, realtimeRooms } from "@core/messaging/contracts/realtime-events.js";
import { RealtimeBroadcaster } from "@core/messaging/realtime/realtime-broadcaster.js";
import { asUser, createTestCore, get, hasTestDb } from "@core/tests/helpers.js";

const suite = hasTestDb ? describe : describe.skip;

suite("AURIC Core — messaging", () => {
  let core: TestingModule;
  const clock = fixedClock("2026-09-18T09:00:00.000Z");

  let alice: string; // org A admin (creator)
  let bob: string; // org A admin
  let carol: string; // org A admin
  let grace: string; // org A member with NO roles
  let eve: string; // org A admin, never added to the test conversations
  let dave: string; // org B admin
  let orgA: string;
  let orgB: string;

  const pw = "correct horse battery";
  const svc = () => get(core, MessagingService);
  const as = <T>(user: string, fn: () => Promise<T>) => asUser(user, orgA, fn);
  const send = (user: string, conversationId: string, body: string, extra: Record<string, unknown> = {}) =>
    as(user, () => svc().sendMessage(user, conversationId, { body, ...extra }));

  beforeAll(async () => {
    core = await createTestCore({ clock, requireEmailVerification: false });
    const ids = get(core, IdentityService);
    const orgs = get(core, OrganizationService);
    const rbac = get(core, RbacService);
    const reg = async (name: string) =>
      (await ids.register({ email: `${name}+${Date.now()}@t.test`, password: pw, displayName: name })).id;

    [alice, bob, carol, grace, eve, dave] = await Promise.all(
      ["alice", "bob", "carol", "grace", "eve", "dave"].map(reg),
    ) as [string, string, string, string, string, string];
    orgA = (await orgs.createOrganization({ name: "Org A", createdBy: alice })).id;
    orgB = (await orgs.createOrganization({ name: "Org B", createdBy: dave })).id;
    for (const u of [bob, carol, grace, eve]) {
      await asUser(alice, orgA, () => orgs.addMember({ organizationId: orgA, userId: u, actorId: alice }));
    }
    for (const u of [bob, carol, eve]) await asUser(alice, orgA, () => rbac.assignRole(u, "admin", alice));
  }, 60_000);

  afterAll(async () => {
    await core?.close();
  });

  const direct = (a: string, b: string) => as(a, () => svc().createConversation(a, { type: "direct", memberIds: [b] }));
  const group = (owner: string, members: string[], title = "Team") =>
    as(owner, () => svc().createConversation(owner, { type: "group", title, memberIds: members }));

  // ── conversations & participants ─────────────────────────────────────────

  describe("conversations", () => {
    it("creates a direct conversation and returns the SAME one on a repeat", async () => {
      const first = await direct(alice, bob);
      expect(first.type).toBe("direct");
      expect(first.members.map((m) => m.userId).sort()).toEqual([alice, bob].sort());
      expect(first.me?.role).toBe("owner");

      const again = await direct(bob, alice); // opened from the other side
      expect(again.id).toBe(first.id);
    });

    it("validates shape: direct needs exactly one other person; groups need members", async () => {
      await expect(as(alice, () => svc().createConversation(alice, { type: "direct", memberIds: [] }))).rejects.toMatchObject({
        code: "messaging.direct_needs_one_member",
      });
      await expect(as(alice, () => svc().createConversation(alice, { type: "direct", memberIds: [bob, carol] }))).rejects.toMatchObject({
        code: "messaging.direct_needs_one_member",
      });
      await expect(group(alice, [])).rejects.toMatchObject({ code: "messaging.members_required" });
    });

    it("refuses members from another organization", async () => {
      await expect(group(alice, [dave])).rejects.toMatchObject({ code: "messaging.member_not_in_organization" });
    });

    it("owner adds and removes members; non-owners cannot; removed members lose access", async () => {
      const conv = await group(alice, [bob]);
      await expect(as(bob, () => svc().addMembers(bob, conv.id, [carol]))).rejects.toMatchObject({ code: "messaging.owner_required" });

      const updated = await as(alice, () => svc().addMembers(alice, conv.id, [carol]));
      expect(updated.members.filter((m) => !m.leftAt)).toHaveLength(3);

      await as(alice, () => svc().removeMember(alice, conv.id, carol));
      await expect(as(carol, () => svc().getConversation(carol, conv.id))).rejects.toMatchObject({
        code: "messaging.conversation_not_found",
      });
      // …but her name stays attributable in the member list.
      const after = await as(alice, () => svc().getConversation(alice, conv.id));
      expect(after.members.find((m) => m.userId === carol)?.leftAt).not.toBeNull();

      // re-adding reactivates the same membership
      const readded = await as(alice, () => svc().addMembers(alice, conv.id, [carol]));
      expect(readded.members.find((m) => m.userId === carol)?.leftAt).toBeNull();
    });

    it("anyone may leave; the last owner may not; direct conversations are fixed", async () => {
      const conv = await group(alice, [bob]);
      await as(bob, () => svc().removeMember(bob, conv.id, bob)); // leave
      await expect(as(alice, () => svc().removeMember(alice, conv.id, alice))).rejects.toMatchObject({
        code: "messaging.last_owner",
      });
      const d = await direct(alice, carol);
      await expect(as(alice, () => svc().removeMember(alice, d.id, carol))).rejects.toMatchObject({
        code: "messaging.direct_fixed_members",
      });
      await expect(as(alice, () => svc().addMembers(alice, d.id, [bob]))).rejects.toMatchObject({
        code: "messaging.direct_fixed_members",
      });
    });

    it("lists only conversations you belong to, newest activity first, with unread counts", async () => {
      const c1 = await group(alice, [bob], "first");
      clock.advance(1000);
      const c2 = await group(alice, [bob], "second");
      clock.advance(1000);
      await send(alice, c1.id, "bump c1"); // c1 is now the most recently active

      const page = await as(bob, () => svc().listConversations(bob, { limit: 50 }));
      const ids = page.items.map((c) => c.id);
      expect(ids.indexOf(c1.id)).toBeLessThan(ids.indexOf(c2.id));
      expect(page.items.find((c) => c.id === c1.id)?.me?.unreadCount).toBe(1);
      expect(page.items.find((c) => c.id === c2.id)?.me?.unreadCount).toBe(0);

      const evePage = await as(eve, () => svc().listConversations(eve, { limit: 50 }));
      expect(evePage.items.map((c) => c.id)).not.toContain(c1.id);
    });

    it("paginates the inbox with a keyset cursor (no gaps, no duplicates)", async () => {
      const owner = await reg("pager");
      const seen: string[] = [];
      for (let i = 0; i < 5; i++) {
        clock.advance(1000);
        seen.push((await as(alice, () => svc().createConversation(alice, { type: "group", title: `p${i}`, memberIds: [owner] }))).id);
      }
      const collected: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await as(owner, () => svc().listConversations(owner, { limit: 2, ...(cursor ? { cursor } : {}) }));
        collected.push(...page.items.map((c) => c.id));
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      expect(collected).toEqual([...seen].reverse());
    });

    async function reg(name: string) {
      const id = (await get(core, IdentityService).register({ email: `${name}+${Date.now()}@t.test`, password: pw })).id;
      await asUser(alice, orgA, () => get(core, OrganizationService).addMember({ organizationId: orgA, userId: id, actorId: alice }));
      return id;
    }
  });

  // ── messages ─────────────────────────────────────────────────────────────

  describe("messages", () => {
    it("persists a message, advances the counters and the conversation's last-message metadata", async () => {
      const conv = await group(alice, [bob]);
      const { message, deduplicated } = await send(alice, conv.id, "  hello team  ");
      expect(deduplicated).toBe(false);
      expect(message.body).toBe("hello team");
      expect(message.seq).toBe(1);
      expect(message.changeSeq).toBe(1);

      const second = (await send(bob, conv.id, "hi")).message;
      expect(second.seq).toBe(2);

      const fresh = await as(alice, () => svc().getConversation(alice, conv.id));
      expect(fresh.lastMessage?.id).toBe(second.id);
      expect(fresh.lastMessageAt).not.toBeNull();
      expect(fresh.lastChangeSeq).toBe(2);
    });

    it("is idempotent on clientMessageId — a retried send never duplicates", async () => {
      const conv = await group(alice, [bob]);
      const clientMessageId = "0b8b0c1e-5d7c-4d3e-9f6c-1f8f2a6b7c10";
      const first = await send(alice, conv.id, "once", { clientMessageId });
      const retry = await send(alice, conv.id, "once", { clientMessageId });
      expect(retry.deduplicated).toBe(true);
      expect(retry.message.id).toBe(first.message.id);

      const history = await as(alice, () => svc().listMessages(alice, conv.id, { limit: 50 }));
      expect(history.messages).toHaveLength(1);

      // the same key from a DIFFERENT sender is a different message
      const other = await send(bob, conv.id, "once", { clientMessageId });
      expect(other.deduplicated).toBe(false);
    });

    it("survives concurrent duplicate sends (conversation lock serialises them)", async () => {
      const conv = await group(alice, [bob]);
      const clientMessageId = "concurrent-dupe-0001";
      const results = await Promise.all(
        Array.from({ length: 5 }, () => send(alice, conv.id, "race", { clientMessageId })),
      );
      expect(new Set(results.map((r) => r.message.id)).size).toBe(1);
      expect(results.filter((r) => !r.deduplicated)).toHaveLength(1);
    });

    it("assigns gap-free sequential seq under concurrent senders", async () => {
      const conv = await group(alice, [bob]);
      const sent = await Promise.all([
        ...Array.from({ length: 6 }, (_, i) => send(alice, conv.id, `a${i}`)),
        ...Array.from({ length: 6 }, (_, i) => send(bob, conv.id, `b${i}`)),
      ]);
      expect(sent.map((s) => s.message.seq).sort((x, y) => x - y)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    });

    it("supports replies, but only to messages in the same conversation", async () => {
      const conv = await group(alice, [bob]);
      const other = await group(alice, [bob], "other");
      const parent = (await send(alice, conv.id, "question?")).message;
      const reply = (await send(bob, conv.id, "answer", { replyToMessageId: parent.id })).message;
      expect(reply.replyToMessageId).toBe(parent.id);

      await expect(send(bob, other.id, "wrong place", { replyToMessageId: parent.id })).rejects.toMatchObject({
        code: "messaging.reply_target_invalid",
      });
    });

    it("rejects sending to a conversation you are not in, and to an archived one", async () => {
      const conv = await group(alice, [bob]);
      await expect(send(eve, conv.id, "sneak")).rejects.toMatchObject({ code: "messaging.conversation_not_found" });

      await as(alice, () => svc().updateConversation(alice, conv.id, { archived: true }));
      await expect(send(alice, conv.id, "late")).rejects.toMatchObject({ code: "messaging.conversation_archived" });
    });

    it("edits: only the sender, marks editedAt, bumps changeSeq, never the creation seq", async () => {
      const conv = await group(alice, [bob]);
      const m = (await send(alice, conv.id, "typo")).message;
      await expect(as(bob, () => svc().editMessage(bob, conv.id, m.id, "hax"))).rejects.toMatchObject({
        code: "messaging.not_your_message",
      });
      clock.advance(5000);
      const edited = await as(alice, () => svc().editMessage(alice, conv.id, m.id, "fixed"));
      expect(edited.body).toBe("fixed");
      expect(edited.editedAt).not.toBeNull();
      expect(edited.seq).toBe(m.seq);
      expect(edited.changeSeq).toBeGreaterThan(m.changeSeq);
    });

    it("deletes: wipes the body, keeps a tombstone; others need moderate:message", async () => {
      const conv = await group(alice, [bob, grace]);
      const mine = (await send(grace, conv.id, "secret thing")).message;
      const bobs = (await send(bob, conv.id, "bob's")).message;
      await expect(as(grace, () => svc().deleteMessage(grace, conv.id, bobs.id))).rejects.toMatchObject({
        code: "messaging.not_your_message",
      });
      await as(grace, () => svc().deleteMessage(grace, conv.id, mine.id));
      await as(grace, () => svc().deleteMessage(grace, conv.id, mine.id)); // idempotent

      const history = await as(alice, () => svc().listMessages(alice, conv.id, { limit: 50 }));
      const tomb = history.messages.find((m) => m.id === mine.id)!;
      expect(tomb.deletedAt).not.toBeNull();
      expect(tomb.body).toBe("");

      // the body is really gone from the database, not just hidden by the DTO
      const raw = await as(alice, () =>
        currentExecutor().selectFrom("messaging_messages").select("body").where("id", "=", mine.id).executeTakeFirstOrThrow(),
      );
      expect(raw.body).toBe("");

      // a moderator (admin role → *:*) can delete someone else's message
      const theirs = (await send(grace, conv.id, "moderate me")).message;
      await as(bob, () => svc().deleteMessage(bob, conv.id, theirs.id));
      await expect(as(grace, () => svc().editMessage(grace, conv.id, theirs.id, "again"))).rejects.toMatchObject({
        code: "messaging.message_deleted",
      });
    });

    it("reactions: add/remove are per-user, idempotent, and bump changeSeq", async () => {
      const conv = await group(alice, [bob]);
      const m = (await send(alice, conv.id, "react to me")).message;
      const a = await as(bob, () => svc().addReaction(bob, conv.id, m.id, "👍"));
      expect(a.reactions).toEqual([{ emoji: "👍", userIds: [bob] }]);
      expect(a.changeSeq).toBeGreaterThan(m.changeSeq);

      const again = await as(bob, () => svc().addReaction(bob, conv.id, m.id, "👍"));
      expect(again.changeSeq).toBe(a.changeSeq); // no-op → no change event

      const gone = await as(bob, () => svc().removeReaction(bob, conv.id, m.id, "👍"));
      expect(gone.reactions).toEqual([]);
    });
  });

  // ── history / sync ───────────────────────────────────────────────────────

  describe("history and resync", () => {
    it("cursor-paginates history: latest first, scroll upward, no overlap, terminates", async () => {
      const conv = await group(alice, [bob]);
      for (let i = 1; i <= 25; i++) await send(i % 2 ? alice : bob, conv.id, `m${i}`);

      const p1 = await as(alice, () => svc().listMessages(alice, conv.id, { limit: 10 }));
      expect(p1.messages.map((m) => m.body)).toEqual(Array.from({ length: 10 }, (_, i) => `m${16 + i}`)); // oldest→newest
      expect(p1.olderCursor).toBe(16);

      const p2 = await as(alice, () => svc().listMessages(alice, conv.id, { limit: 10, before: p1.olderCursor! }));
      expect(p2.messages.map((m) => m.body)).toEqual(Array.from({ length: 10 }, (_, i) => `m${6 + i}`));

      const p3 = await as(alice, () => svc().listMessages(alice, conv.id, { limit: 10, before: p2.olderCursor! }));
      expect(p3.messages.map((m) => m.body)).toEqual(Array.from({ length: 5 }, (_, i) => `m${1 + i}`));
      expect(p3.olderCursor).toBeNull();
    });

    it("sync returns every create/edit/delete/reaction after the cursor, ascending", async () => {
      const conv = await group(alice, [bob]);
      const m1 = (await send(alice, conv.id, "one")).message;
      const m2 = (await send(alice, conv.id, "two")).message;
      const cursor = (await as(bob, () => svc().syncMessages(bob, conv.id, { afterChangeSeq: 0, limit: 100 }))).lastChangeSeq;

      // while bob is "offline":
      const m3 = (await send(alice, conv.id, "three")).message;
      await as(alice, () => svc().editMessage(alice, conv.id, m1.id, "one!"));
      await as(alice, () => svc().deleteMessage(alice, conv.id, m2.id));

      const sync = await as(bob, () => svc().syncMessages(bob, conv.id, { afterChangeSeq: cursor, limit: 100 }));
      expect(sync.hasMore).toBe(false);
      const byId = new Map(sync.messages.map((m) => [m.id, m]));
      expect(byId.get(m3.id)?.body).toBe("three");
      expect(byId.get(m1.id)?.body).toBe("one!");
      expect(byId.get(m2.id)?.deletedAt).not.toBeNull();
      const seqs = sync.messages.map((m) => m.changeSeq);
      expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
      expect(sync.lastChangeSeq).toBe(Math.max(...seqs));
    });

    it("sync pages when there are more changes than the limit", async () => {
      const conv = await group(alice, [bob]);
      for (let i = 0; i < 7; i++) await send(alice, conv.id, `x${i}`);
      const first = await as(bob, () => svc().syncMessages(bob, conv.id, { afterChangeSeq: 0, limit: 5 }));
      expect(first.messages).toHaveLength(5);
      expect(first.hasMore).toBe(true);
      const rest = await as(bob, () =>
        svc().syncMessages(bob, conv.id, { afterChangeSeq: first.messages.at(-1)!.changeSeq, limit: 5 }),
      );
      expect(rest.messages).toHaveLength(2);
      expect(rest.hasMore).toBe(false);
    });
  });

  // ── read cursor ──────────────────────────────────────────────────────────

  describe("read cursor", () => {
    it("moves forward only and drives the unread count — one cursor row, not one per message", async () => {
      const conv = await group(alice, [bob]);
      const ms: Awaited<ReturnType<typeof send>>["message"][] = [];
      for (let i = 0; i < 4; i++) ms.push((await send(alice, conv.id, `r${i}`)).message);

      expect((await as(bob, () => svc().getConversation(bob, conv.id))).me?.unreadCount).toBe(4);

      const half = await as(bob, () => svc().markRead(bob, conv.id, ms[1]!.id));
      expect(half.lastReadMessageId).toBe(ms[1]!.id);
      expect((await as(bob, () => svc().getConversation(bob, conv.id))).me?.unreadCount).toBe(2);

      // an OLDER message never drags the cursor back
      const back = await as(bob, () => svc().markRead(bob, conv.id, ms[0]!.id));
      expect(back.lastReadMessageId).toBe(ms[1]!.id);

      const all = await as(bob, () => svc().markRead(bob, conv.id));
      expect(all.lastReadMessageId).toBe(ms[3]!.id);
      expect((await as(bob, () => svc().getConversation(bob, conv.id))).me?.unreadCount).toBe(0);

      const rows = await as(alice, () =>
        currentExecutor().selectFrom("messaging_conversation_members").select("user_id").where("conversation_id", "=", conv.id).execute(),
      );
      expect(rows).toHaveLength(2); // members only — no per-message receipt rows
    });

    it("broadcasts a read event only when the cursor actually moved", async () => {
      const conv = await group(alice, [bob]);
      const m = (await send(alice, conv.id, "seen?")).message;
      const spy = vi.spyOn(get(core, RealtimeBroadcaster), "toRoom");
      await as(bob, () => svc().markRead(bob, conv.id, m.id));
      await as(bob, () => svc().markRead(bob, conv.id, m.id));
      const reads = spy.mock.calls.filter(([, ev]) => ev === MessagingEvent.ConversationRead);
      expect(reads).toHaveLength(1);
      expect(reads[0]![0]).toBe(realtimeRooms.conversation(conv.id));
      spy.mockRestore();
    });

    it("a member's own send counts as read up to it", async () => {
      const conv = await group(alice, [bob]);
      await send(bob, conv.id, "mine");
      expect((await as(bob, () => svc().getConversation(bob, conv.id))).me?.unreadCount).toBe(0);
    });
  });

  // ── attachments ──────────────────────────────────────────────────────────

  describe("attachments", () => {
    const upload = (owner: string, name: string) =>
      as(owner, () =>
        get<IFileStorage>(core, FILE_STORAGE).upload({
          content: Buffer.from(`bytes of ${name}`),
          originalName: name,
          contentType: "application/pdf",
          ownerId: owner,
        }),
      );

    it("references Core files by id (never bytes) and members can download them", async () => {
      const conv = await group(alice, [bob]);
      const file = await upload(alice, "floor_plan.pdf");
      const { message } = await send(alice, conv.id, "plans attached", { attachmentFileIds: [file.id] });
      expect(message.attachments).toHaveLength(1);
      expect(message.attachments[0]).toMatchObject({ fileId: file.id, fileName: "floor_plan.pdf", contentType: "application/pdf" });

      const dl = await as(bob, () => svc().downloadAttachment(bob, conv.id, message.attachments[0]!.id));
      expect(dl.content.toString()).toBe("bytes of floor_plan.pdf");
    });

    it("allows an attachment-only message, but refuses files you did not upload", async () => {
      const conv = await group(alice, [bob]);
      const mine = await upload(alice, "a.pdf");
      const theirs = await upload(bob, "b.pdf");
      await expect(send(alice, conv.id, "", { attachmentFileIds: [theirs.id] })).rejects.toMatchObject({
        code: "messaging.attachment_invalid",
      });
      await expect(send(alice, conv.id, "", { attachmentFileIds: ["file_doesnotexist"] })).rejects.toMatchObject({
        code: "messaging.attachment_invalid",
      });
      const ok = await send(alice, conv.id, "", { attachmentFileIds: [mine.id] });
      expect(ok.message.body).toBe("");
    });

    it("non-members cannot download; deleting the message revokes the download", async () => {
      const conv = await group(alice, [bob]);
      const file = await upload(alice, "secret.pdf");
      const { message } = await send(alice, conv.id, "x", { attachmentFileIds: [file.id] });
      const attachmentId = message.attachments[0]!.id;

      await expect(as(eve, () => svc().downloadAttachment(eve, conv.id, attachmentId))).rejects.toMatchObject({
        code: "messaging.conversation_not_found",
      });
      // right attachment id, WRONG conversation → not found (no cross-conversation reach)
      const other = await group(alice, [bob], "other");
      await expect(as(alice, () => svc().downloadAttachment(alice, other.id, attachmentId))).rejects.toMatchObject({
        code: "messaging.attachment_not_found",
      });

      await as(alice, () => svc().deleteMessage(alice, conv.id, message.id));
      await expect(as(bob, () => svc().downloadAttachment(bob, conv.id, attachmentId))).rejects.toMatchObject({
        code: "messaging.attachment_not_found",
      });
    });
  });

  // ── tenant isolation & membership ────────────────────────────────────────

  describe("tenant isolation", () => {
    it("Tenant B cannot read, list, send to, or download from Tenant A's conversations", async () => {
      const conv = await group(alice, [bob]);
      const file = await as(alice, () =>
        get<IFileStorage>(core, FILE_STORAGE).upload({ content: Buffer.from("a"), originalName: "a.txt", contentType: "text/plain", ownerId: alice }),
      );
      const { message } = await send(alice, conv.id, "tenant A only", { attachmentFileIds: [file.id] });

      const inB = <T>(fn: () => Promise<T>) => asUser(dave, orgB, fn);
      const notFound = { code: "messaging.conversation_not_found" };
      await expect(inB(() => svc().getConversation(dave, conv.id))).rejects.toMatchObject(notFound);
      await expect(inB(() => svc().listMessages(dave, conv.id, { limit: 10 }))).rejects.toMatchObject(notFound);
      await expect(inB(() => svc().syncMessages(dave, conv.id, { afterChangeSeq: 0, limit: 10 }))).rejects.toMatchObject(notFound);
      await expect(inB(() => svc().sendMessage(dave, conv.id, { body: "let me in" }))).rejects.toMatchObject(notFound);
      await expect(inB(() => svc().markRead(dave, conv.id))).rejects.toMatchObject(notFound);
      await expect(inB(() => svc().downloadAttachment(dave, conv.id, message.attachments[0]!.id))).rejects.toMatchObject(notFound);
      expect(await inB(() => svc().isActiveMember(conv.id, dave))).toBe(false);
      expect((await inB(() => svc().listConversations(dave, { limit: 50 }))).items).toHaveLength(0);
      expect(await inB(() => svc().searchMessages(dave, { query: "tenant A" }))).toHaveLength(0);
    });

    it("RLS is the backstop: even a raw, unscoped query in Tenant B sees none of Tenant A's rows", async () => {
      const conv = await group(alice, [bob]);
      await send(alice, conv.id, "rls check");
      const seen = await asUser(dave, orgB, () =>
        unitOfWork.transaction(async () => ({
          conversations: await currentExecutor().selectFrom("messaging_conversations").select("id").execute(),
          messages: await currentExecutor().selectFrom("messaging_messages").select("id").execute(),
          members: await currentExecutor().selectFrom("messaging_conversation_members").select("user_id").execute(),
        })),
      );
      expect(seen.conversations.map((r) => r.id)).not.toContain(conv.id);
      expect(seen.messages).toHaveLength(0);
      expect(seen.members).toHaveLength(0);
    });

    it("RLS blocks a write tagged with another tenant even if the service were bypassed", async () => {
      const conv = await group(alice, [bob]);
      await expect(
        asUser(dave, orgB, () =>
          unitOfWork.transaction(() =>
            currentExecutor()
              .insertInto("messaging_messages")
              .values({
                id: "mmsg_forged", conversation_id: conv.id, organization_id: orgA, sender_id: dave,
                body: "forged", seq: 999, change_seq: 999,
              })
              .execute(),
          ),
        ),
      ).rejects.toThrow();
    });

    it("a same-tenant NON-member is refused too — membership, not just tenancy", async () => {
      const conv = await group(alice, [bob]);
      await send(alice, conv.id, "private to the group");
      const denied = { code: "messaging.conversation_not_found" };
      await expect(as(eve, () => svc().getConversation(eve, conv.id))).rejects.toMatchObject(denied);
      await expect(as(eve, () => svc().listMessages(eve, conv.id, { limit: 10 }))).rejects.toMatchObject(denied);
      await expect(as(eve, () => svc().searchMessages(eve, { query: "private to the group" }))).resolves.toHaveLength(0);
      expect(await as(eve, () => svc().isActiveMember(conv.id, eve))).toBe(false);
    });

    it("the AI-facing provider enforces the same membership boundary", async () => {
      const conv = await group(alice, [bob]);
      await send(alice, conv.id, "budget is 5M");
      await expect(as(eve, () => svc().recentMessages(eve, conv.id, 10))).rejects.toMatchObject({ code: "messaging.conversation_not_found" });
      const ok = await as(bob, () => svc().recentMessages(bob, conv.id, 10));
      expect(ok.map((m) => m.body)).toEqual(["budget is 5M"]);
    });

    it("subject linkage is generic: conversations can be found by (subjectType, subjectId)", async () => {
      const c = await as(alice, () =>
        svc().createConversation(alice, { type: "group", title: "About a thing", memberIds: [bob], subjectType: "lead", subjectId: "lead_123" }),
      );
      const found = await as(alice, () => svc().conversationsForSubject(alice, "lead", "lead_123"));
      expect(found.map((f) => f.id)).toEqual([c.id]);
      expect(await as(alice, () => svc().conversationsForSubject(alice, "lead", "lead_other"))).toHaveLength(0);
    });
  });

  // ── outbox: nothing is broadcast before COMMIT ───────────────────────────

  describe("outbox → broadcast", () => {
    it("broadcasts only after COMMIT, from the outbox", async () => {
      const conv = await group(alice, [bob]);
      await get(core, OutboxWorker).tick(); // drain earlier tests' rows
      const spy = vi.spyOn(get(core, RealtimeBroadcaster), "toRoom");

      await send(alice, conv.id, "live");
      expect(spy).not.toHaveBeenCalled(); // committed, but the worker has not run yet
      await get(core, OutboxWorker).tick();

      const created = spy.mock.calls.filter(([, ev]) => ev === MessagingEvent.MessageCreated);
      expect(created).toHaveLength(1);
      expect(created[0]![0]).toBe(realtimeRooms.conversation(conv.id));
      expect((created[0]![2] as { message: { body: string } }).message.body).toBe("live");
      spy.mockRestore();
    });

    it("a rolled-back send leaves no message and broadcasts nothing", async () => {
      const conv = await group(alice, [bob]);
      await get(core, OutboxWorker).tick();
      const spy = vi.spyOn(get(core, RealtimeBroadcaster), "toRoom");

      await expect(
        as(alice, async () => {
          await svc().sendMessage(alice, conv.id, { body: "ghost" });
          throw new Error("something later in the transaction failed");
        }),
      ).rejects.toThrow("something later");

      await get(core, OutboxWorker).tick();
      expect(spy.mock.calls.filter(([, ev]) => ev === MessagingEvent.MessageCreated)).toHaveLength(0);
      const history = await as(alice, () => svc().listMessages(alice, conv.id, { limit: 10 }));
      expect(history.messages).toHaveLength(0);
      spy.mockRestore();
    });

    it("member events keep socket rooms in step: join before emit on add, emit before leave on remove", async () => {
      const conv = await group(alice, [bob]);
      await get(core, OutboxWorker).tick();
      const rt = get(core, RealtimeBroadcaster);
      const order: string[] = [];
      const join = vi.spyOn(rt, "joinUser").mockImplementation((_o, u) => void order.push(`join:${u}`));
      const leave = vi.spyOn(rt, "leaveUser").mockImplementation((_o, u) => void order.push(`leave:${u}`));
      const emit = vi.spyOn(rt, "toRoom").mockImplementation((_r, ev) => void order.push(`emit:${ev}`));

      await as(alice, () => svc().addMembers(alice, conv.id, [carol]));
      await get(core, OutboxWorker).tick();
      expect(order).toEqual([`join:${carol}`, `emit:${MessagingEvent.ConversationMemberAdded}`]);

      order.length = 0;
      await as(alice, () => svc().removeMember(alice, conv.id, carol));
      await get(core, OutboxWorker).tick();
      expect(order).toEqual([`emit:${MessagingEvent.ConversationMemberRemoved}`, `leave:${carol}`]);
      join.mockRestore();
      leave.mockRestore();
      emit.mockRestore();
    });
  });

  // ── audit ────────────────────────────────────────────────────────────────

  it("audits lifecycle actions without ever recording message bodies", async () => {
    const conv = await group(alice, [bob]);
    const secretText = "the-secret-body-text-9f1c";
    await send(alice, conv.id, secretText);
    const logs = await as(alice, () =>
      currentExecutor().selectFrom("audit_logs").select(["action", "after"]).where("action", "like", "messaging.%").execute(),
    );
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(["messaging.conversation.created", "messaging.message.sent"]));
    expect(JSON.stringify(logs)).not.toContain(secretText);
  });
});
