import type { IRealtimeBroadcaster } from "@core/contracts/index.js";
import type { EventRegistry } from "@core/events/registry.js";
import { MessagingEvent, realtimeRooms } from "@core/messaging/contracts/realtime-events.js";
import {
  type ConversationCreatedEvent,
  type ConversationUpdatedEvent,
  type MemberAddedEvent,
  type MemberRemovedEvent,
  type MessageCreatedEvent,
  type MessageDeletedEvent,
  type MessageUpdatedEvent,
  MessagingDomainEvents as D,
} from "@core/messaging/events/events.js";

/** Live membership lookup (runs in the event's tenant context). */
export interface ActiveMembership {
  isActiveMember(conversationId: string, userId: string): Promise<boolean>;
}

/**
 * Fan-out: committed messaging events → sockets. Registered as EXTERNAL
 * subscribers, so they run from the outbox worker only after the originating
 * transaction committed (retried with backoff, dead-lettered if they keep
 * failing). Delivery is at-least-once, so clients dedupe by message id.
 *
 * Room membership is kept in step with the database here: a new member's sockets
 * are joined BEFORE the event is emitted (so they receive it); a removed member
 * is emitted to first, then dropped from the room.
 *
 * A joining event is delivered AFTER its commit, possibly after a later change —
 * so it never trusts its own snapshot: it re-checks live membership before
 * touching a room. Otherwise a member removed a moment after being added could be
 * re-joined by the delayed "added" event.
 */
export function registerMessagingBroadcast(
  registry: EventRegistry,
  rt: IRealtimeBroadcaster,
  membership: ActiveMembership,
): void {
  const room = (conversationId: string) => realtimeRooms.conversation(conversationId);

  registry.onExternal(D.MessageCreated, "messaging.broadcast_message_created", async (event) => {
    const p = event.payload as MessageCreatedEvent;
    rt.toRoom(room(p.conversationId), MessagingEvent.MessageCreated, { message: p.message });
  });

  registry.onExternal(D.MessageUpdated, "messaging.broadcast_message_updated", async (event) => {
    const p = event.payload as MessageUpdatedEvent;
    rt.toRoom(room(p.conversationId), MessagingEvent.MessageUpdated, { message: p.message });
  });

  registry.onExternal(D.MessageDeleted, "messaging.broadcast_message_deleted", async (event) => {
    const p = event.payload as MessageDeletedEvent;
    rt.toRoom(room(p.conversationId), MessagingEvent.MessageDeleted, {
      conversationId: p.conversationId,
      messageId: p.messageId,
      changeSeq: p.changeSeq,
      deletedAt: p.deletedAt,
    });
  });

  registry.onExternal(D.ConversationCreated, "messaging.broadcast_conversation_created", async (event) => {
    const p = event.payload as ConversationCreatedEvent;
    for (const userId of p.memberUserIds) {
      if (!(await membership.isActiveMember(p.conversationId, userId))) continue;
      rt.joinUser(p.organizationId, userId, room(p.conversationId));
      rt.toUser(p.organizationId, userId, MessagingEvent.ConversationCreated, { conversation: p.conversation });
    }
  });

  registry.onExternal(D.ConversationUpdated, "messaging.broadcast_conversation_updated", async (event) => {
    const p = event.payload as ConversationUpdatedEvent;
    rt.toRoom(room(p.conversationId), MessagingEvent.ConversationUpdated, { conversation: p.conversation });
  });

  registry.onExternal(D.MemberAdded, "messaging.broadcast_member_added", async (event) => {
    const p = event.payload as MemberAddedEvent;
    if (await membership.isActiveMember(p.conversationId, p.userId)) {
      rt.joinUser(p.organizationId, p.userId, room(p.conversationId));
    }
    rt.toRoom(room(p.conversationId), MessagingEvent.ConversationMemberAdded, {
      conversationId: p.conversationId,
      member: p.member,
      conversation: p.conversation,
    });
  });

  registry.onExternal(D.MemberRemoved, "messaging.broadcast_member_removed", async (event) => {
    const p = event.payload as MemberRemovedEvent;
    rt.toRoom(room(p.conversationId), MessagingEvent.ConversationMemberRemoved, {
      conversationId: p.conversationId,
      userId: p.userId,
    });
    rt.leaveUser(p.organizationId, p.userId, room(p.conversationId));
  });
}
