import type {
  ConversationDto,
  ConversationMemberDto,
  MessageDto,
  Page,
} from "@auric/contracts/messaging";
import type { ConversationReadPayload } from "@auric/contracts/messaging";

/**
 * Pure patches for the inbox (`Page<ConversationDto>`) driven by realtime events.
 * Same philosophy as `thread-cache.ts`: idempotent, order-tolerant, and unit-tested
 * — the inbox must come out right whether an event arrives once, twice, or after
 * the REST refetch that already contains it.
 */
type Inbox = Page<ConversationDto> | undefined;

const activityOf = (c: ConversationDto) => c.lastMessageAt ?? c.createdAt;

/** Newest activity first — the order the server returns and the UI shows. */
export function sortInbox(items: ConversationDto[]): ConversationDto[] {
  return items.slice().sort((a, b) => (activityOf(a) < activityOf(b) ? 1 : activityOf(a) > activityOf(b) ? -1 : a.id < b.id ? 1 : -1));
}

function withItems(inbox: Inbox, items: ConversationDto[]): Page<ConversationDto> {
  return { items: sortInbox(items), nextCursor: inbox?.nextCursor ?? null };
}

/** A new/updated conversation from an event. Broadcast payloads carry no viewer state (`me`) — keep ours. */
export function upsertConversation(inbox: Inbox, incoming: ConversationDto): Page<ConversationDto> {
  const items = inbox?.items ?? [];
  const existing = items.find((c) => c.id === incoming.id);
  const merged: ConversationDto = {
    ...incoming,
    me: incoming.me ?? existing?.me ?? { lastReadMessageId: null, lastReadAt: null, unreadCount: 0, muted: false, role: "member" },
  };
  // Never let an older snapshot clobber a newer one.
  if (existing && existing.lastChangeSeq > merged.lastChangeSeq) return inbox!;
  return withItems(inbox, [merged, ...items.filter((c) => c.id !== incoming.id)]);
}

export function removeConversation(inbox: Inbox, conversationId: string): Page<ConversationDto> | undefined {
  if (!inbox) return inbox;
  return { ...inbox, items: inbox.items.filter((c) => c.id !== conversationId) };
}

/**
 * A message arrived (or was echoed back to its sender). Updates the preview,
 * activity time and the caller's unread count. `countAsUnread` is false when the
 * message is the user's own, or the conversation is open and visible.
 */
export function applyMessageToInbox(inbox: Inbox, message: MessageDto, countAsUnread: boolean): Page<ConversationDto> | undefined {
  if (!inbox) return inbox;
  const existing = inbox.items.find((c) => c.id === message.conversationId);
  if (!existing) return inbox; // unknown conversation — a refetch will bring it in
  const isNewest = !existing.lastMessage || message.seq >= existing.lastMessage.seq;
  // Only a NEW message counts toward unread; an edit/reaction of one we have already counted must not.
  const isNewToUs = !existing.lastMessage || message.seq > existing.lastMessage.seq;
  const updated: ConversationDto = {
    ...existing,
    lastMessage: isNewest ? message : existing.lastMessage,
    lastMessageAt: isNewest ? message.createdAt : existing.lastMessageAt,
    lastChangeSeq: Math.max(existing.lastChangeSeq, message.changeSeq),
    me: existing.me
      ? { ...existing.me, unreadCount: existing.me.unreadCount + (countAsUnread && isNewToUs && !message.deletedAt ? 1 : 0) }
      : existing.me,
  };
  return withItems(inbox, [updated, ...inbox.items.filter((c) => c.id !== updated.id)]);
}

/** Someone's read cursor moved. If it is the viewer (another tab), their unread badge clears too. */
export function applyReadToInbox(inbox: Inbox, read: ConversationReadPayload, meId: string): Page<ConversationDto> | undefined {
  if (!inbox) return inbox;
  return {
    ...inbox,
    items: inbox.items.map((c) => {
      if (c.id !== read.conversationId) return c;
      const members = c.members.map((m) =>
        m.userId === read.userId ? { ...m, lastReadMessageId: read.lastReadMessageId, lastReadAt: read.lastReadAt } : m,
      );
      const me = read.userId === meId && c.me ? { ...c.me, lastReadMessageId: read.lastReadMessageId, lastReadAt: read.lastReadAt, unreadCount: 0 } : c.me;
      return { ...c, members, ...(me ? { me } : {}) };
    }),
  };
}

export function clearUnread(inbox: Inbox, conversationId: string): Page<ConversationDto> | undefined {
  if (!inbox) return inbox;
  return {
    ...inbox,
    items: inbox.items.map((c) =>
      c.id === conversationId && c.me && c.me.unreadCount > 0 ? { ...c, me: { ...c.me, unreadCount: 0 } } : c,
    ),
  };
}

export function setMembers(inbox: Inbox, conversationId: string, members: ConversationMemberDto[]): Page<ConversationDto> | undefined {
  if (!inbox) return inbox;
  return { ...inbox, items: inbox.items.map((c) => (c.id === conversationId ? { ...c, members } : c)) };
}

export function totalUnread(inbox: Inbox): number {
  return (inbox?.items ?? []).reduce((n, c) => n + (c.me?.muted ? 0 : (c.me?.unreadCount ?? 0)), 0);
}

/** "Ahmed", or "Ahmed, Sara" — the conversation's display title from the viewer's side. */
export function conversationTitle(c: ConversationDto, meId: string): string {
  if (c.title) return c.title;
  const others = c.members.filter((m) => !m.leftAt && m.userId !== meId).map((m) => m.displayName);
  return others.join(", ") || "Conversation";
}
