import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { currentExecutor } from "@core/kernel/db/db.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import type {
  ConversationType,
  MemberRole,
  MessageType,
} from "@core/messaging/contracts/messaging-types.js";

/**
 * All SQL for `messaging_*`. Runs on the ambient transaction/executor, so RLS
 * (`tenant_isolation`) is in force — every query is additionally filtered by the
 * active tenant even where a `WHERE organization_id` is not spelled out. Rows are
 * returned camelCased; DTO shaping lives in the service.
 */

export interface ConversationRow {
  id: string;
  organizationId: string;
  type: ConversationType;
  title: string | null;
  subjectType: string | null;
  subjectId: string | null;
  createdBy: string;
  lastMessageId: string | null;
  lastMessageAt: Date | null;
  lastSeq: number;
  lastChangeSeq: number;
  archivedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberRow {
  conversationId: string;
  userId: string;
  role: MemberRole;
  joinedAt: Date;
  leftAt: Date | null;
  lastReadMessageId: string | null;
  lastReadAt: Date | null;
  muted: boolean;
}

export interface MessageRow {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  messageType: MessageType;
  clientMessageId: string | null;
  replyToMessageId: string | null;
  seq: number;
  changeSeq: number;
  createdAt: Date;
  updatedAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  metadata: Record<string, unknown>;
}

export interface AttachmentRow {
  id: string;
  messageId: string;
  conversationId: string;
  fileId: string;
  fileName: string;
  contentType: string;
  byteSize: number;
}

export interface ReactionRow {
  messageId: string;
  userId: string;
  emoji: string;
}

export interface ConversationListRow extends ConversationRow {
  myRole: MemberRole;
  myLastReadMessageId: string | null;
  myLastReadAt: Date | null;
  myMuted: boolean;
  unreadCount: number;
  /** `COALESCE(last_message_at, created_at)` rendered to microsecond precision. */
  activityCursor: string;
}

export interface ConversationListFilter {
  limit: number;
  /** `<activityCursor>|<id>` from the previous page. */
  cursor?: { activity: string; id: string };
  archived?: boolean;
  subjectType?: string;
  subjectId?: string;
}

/** Escape LIKE metacharacters so user input is matched literally. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

@Injectable()
export class MessagingRepository {
  private org(): string {
    return requireOrganizationId();
  }

  // ── conversations ────────────────────────────────────────────────────────

  async insertConversation(input: {
    id: string;
    type: ConversationType;
    title: string | null;
    subjectType: string | null;
    subjectId: string | null;
    createdBy: string;
    metadata: Record<string, unknown>;
    now: Date;
  }): Promise<void> {
    await currentExecutor()
      .insertInto("messaging_conversations")
      .values({
        id: input.id,
        organization_id: this.org(),
        type: input.type,
        title: input.title,
        subject_type: input.subjectType,
        subject_id: input.subjectId,
        created_by: input.createdBy,
        metadata: input.metadata,
        created_at: input.now,
        updated_at: input.now,
      })
      .execute();
  }

  async findConversation(id: string, opts: { forUpdate?: boolean } = {}): Promise<ConversationRow | null> {
    let q = currentExecutor().selectFrom("messaging_conversations").selectAll().where("id", "=", id);
    if (opts.forUpdate) q = q.forUpdate();
    const row = await q.executeTakeFirst();
    return row ? toConversation(row) : null;
  }

  async updateConversation(
    id: string,
    patch: { title?: string | null; archivedAt?: Date | null; metadata?: Record<string, unknown> },
  ): Promise<void> {
    await currentExecutor()
      .updateTable("messaging_conversations")
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.archivedAt !== undefined ? { archived_at: patch.archivedAt } : {}),
        ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
      })
      .where("id", "=", id)
      .execute();
  }

  /**
   * Advance the counters and return the assigned values. The UPDATE takes the
   * row lock, so concurrent writers to one conversation get strictly ordered,
   * gap-free-at-commit numbers.
   */
  async advanceCounters(
    id: string,
    opts: { newMessage?: { id: string; at: Date } },
  ): Promise<{ seq: number; changeSeq: number }> {
    const row = await currentExecutor()
      .updateTable("messaging_conversations")
      .set({
        last_change_seq: sql<number>`last_change_seq + 1`,
        ...(opts.newMessage
          ? {
              last_seq: sql<number>`last_seq + 1`,
              last_message_id: opts.newMessage.id,
              last_message_at: opts.newMessage.at,
            }
          : {}),
      })
      .where("id", "=", id)
      .returning(["last_seq", "last_change_seq"])
      .executeTakeFirstOrThrow();
    return { seq: row.last_seq, changeSeq: row.last_change_seq };
  }

