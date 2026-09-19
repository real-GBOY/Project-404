import { describe, expect, it } from "vitest";
import type { ConversationDto, MessageDto, Page } from "@auric/contracts/messaging";
import type { InsightRequirements } from "@atlas-contracts/insights";
import {
  applyMessageToInbox,
  applyReadToInbox,
  clearUnread,
  conversationTitle,
  removeConversation,
  totalUnread,
  upsertConversation,
} from "./conversation-cache";
import { requirementLines } from "./requirements";

const ME = "u_me";

const message = (seq: number, over: Partial<MessageDto> = {}): MessageDto => ({
  id: `m${seq}`, conversationId: "c1", senderId: "u_other", body: `b${seq}`, messageType: "text", clientMessageId: null,
  replyToMessageId: null, seq, changeSeq: seq, createdAt: `2026-09-18T10:00:0${seq}.000Z`, updatedAt: "x", editedAt: null,
  deletedAt: null, metadata: {}, attachments: [], reactions: [], ...over,
});

const conv = (id: string, over: Partial<ConversationDto> = {}): ConversationDto => ({
  id, type: "group", title: id, subjectType: null, subjectId: null, createdBy: ME, createdAt: "2026-09-18T09:00:00.000Z",
  updatedAt: "x", lastMessageAt: null, lastMessage: null, archivedAt: null, metadata: {}, lastChangeSeq: 0,
  members: [
    { userId: ME, displayName: "Me", role: "owner", joinedAt: "j", leftAt: null, lastReadMessageId: null, lastReadAt: null },
    { userId: "u_other", displayName: "Ahmed Ali", role: "member", joinedAt: "j", leftAt: null, lastReadMessageId: null, lastReadAt: null },
  ],
  me: { lastReadMessageId: null, lastReadAt: null, unreadCount: 0, muted: false, role: "owner" },
  ...over,
});

const inbox = (...items: ConversationDto[]): Page<ConversationDto> => ({ items, nextCursor: null });

describe("inbox patches", () => {
  it("a new message bumps the conversation to the top and counts as unread", () => {
    const start = inbox(conv("c1", { lastMessageAt: "2026-09-18T09:30:00Z" }), conv("c2", { lastMessageAt: "2026-09-18T09:45:00Z" }));
    const next = applyMessageToInbox(start, message(1), true)!;
    expect(next.items.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(next.items[0]!.me!.unreadCount).toBe(1);
    expect(next.items[0]!.lastMessage!.id).toBe("m1");
  });

  it("is idempotent: the same message twice counts once (broadcast + REST echo)", () => {
    const once = applyMessageToInbox(inbox(conv("c1")), message(1), true)!;
    const twice = applyMessageToInbox(once, message(1), true)!;
    expect(twice.items[0]!.me!.unreadCount).toBe(1);
  });

  it("your own message or one in the open conversation does not add unread", () => {
    expect(applyMessageToInbox(inbox(conv("c1")), message(1, { senderId: ME }), false)!.items[0]!.me!.unreadCount).toBe(0);
  });

  it("an edit or reaction on the last message updates the preview but never unread", () => {
    let i = applyMessageToInbox(inbox(conv("c1")), message(1), true)!;
    i = applyMessageToInbox(i, message(1, { body: "edited", changeSeq: 9 }), true)!;
    expect(i.items[0]!.me!.unreadCount).toBe(1);
    expect(i.items[0]!.lastMessage!.body).toBe("edited");
  });

  it("an older message arriving late does not replace a newer preview", () => {
    let i = applyMessageToInbox(inbox(conv("c1")), message(5), false)!;
    i = applyMessageToInbox(i, message(2), false)!;
    expect(i.items[0]!.lastMessage!.seq).toBe(5);
  });

  it("a message for a conversation we do not have leaves the inbox alone (a refetch will bring it in)", () => {
    const start = inbox(conv("c1"));
    expect(applyMessageToInbox(start, message(1, { conversationId: "zzz" }), true)).toBe(start);
  });

  it("read events update that member's cursor; your own (another tab) also clears your badge", () => {
    const start = inbox(conv("c1", { me: { lastReadMessageId: null, lastReadAt: null, unreadCount: 3, muted: false, role: "owner" } }));
    const theirs = applyReadToInbox(start, { conversationId: "c1", userId: "u_other", lastReadMessageId: "m9", lastReadAt: "t" }, ME)!;
    expect(theirs.items[0]!.members.find((m) => m.userId === "u_other")!.lastReadMessageId).toBe("m9");
    expect(theirs.items[0]!.me!.unreadCount).toBe(3);
    const mine = applyReadToInbox(start, { conversationId: "c1", userId: ME, lastReadMessageId: "m9", lastReadAt: "t" }, ME)!;
    expect(mine.items[0]!.me!.unreadCount).toBe(0);
  });

  it("upsertConversation keeps the viewer's own state, and never lets an older snapshot win", () => {
    const start = inbox(conv("c1", { lastChangeSeq: 5, me: { lastReadMessageId: null, lastReadAt: null, unreadCount: 4, muted: false, role: "owner" } }));
    const renamed = upsertConversation(start, { ...conv("c1", { title: "Renamed", lastChangeSeq: 6 }), me: undefined });
    expect(renamed.items[0]!.title).toBe("Renamed");
    expect(renamed.items[0]!.me!.unreadCount).toBe(4);
    expect(upsertConversation(start, conv("c1", { title: "Stale", lastChangeSeq: 1 }))).toBe(start);
  });

  it("removeConversation, clearUnread and totalUnread", () => {
    const start = inbox(
      conv("c1", { me: { lastReadMessageId: null, lastReadAt: null, unreadCount: 2, muted: false, role: "member" } }),
      conv("c2", { me: { lastReadMessageId: null, lastReadAt: null, unreadCount: 5, muted: true, role: "member" } }),
    );
    expect(totalUnread(start)).toBe(2); // muted conversations do not count toward the badge
    expect(totalUnread(clearUnread(start, "c1"))).toBe(0);
    expect(removeConversation(start, "c1")!.items.map((c) => c.id)).toEqual(["c2"]);
  });

  it("titles: explicit title, else the other people's names", () => {
    expect(conversationTitle(conv("c1", { title: "Launch team" }), ME)).toBe("Launch team");
    expect(conversationTitle(conv("c1", { title: null, type: "direct" }), ME)).toBe("Ahmed Ali");
  });
});

describe("requirementLines", () => {
  const base: InsightRequirements = {
    budgetMinEgp: null, budgetMaxEgp: null, locations: [], propertyTypes: [], bedroomsMin: null, bedroomsMax: null,
    preferredFloors: [], deliveryWithinMonths: null, otherPreferences: [], intent: "unknown", summary: "",
  };

  it("renders only what was extracted", () => {
    expect(requirementLines(base)).toEqual([]);
    expect(
      requirementLines({ ...base, bedroomsMin: 3, bedroomsMax: 3, propertyTypes: ["apartment"], locations: ["New Cairo"], budgetMinEgp: 5_000_000, budgetMaxEgp: 5_000_000, deliveryWithinMonths: 3, otherPreferences: ["parking"] }),
    ).toEqual(["3 bedrooms", "apartment", "New Cairo", "~5M EGP", "Purchase/delivery within 3 months", "parking"]);
  });

  it("renders ranges", () => {
    expect(requirementLines({ ...base, bedroomsMin: 2, bedroomsMax: 3, budgetMinEgp: 4_500_000, budgetMaxEgp: 6_000_000 })).toEqual(["2–3 bedrooms", "4.5M EGP – 6M EGP"]);
  });
});
