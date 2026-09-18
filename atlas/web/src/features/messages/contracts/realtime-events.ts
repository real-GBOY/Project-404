import type { ConversationDto, ConversationMemberDto, MessageDto, SendMessageResult } from "./messaging-types.js";

/**
 * The realtime contract — every event name and payload, strongly typed, no
 * `any`. Pure types + constants (no server imports) so web clients can share it.
 *
 * Direction convention: `MessagingServerEvents` are emitted server → client;
 * `MessagingClientEvents` are client → server and every one is acknowledged
 * with an `Ack<T>` (`{ok:true,data}` | `{ok:false,error}`).
 */

export const MessagingEvent = {
  ConversationCreated: "messaging:conversation:created",
  ConversationUpdated: "messaging:conversation:updated",
  ConversationMemberAdded: "messaging:conversation:member_added",
  ConversationMemberRemoved: "messaging:conversation:member_removed",
  ConversationRead: "messaging:conversation:read",
  MessageCreated: "messaging:message:created",
  MessageUpdated: "messaging:message:updated",
  MessageDeleted: "messaging:message:deleted",
  TypingStart: "messaging:typing:start",
  TypingStop: "messaging:typing:stop",
  PresenceUpdate: "messaging:presence:update",
} as const;

/** Client → server command names. Read/typing reuse the server event names. */
export const MessagingCommand = {
  MessageCreate: "messaging:message:create",
  ConversationJoin: "messaging:conversation:join",
  ConversationLeave: "messaging:conversation:leave",
  ConversationRead: "messaging:conversation:read",
  TypingStart: "messaging:typing:start",
  TypingStop: "messaging:typing:stop",
  AuthRefresh: "auth:refresh",
} as const;

/** Server → client, connection-level (not conversation-scoped). */
export const RealtimeSystemEvent = {
  /** Sent once after the handshake is accepted. */
  Ready: "realtime:ready",
  /** Token expired without a refresh — the socket is about to be closed. */
  AuthExpired: "realtime:auth_expired",
} as const;

export interface ConversationCreatedPayload {
  conversation: ConversationDto;
}
export interface ConversationUpdatedPayload {
  conversation: ConversationDto;
}
export interface ConversationMemberAddedPayload {
  conversationId: string;
  member: ConversationMemberDto;
  /** So the added user's client can render the conversation without a fetch. */
  conversation: ConversationDto;
}
export interface ConversationMemberRemovedPayload {
  conversationId: string;
  userId: string;
}
export interface ConversationReadPayload {
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
  lastReadAt: string;
}
export interface MessageCreatedPayload {
  message: MessageDto;
}
export interface MessageUpdatedPayload {
  message: MessageDto;
}
export interface MessageDeletedPayload {
  conversationId: string;
  messageId: string;
  changeSeq: number;
  deletedAt: string;
}
export interface TypingPayload {
  conversationId: string;
  userId: string;
}
export interface PresenceUpdatePayload {
  userId: string;
  status: "online" | "offline";
  at: string;
}
export interface RealtimeReadyPayload {
  userId: string;
  organizationId: string;
  /** Epoch seconds at which the current token stops being accepted. */
  tokenExpiresAt: number;
  /** Users currently online in the tenant. */
  onlineUserIds: string[];
}

export interface MessagingServerEvents {
  [MessagingEvent.ConversationCreated]: ConversationCreatedPayload;
  [MessagingEvent.ConversationUpdated]: ConversationUpdatedPayload;
  [MessagingEvent.ConversationMemberAdded]: ConversationMemberAddedPayload;
  [MessagingEvent.ConversationMemberRemoved]: ConversationMemberRemovedPayload;
  [MessagingEvent.ConversationRead]: ConversationReadPayload;
  [MessagingEvent.MessageCreated]: MessageCreatedPayload;
  [MessagingEvent.MessageUpdated]: MessageUpdatedPayload;
  [MessagingEvent.MessageDeleted]: MessageDeletedPayload;
  [MessagingEvent.TypingStart]: TypingPayload;
  [MessagingEvent.TypingStop]: TypingPayload;
  [MessagingEvent.PresenceUpdate]: PresenceUpdatePayload;
}

export type Ack<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export interface MessageCreateCommand {
  conversationId: string;
  body: string;
  /** Client-generated UUID — retrying the same id never duplicates the message. */
  clientMessageId: string;
  replyToMessageId?: string;
  attachmentFileIds?: string[];
}
export interface ConversationScopedCommand {
  conversationId: string;
}
export interface ConversationReadCommand {
  conversationId: string;
  /** Defaults to the latest message. */
  messageId?: string;
}
export interface AuthRefreshCommand {
  token: string;
}

export interface MessagingClientEvents {
  [MessagingCommand.MessageCreate]: { payload: MessageCreateCommand; ack: SendMessageResult };
  [MessagingCommand.ConversationJoin]: { payload: ConversationScopedCommand; ack: { joined: true } };
  [MessagingCommand.ConversationLeave]: { payload: ConversationScopedCommand; ack: { left: true } };
  [MessagingCommand.ConversationRead]: {
    payload: ConversationReadCommand;
    ack: { lastReadMessageId: string; lastReadAt: string } | { lastReadMessageId: null };
  };
  [MessagingCommand.TypingStart]: { payload: ConversationScopedCommand; ack: { ok: true } };
  [MessagingCommand.TypingStop]: { payload: ConversationScopedCommand; ack: { ok: true } };
  [MessagingCommand.AuthRefresh]: { payload: AuthRefreshCommand; ack: { tokenExpiresAt: number } };
}

/** Room names — the ONLY place they are spelled, so client and server can never disagree. */
export const realtimeRooms = {
  /** Every authenticated socket of a tenant (presence). */
  org: (organizationId: string) => `org:${organizationId}`,
  /** Every socket of one user in one tenant (personal events). */
  user: (organizationId: string, userId: string) => `user:${organizationId}:${userId}`,
  conversation: (conversationId: string) => `conversation:${conversationId}`,
} as const;