  /**
   * The caller's inbox: active memberships, newest activity first, with the
   * caller's read cursor and unread count. Keyset-paginated on
   * `(COALESCE(last_message_at, created_at), id)`.
   */
  async listConversationsForUser(userId: string, f: ConversationListFilter): Promise<ConversationListRow[]> {
    const activity = sql<Date>`COALESCE(c.last_message_at, c.created_at)`;
    const rows = await currentExecutor()
      .selectFrom("messaging_conversations as c")
      .innerJoin("messaging_conversation_members as cm", (j) =>
        j.onRef("cm.conversation_id", "=", "c.id").on("cm.user_id", "=", userId).on("cm.left_at", "is", null),
      )
      .selectAll("c")
      .select([
        "cm.role as my_role",
        "cm.last_read_message_id as my_last_read_message_id",
        "cm.last_read_at as my_last_read_at",
        "cm.muted as my_muted",
        sql<number>`(
          SELECT COUNT(*) FROM messaging_messages m
          WHERE m.conversation_id = c.id
            AND m.deleted_at IS NULL
            AND m.sender_id <> ${userId}
            AND m.seq > COALESCE(
              (SELECT r.seq FROM messaging_messages r WHERE r.id = cm.last_read_message_id), 0)
        )`.as("unread_count"),
        sql<string>`to_char(${activity} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`.as(
          "activity_cursor",
        ),
      ])
      .where((eb) => {
        const parts = [
          f.archived ? eb("c.archived_at", "is not", null) : eb("c.archived_at", "is", null),
        ];
        if (f.subjectType) parts.push(eb("c.subject_type", "=", f.subjectType));
        if (f.subjectId) parts.push(eb("c.subject_id", "=", f.subjectId));
        if (f.cursor) {
          parts.push(
            sql<boolean>`(${activity}, c.id) < (${f.cursor.activity}::timestamptz, ${f.cursor.id})` as never,
          );
        }
        return eb.and(parts);
      })
      .orderBy(activity, "desc")
      .orderBy("c.id", "desc")
      .limit(f.limit)
      .execute();

    return rows.map((r) => ({
      ...toConversation(r),
      myRole: r.my_role,
      myLastReadMessageId: r.my_last_read_message_id,
      myLastReadAt: r.my_last_read_at,
      myMuted: r.my_muted,
      unreadCount: Number(r.unread_count),
      activityCursor: r.activity_cursor,
    }));
  }

  /** Messages from others after the user's read cursor (deleted ones excluded). */
  async unreadCount(conversationId: string, userId: string): Promise<number> {
    const row = await currentExecutor()
      .selectFrom("messaging_messages as m")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .where("m.conversation_id", "=", conversationId)
      .where("m.deleted_at", "is", null)
      .where("m.sender_id", "<>", userId)
      .where(
        "m.seq",
        ">",
        sql<number>`COALESCE((
          SELECT r.seq FROM messaging_conversation_members cm
          JOIN messaging_messages r ON r.id = cm.last_read_message_id
          WHERE cm.conversation_id = ${conversationId} AND cm.user_id = ${userId}), 0)`,
      )
      .executeTakeFirstOrThrow();
    return Number(row.n);
  }

