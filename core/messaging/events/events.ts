import type { DomainEvent } from "@core/contracts/domain-event.js";
import type {
  ConversationDto,
  ConversationMemberDto,
  MessageDto,
} from "@core/messaging/contracts/messaging-types.js";

/**
 * Domain events the Messaging module publishes (named `<module>.<entity>.<pastTense>`,
 * §6). They travel through the transactional outbox, so a subscriber only ever
 * sees COMMITTED state — nothing is broadcast for a rolled-back write.
 *
 * Payload types are `type` aliases (not interfaces) so they satisfy the bus's
 * `Record<string, unknown>` payload constraint.
 */
export const MessagingDomainEvents = {
  ConversationCreated: "messaging.conversation.created",
  ConversationUpdated: "messaging.conversation.updated",
  MemberAdded: "messaging.conversation.member_added",
  MemberRemoved: "messaging.conversation.member_removed",
  MessageCreated: "messaging.message.created",
  MessageUpdated: "messaging.message.updated",
  MessageDeleted: "messaging.message.deleted",
} as const;

/** Who to notify. `memberUserIds` = active members AFTER the change. */
type Audience = { organizationId: string; conversationId: string; memberUserIds: string[] };

/** What the conversation is about — lets a product's subscriber decide relevance without a read. */
type Subject = { subjectType: string | null; subjectId: string | null };

export type ConversationCreatedEvent = Audience & { conversation: ConversationDto };
export type ConversationUpdatedEvent = Audience & { conversation: ConversationDto };
export type MemberAddedEvent = Audience & {
  userId: string;
  member: ConversationMemberDto;
  conversation: ConversationDto;
};
export type MemberRemovedEvent = Audience & { userId: string };
export type MessageCreatedEvent = Audience & Subject & { message: MessageDto };
export type MessageUpdatedEvent = Audience & Subject & { message: MessageDto };
export type MessageDeletedEvent = Audience &
  Subject & { messageId: string; changeSeq: number; deletedAt: string };

const ev = <T extends Record<string, unknown>>(name: string, payload: T): DomainEvent => ({
  name,
  version: 1,
  payload,
});

export const conversationCreated = (p: ConversationCreatedEvent) => ev(MessagingDomainEvents.ConversationCreated, p);
export const conversationUpdated = (p: ConversationUpdatedEvent) => ev(MessagingDomainEvents.ConversationUpdated, p);
export const memberAdded = (p: MemberAddedEvent) => ev(MessagingDomainEvents.MemberAdded, p);
export const memberRemoved = (p: MemberRemovedEvent) => ev(MessagingDomainEvents.MemberRemoved, p);
export const messageCreated = (p: MessageCreatedEvent) => ev(MessagingDomainEvents.MessageCreated, p);
export const messageUpdated = (p: MessageUpdatedEvent) => ev(MessagingDomainEvents.MessageUpdated, p);
export const messageDeleted = (p: MessageDeletedEvent) => ev(MessagingDomainEvents.MessageDeleted, p);
