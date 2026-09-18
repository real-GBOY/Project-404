/**
 * Messaging wire types — shared by REST responses, realtime event payloads and
 * (type-only) the web clients. Pure types: no imports, no runtime code, so a
 * frontend can `import type` this file without pulling in any server code.
 *
 * Nothing here is real-estate (or law-firm) specific. A product attaches
 * meaning through `subjectType`/`subjectId` and `metadata`.
 */

export type ConversationType = "direct" | "group" | "channel";
export type MemberRole = "owner" | "member";
export type MessageType = "text" | "system";

export interface ConversationMemberDto {
  userId: string;
  displayName: string;
  role: MemberRole;
  joinedAt: string;
  /** Set once the member has left / been removed; their history stays attributable. */
  leftAt: string | null;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
}

export interface MessageAttachmentDto {
  id: string;
  fileId: string;
  fileName: string;
  contentType: string;
  byteSize: number;
}

export interface ReactionSummaryDto {
  emoji: string;
  userIds: string[];
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  /** Empty string once deleted — the body is wiped, not just hidden. */
  body: string;
  messageType: MessageType;
  clientMessageId: string | null;
  replyToMessageId: string | null;
  /** Creation order within the conversation — the history-pagination cursor. */
  seq: number;
  /** Bumped on create/edit/delete/reaction — the reconnect-resync cursor. */
  changeSeq: number;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  metadata: Record<string, unknown>;
  attachments: MessageAttachmentDto[];
  reactions: ReactionSummaryDto[];
}

/** The caller's own view of a conversation (never broadcast — it is per-user). */
export interface ConversationViewerDto {
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  unreadCount: number;
  muted: boolean;
  role: MemberRole;
}

export interface ConversationDto {
  id: string;
  type: ConversationType;
  title: string | null;
  subjectType: string | null;
  subjectId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  lastMessage: MessageDto | null;
  archivedAt: string | null;
  metadata: Record<string, unknown>;
  /** Highest `changeSeq` in the conversation — where a fresh client starts syncing from. */
  lastChangeSeq: number;
  members: ConversationMemberDto[];
  /** Present on REST reads for the caller; absent on broadcast payloads. */
  me?: ConversationViewerDto;
}

export interface Page<T> {
  items: T[];
  /** Opaque; pass back as `cursor` for the next page. `null` when exhausted. */
  nextCursor: string | null;
}

export interface MessageHistoryPage {
  /** Oldest → newest, ready to render. */
  messages: MessageDto[];
  /** Pass as `before` to load older messages; `null` when the start of the conversation is reached. */
  olderCursor: number | null;
  /**
   * The conversation's `changeSeq` as of this read — the cursor to hand to `sync`
   * afterwards. Read BEFORE the messages, so it can only be behind them (a sync
   * may re-deliver a change already in the page; it can never miss one).
   */
  lastChangeSeq: number;
}

export interface MessageSyncResult {
  /** Everything that changed after the caller's cursor, ascending by `changeSeq` (deleted ones are tombstones). */
  messages: MessageDto[];
  /** The server's latest `changeSeq` for this conversation. */
  lastChangeSeq: number;
  /** More changes remain — call again with the last returned `changeSeq`. */
  hasMore: boolean;
  /** Fresh member list, so read cursors / membership changes missed while offline reconcile too. */
  members: ConversationMemberDto[];
}

export interface SendMessageResult {
  message: MessageDto;
  /** True when `clientMessageId` matched an earlier send — nothing new was written. */
  deduplicated: boolean;
}