  /** Ids of every conversation the user is currently an active member of. */
  async activeConversationIds(userId: string, limit: number): Promise<string[]> {
    const rows = await currentExecutor()
      .selectFrom("messaging_conversation_members as cm")
      .innerJoin("messaging_conversations as c", "c.id", "cm.conversation_id")
      .select("cm.conversation_id")
      .where("cm.user_id", "=", userId)
      .where("cm.left_at", "is", null)
      .where("c.archived_at", "is", null)
      .orderBy(sql`COALESCE(c.last_message_at, c.created_at)`, "desc")
      .limit(limit)
      .execute();
    return rows.map((r) => r.conversation_id);
  }

  /** The existing 1:1 conversation between exactly these two users, if any. */
  async findDirectConversation(a: string, b: string): Promise<ConversationRow | null> {
    const row = await currentExecutor()
      .selectFrom("messaging_conversations as c")
      .selectAll("c")
      .where("c.type", "=", "direct")
      .where((eb) =>
        eb.and(
          [a, b].map((u) =>
            eb.exists(
              eb
                .selectFrom("messaging_conversation_members as m")
                .select("m.user_id")
                .whereRef("m.conversation_id", "=", "c.id")
                .where("m.user_id", "=", u),
            ),
          ),
        ),
      )
      .executeTakeFirst();
    return row ? toConversation(row) : null;
  }

  // ── members ──────────────────────────────────────────────────────────────

  /** Add a member, or reactivate one who previously left. Returns whether the membership is new/reactivated. */
  async upsertMember(input: {
    conversationId: string;
    userId: string;
    role: MemberRole;
    now: Date;
  }): Promise<"added" | "unchanged"> {
    const existing = await this.findMember(input.conversationId, input.userId);
    if (existing && existing.leftAt === null) return "unchanged";
    if (existing) {
      await currentExecutor()
        .updateTable("messaging_conversation_members")
        .set({ left_at: null, joined_at: input.now, role: input.role })
        .where("conversation_id", "=", input.conversationId)
        .where("user_id", "=", input.userId)
        .execute();
      return "added";
    }
    await currentExecutor()
      .insertInto("messaging_conversation_members")
      .values({
        conversation_id: input.conversationId,
        user_id: input.userId,
        organization_id: this.org(),
        role: input.role,
        joined_at: input.now,
      })
      .execute();
    return "added";
  }

  async findMember(conversationId: string, userId: string): Promise<MemberRow | null> {
    const row = await currentExecutor()
      .selectFrom("messaging_conversation_members")
      .selectAll()
      .where("conversation_id", "=", conversationId)
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return row ? toMember(row) : null;
  }

  /** Every member row, including those who left (their history stays attributable). */
  async listMembers(conversationIds: string[]): Promise<MemberRow[]> {
    if (conversationIds.length === 0) return [];
    const rows = await currentExecutor()
      .selectFrom("messaging_conversation_members")
      .selectAll()
      .where("conversation_id", "in", conversationIds)
      .orderBy("joined_at", "asc")
      .execute();
    return rows.map(toMember);
  }

  async markMemberLeft(conversationId: string, userId: string, at: Date): Promise<void> {
    await currentExecutor()
      .updateTable("messaging_conversation_members")
      .set({ left_at: at })
      .where("conversation_id", "=", conversationId)
      .where("user_id", "=", userId)
      .execute();
  }

  /**
   * Move the read cursor forward only — `WHERE` refuses to regress it, so two
   * racing "mark read" calls converge on the furthest message. Returns whether it moved.
   */
  async advanceReadCursor(input: {
    conversationId: string;
    userId: string;
    messageId: string;
    messageSeq: number;
    at: Date;
  }): Promise<boolean> {
    const res = await currentExecutor()
      .updateTable("messaging_conversation_members as cm")
      .set({ last_read_message_id: input.messageId, last_read_at: input.at })
      .where("cm.conversation_id", "=", input.conversationId)
      .where("cm.user_id", "=", input.userId)
      .where((eb) =>
        eb.or([
          eb("cm.last_read_message_id", "is", null),
          eb(
            eb
              .selectFrom("messaging_messages as r")
              .select("r.seq")
              .whereRef("r.id", "=", "cm.last_read_message_id"),
            "<",
            input.messageSeq,
          ),
        ]),
      )
      .executeTakeFirst();
    return Number(res.numUpdatedRows) > 0;
  }

  // ── messages ─────────────────────────────────────────────────────────────

  async insertMessage(input: {
    id: string;
    conversationId: string;
    senderId: string;
    body: string;
    messageType: MessageType;
    clientMessageId: string | null;
    replyToMessageId: string | null;
    seq: number;
    changeSeq: number;
    metadata: Record<string, unknown>;
    now: Date;
  }): Promise<MessageRow> {
    const row = await currentExecutor()
      .insertInto("messaging_messages")
      .values({
        id: input.id,
        conversation_id: input.conversationId,
        organization_id: this.org(),
        sender_id: input.senderId,
        body: input.body,
        message_type: input.messageType,
        client_message_id: input.clientMessageId,
        reply_to_message_id: input.replyToMessageId,
        seq: input.seq,
        change_seq: input.changeSeq,
        metadata: input.metadata,
        created_at: input.now,
        updated_at: input.now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toMessage(row);
  }

  async findMessage(conversationId: string, id: string): Promise<MessageRow | null> {
    const row = await currentExecutor()
      .selectFrom("messaging_messages")
      .selectAll()
      .where("conversation_id", "=", conversationId)
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? toMessage(row) : null;
  }

  async findMessageByClientId(
    conversationId: string,
    senderId: string,
    clientMessageId: string,
  ): Promise<MessageRow | null> {
    const row = await currentExecutor()
      .selectFrom("messaging_messages")
      .selectAll()
      .where("conversation_id", "=", conversationId)
      .where("sender_id", "=", senderId)
      .where("client_message_id", "=", clientMessageId)
      .executeTakeFirst();
    return row ? toMessage(row) : null;
  }

  async findLatestMessage(conversationId: string): Promise<MessageRow | null> {
    const row = await currentExecutor()
      .selectFrom("messaging_messages")
      .selectAll()
      .where("conversation_id", "=", conversationId)
      .orderBy("seq", "desc")
      .limit(1)
      .executeTakeFirst();
    return row ? toMessage(row) : null;
  }

  async findMessagesByIds(ids: string[]): Promise<MessageRow[]> {
    if (ids.length === 0) return [];
    const rows = await currentExecutor().selectFrom("messaging_messages").selectAll().where("id", "in", ids).execute();
    return rows.map(toMessage);
  }

  async updateMessageBody(id: string, input: { body: string; changeSeq: number; at: Date }): Promise<MessageRow> {
    const row = await currentExecutor()
      .updateTable("messaging_messages")
      .set({ body: input.body, change_seq: input.changeSeq, edited_at: input.at, updated_at: input.at })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return toMessage(row);
  }

  /** Tombstone: the body is wiped (privacy), not merely flagged. */
  async softDeleteMessage(id: string, input: { changeSeq: number; at: Date }): Promise<MessageRow> {
    const row = await currentExecutor()
      .updateTable("messaging_messages")
      .set({ body: "", change_seq: input.changeSeq, deleted_at: input.at, updated_at: input.at })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return toMessage(row);
  }

  async touchMessage(id: string, input: { changeSeq: number; at: Date }): Promise<MessageRow> {
    const row = await currentExecutor()
      .updateTable("messaging_messages")
      .set({ change_seq: input.changeSeq, updated_at: input.at })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return toMessage(row);
  }

  /** History: newest first from `beforeSeq` (exclusive), returned in that order — the service flips it. */
  async listHistory(conversationId: string, opts: { beforeSeq?: number; limit: number }): Promise<MessageRow[]> {
    let q = currentExecutor()
      .selectFrom("messaging_messages")
      .selectAll()
      .where("conversation_id", "=", conversationId);
    if (opts.beforeSeq !== undefined) q = q.where("seq", "<", opts.beforeSeq);
    const rows = await q.orderBy("seq", "desc").limit(opts.limit).execute();
    return rows.map(toMessage);
  }

  async listChanges(conversationId: string, opts: { afterChangeSeq: number; limit: number }): Promise<MessageRow[]> {
    const rows = await currentExecutor()
      .selectFrom("messaging_messages")
      .selectAll()
      .where("conversation_id", "=", conversationId)
      .where("change_seq", ">", opts.afterChangeSeq)
      .orderBy("change_seq", "asc")
      .limit(opts.limit)
      .execute();
    return rows.map(toMessage);
  }

  /**
   * Case-insensitive substring search over the caller's own conversations. This
   * is the single search seam — swap the body for Postgres FTS / trigram later
   * without touching callers.
   */
  async searchMessages(
    userId: string,
    opts: { query: string; conversationId?: string; limit: number },
  ): Promise<MessageRow[]> {
    let q = currentExecutor()
      .selectFrom("messaging_messages as m")
      .innerJoin("messaging_conversation_members as cm", (j) =>
        j.onRef("cm.conversation_id", "=", "m.conversation_id").on("cm.user_id", "=", userId).on("cm.left_at", "is", null),
      )
      .selectAll("m")
      .where("m.deleted_at", "is", null)
      .where(sql<boolean>`m.body ILIKE ${likePattern(opts.query)} ESCAPE '\\'`);
    if (opts.conversationId) q = q.where("m.conversation_id", "=", opts.conversationId);
    const rows = await q.orderBy("m.created_at", "desc").limit(opts.limit).execute();
    return rows.map(toMessage);
  }

  // ── attachments ──────────────────────────────────────────────────────────

  async insertAttachments(
    rows: Array<{
      id: string;
      messageId: string;
      conversationId: string;
      fileId: string;
      fileName: string;
      contentType: string;
      byteSize: number;
    }>,
  ): Promise<void> {
    if (rows.length === 0) return;
    const org = this.org();
    await currentExecutor()
      .insertInto("messaging_message_attachments")
      .values(
        rows.map((r) => ({
          id: r.id,
          message_id: r.messageId,
          conversation_id: r.conversationId,
          organization_id: org,
          file_id: r.fileId,
          file_name: r.fileName,
          content_type: r.contentType,
          byte_size: r.byteSize,
        })),
      )
      .execute();
  }

  async listAttachments(messageIds: string[]): Promise<AttachmentRow[]> {
    if (messageIds.length === 0) return [];
    const rows = await currentExecutor()
      .selectFrom("messaging_message_attachments")
      .selectAll()
      .where("message_id", "in", messageIds)
      .orderBy("created_at", "asc")
      .orderBy("id", "asc")
      .execute();
    return rows.map((r) => ({
      id: r.id,
      messageId: r.message_id,
      conversationId: r.conversation_id,
      fileId: r.file_id,
      fileName: r.file_name,
      contentType: r.content_type,
      byteSize: r.byte_size,
    }));
  }

  async findAttachment(conversationId: string, attachmentId: string): Promise<AttachmentRow | null> {
    const row = await currentExecutor()
      .selectFrom("messaging_message_attachments")
      .selectAll()
      .where("conversation_id", "=", conversationId)
      .where("id", "=", attachmentId)
      .executeTakeFirst();
    return row
      ? {
          id: row.id,
          messageId: row.message_id,
          conversationId: row.conversation_id,
          fileId: row.file_id,
          fileName: row.file_name,
          contentType: row.content_type,
          byteSize: row.byte_size,
        }
      : null;
  }

  async deleteAttachmentsForMessage(messageId: string): Promise<void> {
    await currentExecutor().deleteFrom("messaging_message_attachments").where("message_id", "=", messageId).execute();
  }

  // ── reactions ────────────────────────────────────────────────────────────

  /** Returns whether a row was added. */
  async addReaction(input: {
    messageId: string;
    conversationId: string;
    userId: string;
    emoji: string;
  }): Promise<boolean> {
    const res = await currentExecutor()
      .insertInto("messaging_message_reactions")
      .values({
        message_id: input.messageId,
        conversation_id: input.conversationId,
        user_id: input.userId,
        emoji: input.emoji,
        organization_id: this.org(),
      })
      .onConflict((oc) => oc.doNothing())
      .executeTakeFirst();
    return Number(res.numInsertedOrUpdatedRows ?? 0) > 0;
  }

  async removeReaction(input: { messageId: string; userId: string; emoji: string }): Promise<boolean> {
    const res = await currentExecutor()
      .deleteFrom("messaging_message_reactions")
      .where("message_id", "=", input.messageId)
      .where("user_id", "=", input.userId)
      .where("emoji", "=", input.emoji)
      .executeTakeFirst();
    return Number(res.numDeletedRows) > 0;
  }

  async listReactions(messageIds: string[]): Promise<ReactionRow[]> {
    if (messageIds.length === 0) return [];
    const rows = await currentExecutor()
      .selectFrom("messaging_message_reactions")
      .select(["message_id", "user_id", "emoji"])
      .where("message_id", "in", messageIds)
      .orderBy("created_at", "asc")
      .execute();
    return rows.map((r) => ({ messageId: r.message_id, userId: r.user_id, emoji: r.emoji }));
  }
}

// ── row mappers ────────────────────────────────────────────────────────────

type ConversationDbRow = {
  id: string;
  organization_id: string;
  type: ConversationType;
  title: string | null;
  subject_type: string | null;
  subject_id: string | null;
  created_by: string;
  last_message_id: string | null;
  last_message_at: Date | null;
  last_seq: number;
  last_change_seq: number;
  archived_at: Date | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

function toConversation(r: ConversationDbRow): ConversationRow {
  return {
    id: r.id,
    organizationId: r.organization_id,
    type: r.type,
    title: r.title,
    subjectType: r.subject_type,
    subjectId: r.subject_id,
    createdBy: r.created_by,
    lastMessageId: r.last_message_id,
    lastMessageAt: r.last_message_at,
    lastSeq: r.last_seq,
    lastChangeSeq: r.last_change_seq,
    archivedAt: r.archived_at,
    metadata: r.metadata,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toMember(r: {
  conversation_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: Date;
  left_at: Date | null;
  last_read_message_id: string | null;
  last_read_at: Date | null;
  muted: boolean;
}): MemberRow {
  return {
    conversationId: r.conversation_id,
    userId: r.user_id,
    role: r.role,
    joinedAt: r.joined_at,
    leftAt: r.left_at,
    lastReadMessageId: r.last_read_message_id,
    lastReadAt: r.last_read_at,
    muted: r.muted,
  };
}

function toMessage(r: {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  message_type: MessageType;
  client_message_id: string | null;
  reply_to_message_id: string | null;
  seq: number;
  change_seq: number;
  created_at: Date;
  updated_at: Date;
  edited_at: Date | null;
  deleted_at: Date | null;
  metadata: Record<string, unknown>;
}): MessageRow {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    body: r.body,
    messageType: r.message_type,
    clientMessageId: r.client_message_id,
    replyToMessageId: r.reply_to_message_id,
    seq: r.seq,
    changeSeq: r.change_seq,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    editedAt: r.edited_at,
    deletedAt: r.deleted_at,
    metadata: r.metadata,
  };
}
