import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { newId } from "@core/kernel/id.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import {
  AUDIT_LOGGER,
  CLOCK,
  EVENT_BUS,
  FILE_STORAGE,
  ORGANIZATION_PROVIDER,
  PERMISSION_PROVIDER,
  REALTIME_BROADCASTER,
  UNIT_OF_WORK,
} from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type {
  IAuditLogger,
  IEventBus,
  IFileStorage,
  IMessagingProvider,
  IOrganizationProvider,
  IPermissionProvider,
  IRealtimeBroadcaster,
} from "@core/contracts/index.js";
import { OutboxWorker } from "@core/events/outbox/outbox-worker.js";
import { UserDirectory } from "@core/identity/application/user-directory.js";
import type {
  ConversationDto,
  ConversationMemberDto,
  MessageAttachmentDto,
  MessageDto,
  MessageHistoryPage,
  MessageSyncResult,
  Page,
  ReactionSummaryDto,
  SendMessageResult,
} from "@core/messaging/contracts/messaging-types.js";
import { MessagingEvent, realtimeRooms } from "@core/messaging/contracts/realtime-events.js";
import {
  conversationCreated,
  conversationUpdated,
  memberAdded,
  memberRemoved,
  messageCreated,
  messageDeleted,
  messageUpdated,
} from "@core/messaging/events/events.js";
import {
  type ConversationListRow,
  type ConversationRow,
  type MemberRow,
  MessagingRepository,
  type MessageRow,
} from "@core/messaging/infrastructure/messaging-repository.js";
import type {
  CreateConversationInput,
  SendMessageInput,
  UpdateConversationInput,
} from "@core/messaging/validation/schemas.js";

const iso = (d: Date) => d.toISOString();

/**
 * Messaging use cases. Every method:
 *  - takes the ACTOR explicitly (from the verified token — never from a payload),
 *  - runs its writes in ONE unit-of-work transaction: rows + audit + outbox event
 *    commit together or not at all,
 *  - authorizes by conversation MEMBERSHIP (an RBAC permission alone never opens
 *    a conversation), answering "not found" for both a foreign tenant's and a
 *    same-tenant non-member's conversation so existence is never an oracle.
 *
 * The tenant is ambient (`requireOrganizationId()`); RLS is the backstop under it.
 */
@Injectable()
export class MessagingService implements IMessagingProvider {
  constructor(
    private readonly repo: MessagingRepository,
    private readonly outbox: OutboxWorker,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly directory: UserDirectory,
    @Inject(ORGANIZATION_PROVIDER) private readonly orgs: IOrganizationProvider,
    @Inject(PERMISSION_PROVIDER) private readonly permissions: IPermissionProvider,
    @Inject(FILE_STORAGE) private readonly files: IFileStorage,
    @Inject(REALTIME_BROADCASTER) private readonly realtime: IRealtimeBroadcaster,
  ) {}

  // ═══ conversations ═════════════════════════════════════════════════════════

  async createConversation(actorId: string, input: CreateConversationInput): Promise<ConversationDto> {
    const orgId = requireOrganizationId();
    const others = [...new Set(input.memberIds.filter((u) => u !== actorId))];
    if (input.type === "direct" && others.length !== 1) {
      throw ValidationError("messaging.direct_needs_one_member", "A direct conversation is between you and exactly one other person.");
    }
    if (input.type !== "direct" && others.length === 0) {
      throw ValidationError("messaging.members_required", "Add at least one other member.");
    }
    await this.assertOrgMembers(orgId, others);

    const dto = await this.commit(async () => {
      if (input.type === "direct") {
        const existing = await this.repo.findDirectConversation(actorId, others[0]!);
        if (existing) return this.viewFor(actorId, existing.id);
      }

      const now = this.clock.now();
      const id = newId("mcv");
      await this.repo.insertConversation({
        id,
        type: input.type,
        title: input.type === "direct" ? null : (input.title ?? null),
        subjectType: input.subjectType ?? null,
        subjectId: input.subjectType ? (input.subjectId ?? null) : null,
        createdBy: actorId,
        metadata: input.metadata ?? {},
        now,
      });
      await this.repo.upsertMember({ conversationId: id, userId: actorId, role: "owner", now });
      for (const userId of others) {
        await this.repo.upsertMember({ conversationId: id, userId, role: "member", now });
      }
      await this.audit.record({
        actorId,
        action: "messaging.conversation.created",
        resourceType: "messaging_conversation",
        resourceId: id,
        after: { type: input.type, memberCount: others.length + 1 },
      });
      const conversation = await this.shape(id);
      await this.events.publish(
        conversationCreated({
          organizationId: orgId,
          conversationId: id,
          memberUserIds: conversation.members.filter((m) => !m.leftAt).map((m) => m.userId),
          conversation,
        }),
      );
      return this.viewFor(actorId, id);
    });
    return dto;
  }

  async getConversation(actorId: string, conversationId: string): Promise<ConversationDto> {
    return readInTenant(async () => {
      await this.requireMembership(conversationId, actorId);
      return this.viewFor(actorId, conversationId);
    });
  }

  async listConversations(
    actorId: string,
    q: { limit: number; cursor?: string; archived?: boolean; subjectType?: string; subjectId?: string },
  ): Promise<Page<ConversationDto>> {
    return readInTenant(async () => {
      const cursor = decodeCursor(q.cursor);
      const rows = await this.repo.listConversationsForUser(actorId, {
        limit: q.limit + 1,
        ...(cursor ? { cursor } : {}),
        ...(q.archived !== undefined ? { archived: q.archived } : {}),
        ...(q.subjectType ? { subjectType: q.subjectType } : {}),
        ...(q.subjectId ? { subjectId: q.subjectId } : {}),
      });
      const page = rows.slice(0, q.limit);
      const items = await this.shapeMany(page);
      const last = page[page.length - 1];
      return {
        items,
        nextCursor: rows.length > q.limit && last ? encodeCursor(last) : null,
      };
    });
  }

  async updateConversation(actorId: string, conversationId: string, patch: UpdateConversationInput): Promise<ConversationDto> {
    const orgId = requireOrganizationId();
    return this.commit(async () => {
      const { conversation, member } = await this.requireMembership(conversationId, actorId, { lock: true });
      this.requireOwner(member);
      if (conversation.type === "direct" && patch.title !== undefined) {
        throw ValidationError("messaging.direct_untitled", "A direct conversation has no title.");
      }
      await this.repo.updateConversation(conversationId, {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.archived !== undefined ? { archivedAt: patch.archived ? this.clock.now() : null } : {}),
        ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
      });
      await this.audit.record({
        actorId,
        action: patch.archived === true ? "messaging.conversation.archived" : "messaging.conversation.updated",
        resourceType: "messaging_conversation",
        resourceId: conversationId,
        after: { title: patch.title, archived: patch.archived },
      });
      const shaped = await this.shape(conversationId);
      await this.events.publish(
        conversationUpdated({
          organizationId: orgId,
          conversationId,
          memberUserIds: activeIds(shaped.members),
          conversation: shaped,
        }),
      );
      return this.viewFor(actorId, conversationId);
    });
  }

  async addMembers(actorId: string, conversationId: string, userIds: string[]): Promise<ConversationDto> {
    const orgId = requireOrganizationId();
    const targets = [...new Set(userIds)];
    await this.assertOrgMembers(orgId, targets);

    return this.commit(async () => {
      const { conversation, member } = await this.requireMembership(conversationId, actorId, { lock: true });
      this.requireOwner(member);
      if (conversation.type === "direct") {
        throw ValidationError("messaging.direct_fixed_members", "A direct conversation always has exactly two people.");
      }
      const now = this.clock.now();
      const added: string[] = [];
      for (const userId of targets) {
        if ((await this.repo.upsertMember({ conversationId, userId, role: "member", now })) === "added") added.push(userId);
      }
      if (added.length > 0) {
        await this.audit.record({
          actorId,
          action: "messaging.conversation.member_added",
          resourceType: "messaging_conversation",
          resourceId: conversationId,
          after: { userIds: added },
        });
        const shaped = await this.shape(conversationId);
        for (const userId of added) {
          const memberDto = shaped.members.find((m) => m.userId === userId)!;
          await this.events.publish(
            memberAdded({
              organizationId: orgId,
              conversationId,
              userId,
              member: memberDto,
              conversation: shaped,
              memberUserIds: activeIds(shaped.members),
            }),
          );
        }
      }
      return this.viewFor(actorId, conversationId);
    });
  }

  /** Remove another member (owner) or leave yourself (anyone). */
  async removeMember(actorId: string, conversationId: string, userId: string): Promise<void> {
    const orgId = requireOrganizationId();
    await this.commit(async () => {
      const { conversation, member } = await this.requireMembership(conversationId, actorId, { lock: true });
      if (conversation.type === "direct") {
        throw ValidationError("messaging.direct_fixed_members", "A direct conversation always has exactly two people.");
      }
      if (userId !== actorId) this.requireOwner(member);
      const target = userId === actorId ? member : await this.repo.findMember(conversationId, userId);
      if (!target || target.leftAt) throw NotFound("messaging.member_not_found", "That person is not in this conversation.");

      if (target.role === "owner") {
        const owners = (await this.repo.listMembers([conversationId])).filter((m) => m.role === "owner" && !m.leftAt);
        if (owners.length <= 1) {
          throw Conflict("messaging.last_owner", "A conversation must keep at least one owner. Make someone else an owner first, or archive it.");
        }
      }
      await this.repo.markMemberLeft(conversationId, userId, this.clock.now());
      await this.audit.record({
        actorId,
        action: "messaging.conversation.member_removed",
        resourceType: "messaging_conversation",
        resourceId: conversationId,
        after: { userId },
      });
      const shaped = await this.shape(conversationId);
      await this.events.publish(
        memberRemoved({ organizationId: orgId, conversationId, userId, memberUserIds: activeIds(shaped.members) }),
      );
    });
  }

  // ═══ messages ══════════════════════════════════════════════════════════════

  /**
   * Persist a message, bump the conversation, audit, and enqueue the outbox event —
   * one transaction. The realtime fan-out (and anything else subscribed) happens
   * only after COMMIT, from the outbox. Retrying with the same `clientMessageId`
   * returns the original message and writes nothing.
   */
  async sendMessage(actorId: string, conversationId: string, input: SendMessageInput): Promise<SendMessageResult> {
    const orgId = requireOrganizationId();
    const body = input.body.trim();

    return this.commit(async () => {
      // The conversation row lock serialises writers, which is what makes the
      // dedupe check below race-free and `seq`/`change_seq` commit-ordered.
      const { conversation } = await this.requireMembership(conversationId, actorId, { lock: true });
      if (conversation.archivedAt) {
        throw Conflict("messaging.conversation_archived", "This conversation is archived.");
      }

      if (input.clientMessageId) {
        const prior = await this.repo.findMessageByClientId(conversationId, actorId, input.clientMessageId);
        if (prior) return { message: (await this.toMessageDtos([prior]))[0]!, deduplicated: true };
      }

      if (input.replyToMessageId) {
        const target = await this.repo.findMessage(conversationId, input.replyToMessageId);
        if (!target) throw ValidationError("messaging.reply_target_invalid", "The message you are replying to is not in this conversation.");
      }

      const attachmentFileIds = [...new Set(input.attachmentFileIds ?? [])];
      const attachments = await this.resolveAttachments(actorId, attachmentFileIds);

      const now = this.clock.now();
      const id = newId("mmsg");
      const { seq, changeSeq } = await this.repo.advanceCounters(conversationId, { newMessage: { id, at: now } });
      const row = await this.repo.insertMessage({
        id,
        conversationId,
        senderId: actorId,
        body,
        messageType: "text",
        clientMessageId: input.clientMessageId ?? null,
        replyToMessageId: input.replyToMessageId ?? null,
        seq,
        changeSeq,
        metadata: input.metadata ?? {},
        now,
      });
      await this.repo.insertAttachments(
        attachments.map((a) => ({ id: newId("matt"), messageId: id, conversationId, ...a })),
      );
      // Sending implies having read everything up to your own message.
      await this.repo.advanceReadCursor({ conversationId, userId: actorId, messageId: id, messageSeq: seq, at: now });

      await this.audit.record({
        actorId,
        action: "messaging.message.sent",
        resourceType: "messaging_message",
        resourceId: id,
        // Never the body — only shape.
        after: { conversationId, attachments: attachments.length, isReply: Boolean(input.replyToMessageId) },
      });

      const [message] = await this.toMessageDtos([row]);
      const members = await this.repo.listMembers([conversationId]);
      await this.events.publish(
        messageCreated({
          organizationId: orgId,
          conversationId,
          memberUserIds: members.filter((m) => !m.leftAt).map((m) => m.userId),
          subjectType: conversation.subjectType,
          subjectId: conversation.subjectId,
          message: message!,
        }),
      );
      return { message: message!, deduplicated: false };
    });
  }

  async editMessage(actorId: string, conversationId: string, messageId: string, body: string): Promise<MessageDto> {
    const orgId = requireOrganizationId();
    return this.commit(async () => {
      const { conversation } = await this.requireMembership(conversationId, actorId, { lock: true });
      const existing = await this.requireMessage(conversationId, messageId);
      if (existing.senderId !== actorId) throw Forbidden("messaging.not_your_message", "You can only edit your own messages.");
      if (existing.deletedAt) throw Conflict("messaging.message_deleted", "This message was deleted.");
      if (existing.messageType !== "text") throw ValidationError("messaging.not_editable", "This message cannot be edited.");

      const { changeSeq } = await this.repo.advanceCounters(conversationId, {});
      const row = await this.repo.updateMessageBody(messageId, { body: body.trim(), changeSeq, at: this.clock.now() });
      await this.audit.record({
        actorId,
        action: "messaging.message.edited",
        resourceType: "messaging_message",
        resourceId: messageId,
        after: { conversationId },
      });
      const [message] = await this.toMessageDtos([row]);
      await this.publishMessageUpdated(orgId, conversation, message!);
      return message!;
    });
  }

  async deleteMessage(actorId: string, conversationId: string, messageId: string): Promise<void> {
    const orgId = requireOrganizationId();
    await this.commit(async () => {
      const { conversation } = await this.requireMembership(conversationId, actorId, { lock: true });
      const existing = await this.requireMessage(conversationId, messageId);
      if (existing.deletedAt) return; // idempotent
      if (existing.senderId !== actorId && !(await this.permissions.can(actorId, "moderate", "message"))) {
        throw Forbidden("messaging.not_your_message", "You can only delete your own messages.");
      }
      const at = this.clock.now();
      const { changeSeq } = await this.repo.advanceCounters(conversationId, {});
      await this.repo.softDeleteMessage(messageId, { changeSeq, at });
      // The file must stop being downloadable through this conversation.
      await this.repo.deleteAttachmentsForMessage(messageId);
      await this.audit.record({
        actorId,
        action: "messaging.message.deleted",
        resourceType: "messaging_message",
        resourceId: messageId,
        after: { conversationId, byModerator: existing.senderId !== actorId },
      });
      const members = await this.repo.listMembers([conversationId]);
      await this.events.publish(
        messageDeleted({
          organizationId: orgId,
          conversationId,
          memberUserIds: members.filter((m) => !m.leftAt).map((m) => m.userId),
          subjectType: conversation.subjectType,
          subjectId: conversation.subjectId,
          messageId,
          changeSeq,
          deletedAt: iso(at),
        }),
      );
    });
  }

  async addReaction(actorId: string, conversationId: string, messageId: string, emoji: string): Promise<MessageDto> {
    return this.reactionChange(actorId, conversationId, messageId, emoji, "add");
  }

  async removeReaction(actorId: string, conversationId: string, messageId: string, emoji: string): Promise<MessageDto> {
    return this.reactionChange(actorId, conversationId, messageId, emoji, "remove");
  }

  private async reactionChange(
    actorId: string,
    conversationId: string,
    messageId: string,
    emoji: string,
    op: "add" | "remove",
  ): Promise<MessageDto> {
    const orgId = requireOrganizationId();
    return this.commit(async () => {
      const { conversation } = await this.requireMembership(conversationId, actorId, { lock: true });
      const existing = await this.requireMessage(conversationId, messageId);
      if (existing.deletedAt) throw Conflict("messaging.message_deleted", "This message was deleted.");
      const changed =
        op === "add"
          ? await this.repo.addReaction({ messageId, conversationId, userId: actorId, emoji })
          : await this.repo.removeReaction({ messageId, userId: actorId, emoji });
      if (!changed) return (await this.toMessageDtos([existing]))[0]!;

      const { changeSeq } = await this.repo.advanceCounters(conversationId, {});
      const row = await this.repo.touchMessage(messageId, { changeSeq, at: this.clock.now() });
      const [message] = await this.toMessageDtos([row]);
      await this.publishMessageUpdated(orgId, conversation, message!);
      return message!;
    });
  }

  /** Newest page when `before` is omitted; scroll upward by passing the returned `olderCursor`. */
  async listMessages(actorId: string, conversationId: string, q: { before?: number; limit: number }): Promise<MessageHistoryPage> {
    return readInTenant(async () => {
      const { conversation } = await this.requireMembership(conversationId, actorId);
      const rows = await this.repo.listHistory(conversationId, {
        ...(q.before !== undefined ? { beforeSeq: q.before } : {}),
        limit: q.limit + 1,
      });
      const hasMore = rows.length > q.limit;
      const page = rows.slice(0, q.limit).reverse(); // oldest → newest
      return {
        messages: await this.toMessageDtos(page),
        olderCursor: hasMore ? page[0]!.seq : null,
        lastChangeSeq: conversation.lastChangeSeq,
      };
    });
  }

  /** Reconnect resync: every create/edit/delete/reaction after the caller's `changeSeq` cursor. */
  async syncMessages(actorId: string, conversationId: string, q: { afterChangeSeq: number; limit: number }): Promise<MessageSyncResult> {
    return readInTenant(async () => {
      const { conversation } = await this.requireMembership(conversationId, actorId);
      const rows = await this.repo.listChanges(conversationId, {
        afterChangeSeq: q.afterChangeSeq,
        limit: q.limit + 1,
      });
      const hasMore = rows.length > q.limit;
      const page = rows.slice(0, q.limit);
      return {
        messages: await this.toMessageDtos(page),
        lastChangeSeq: conversation.lastChangeSeq,
        hasMore,
        members: await this.memberDtos([conversationId]).then((m) => m.get(conversationId) ?? []),
      };
    });
  }

  /**
   * Move the caller's read cursor (monotonic). Broadcast directly after commit:
   * it is ephemeral-grade state whose truth is the persisted cursor — a lost
   * event self-heals on the next fetch — so it skips the outbox.
   */
  async markRead(
    actorId: string,
    conversationId: string,
    messageId?: string,
  ): Promise<{ lastReadMessageId: string; lastReadAt: string } | { lastReadMessageId: null }> {
    const result = await this.uow.transaction(async () => {
      await this.requireMembership(conversationId, actorId);
      const target = messageId
        ? await this.requireMessage(conversationId, messageId)
        : await this.repo.findLatestMessage(conversationId);
      if (!target) return { lastReadMessageId: null } as const;
      const at = this.clock.now();
      const moved = await this.repo.advanceReadCursor({
        conversationId,
        userId: actorId,
        messageId: target.id,
        messageSeq: target.seq,
        at,
      });
      if (!moved) {
        const member = (await this.repo.findMember(conversationId, actorId))!;
        return member.lastReadMessageId && member.lastReadAt
          ? ({ lastReadMessageId: member.lastReadMessageId, lastReadAt: iso(member.lastReadAt), moved: false } as const)
          : ({ lastReadMessageId: null } as const);
      }
      return { lastReadMessageId: target.id, lastReadAt: iso(at), moved: true } as const;
    });

    if (result.lastReadMessageId === null) return result;
    if ("moved" in result && result.moved) {
      this.realtime.toRoom(realtimeRooms.conversation(conversationId), MessagingEvent.ConversationRead, {
        conversationId,
        userId: actorId,
        lastReadMessageId: result.lastReadMessageId,
        lastReadAt: result.lastReadAt,
      });
    }
    return { lastReadMessageId: result.lastReadMessageId, lastReadAt: result.lastReadAt };
  }

  // ═══ attachments ═══════════════════════════════════════════════════════════

  /** Membership-checked download of a message attachment via Core's file storage. */
  async downloadAttachment(actorId: string, conversationId: string, attachmentId: string) {
    return readInTenant(async () => {
      await this.requireMembership(conversationId, actorId);
      const attachment = await this.repo.findAttachment(conversationId, attachmentId);
      if (!attachment) throw NotFound("messaging.attachment_not_found", "Attachment not found.");
      return this.files.getContent({ id: attachment.fileId });
    });
  }

  // ═══ socket support ════════════════════════════════════════════════════════

  /** Is this user CURRENTLY an active member? (Live check — used before joining a room.) */
  async isActiveMember(conversationId: string, userId: string): Promise<boolean> {
    return readInTenant(async () => {
      const member = await this.repo.findMember(conversationId, userId);
      return Boolean(member && !member.leftAt && (await this.repo.findConversation(conversationId)));
    });
  }

  /** Rooms the user's sockets should auto-join on connect — always derived from the DB. */
  async activeConversationIds(userId: string, limit = 1000): Promise<string[]> {
    return readInTenant(() => this.repo.activeConversationIds(userId, limit));
  }

  // ═══ IMessagingProvider (used by product AI tools / jobs) ══════════════════

  async recentMessages(actorId: string, conversationId: string, limit = 30): Promise<MessageDto[]> {
    const page = await this.listMessages(actorId, conversationId, { limit: Math.min(Math.max(limit, 1), 100) });
    return page.messages;
  }

  async searchMessages(
    actorId: string,
    input: { query: string; conversationId?: string; limit?: number },
  ): Promise<Array<{ conversationId: string; message: MessageDto }>> {
    return readInTenant(async () => {
      if (input.conversationId) await this.requireMembership(input.conversationId, actorId);
      const rows = await this.repo.searchMessages(actorId, {
        query: input.query,
        ...(input.conversationId ? { conversationId: input.conversationId } : {}),
        limit: Math.min(input.limit ?? 20, 50),
      });
      const dtos = await this.toMessageDtos(rows);
      return dtos.map((message) => ({ conversationId: message.conversationId, message }));
    });
  }

  async conversationsForSubject(actorId: string, subjectType: string, subjectId: string): Promise<ConversationDto[]> {
    const page = await this.listConversations(actorId, { limit: 50, subjectType, subjectId });
    return page.items;
  }

  async changesForAnalysis(conversationId: string, afterChangeSeq: number, limit: number) {
    requireOrganizationId();
    return readInTenant(async () => {
      const conversation = await this.repo.findConversation(conversationId);
      if (!conversation) throw NotFound("messaging.conversation_not_found", "Conversation not found.");
      const rows = await this.repo.listChanges(conversationId, { afterChangeSeq, limit: limit + 1 });
      const page = rows.slice(0, limit);
      const members = (await this.memberDtos([conversationId])).get(conversationId) ?? [];
      return {
        conversation: {
          id: conversation.id,
          type: conversation.type,
          title: conversation.title,
          subjectType: conversation.subjectType,
          subjectId: conversation.subjectId,
          members,
          lastChangeSeq: conversation.lastChangeSeq,
        },
        messages: await this.toMessageDtos(page),
        hasMore: rows.length > limit,
      };
    });
  }

  // ═══ internals ═════════════════════════════════════════════════════════════

  /** Run `fn` in one transaction, then nudge the outbox so fan-out starts now (post-COMMIT). */
  private async commit<T>(fn: () => Promise<T>): Promise<T> {
    const result = await this.uow.transaction(fn);
    this.outbox.nudge();
    return result;
  }

  private async requireMembership(
    conversationId: string,
    userId: string,
    opts: { lock?: boolean } = {},
  ): Promise<{ conversation: ConversationRow; member: MemberRow }> {
    // RLS hides another tenant's rows, so a foreign id is indistinguishable from a
    // missing one; a non-member gets the same answer.
    const conversation = await this.repo.findConversation(conversationId, { forUpdate: opts.lock === true });
    const member = conversation ? await this.repo.findMember(conversationId, userId) : null;
    if (!conversation || !member || member.leftAt) {
      throw NotFound("messaging.conversation_not_found", "Conversation not found.");
    }
    return { conversation, member };
  }

  private requireOwner(member: MemberRow): void {
    if (member.role !== "owner") {
      throw Forbidden("messaging.owner_required", "Only the conversation owner can do that.");
    }
  }

  private async requireMessage(conversationId: string, messageId: string): Promise<MessageRow> {
    const message = await this.repo.findMessage(conversationId, messageId);
    if (!message) throw NotFound("messaging.message_not_found", "Message not found.");
    return message;
  }

  private async assertOrgMembers(orgId: string, userIds: string[]): Promise<void> {
    const checks = await readInTenant(() =>
      Promise.all(userIds.map(async (u) => [u, await this.orgs.isMember(orgId, u)] as const)),
    );
    const bad = checks.filter(([, ok]) => !ok).map(([u]) => u);
    if (bad.length > 0) {
      throw ValidationError("messaging.member_not_in_organization", "Everyone in a conversation must belong to your organization.", { userIds: bad });
    }
  }

  /** Attachments must be confirmed uploads, in this tenant, that the SENDER uploaded. */
  private async resolveAttachments(actorId: string, fileIds: string[]) {
    const out: Array<{ fileId: string; fileName: string; contentType: string; byteSize: number }> = [];
    for (const fileId of fileIds) {
      const file = await this.files.describe(fileId).catch(() => null);
      if (!file || file.status !== "stored" || file.ownerId !== actorId) {
        throw ValidationError("messaging.attachment_invalid", "An attachment is missing, unfinished, or not yours.", { fileId });
      }
      out.push({ fileId, fileName: file.originalName, contentType: file.contentType, byteSize: file.byteSize });
    }
    return out;
  }

  private async publishMessageUpdated(orgId: string, conversation: ConversationRow, message: MessageDto): Promise<void> {
    const members = await this.repo.listMembers([conversation.id]);
    await this.events.publish(
      messageUpdated({
        organizationId: orgId,
        conversationId: conversation.id,
        memberUserIds: members.filter((m) => !m.leftAt).map((m) => m.userId),
        subjectType: conversation.subjectType,
        subjectId: conversation.subjectId,
        message,
      }),
    );
  }

  // ── DTO shaping ──────────────────────────────────────────────────────────

  /** The conversation as the caller sees it (with their read state). */
  private async viewFor(actorId: string, conversationId: string): Promise<ConversationDto> {
    const dto = await this.shape(conversationId);
    const member = await this.repo.findMember(conversationId, actorId);
    return {
      ...dto,
      me: {
        lastReadMessageId: member?.lastReadMessageId ?? null,
        lastReadAt: member?.lastReadAt ? iso(member.lastReadAt) : null,
        unreadCount: await this.repo.unreadCount(conversationId, actorId),
        muted: member?.muted ?? false,
        role: member?.role ?? "member",
      },
    };
  }

  /** Broadcast-safe conversation DTO (no viewer state). */
  private async shape(conversationId: string): Promise<ConversationDto> {
    const row = await this.repo.findConversation(conversationId);
    if (!row) throw NotFound("messaging.conversation_not_found", "Conversation not found.");
    return (await this.shapeRows([row]))[0]!;
  }

  private async shapeMany(rows: ConversationListRow[]): Promise<ConversationDto[]> {
    const dtos = await this.shapeRows(rows);
    return dtos.map((dto, i) => {
      const r = rows[i]!;
      return {
        ...dto,
        me: {
          lastReadMessageId: r.myLastReadMessageId,
          lastReadAt: r.myLastReadAt ? iso(r.myLastReadAt) : null,
          unreadCount: r.unreadCount,
          muted: r.myMuted,
          role: r.myRole,
        },
      };
    });
  }

  private async shapeRows(rows: ConversationRow[]): Promise<ConversationDto[]> {
    if (rows.length === 0) return [];
    const members = await this.memberDtos(rows.map((r) => r.id));
    const lastIds = rows.map((r) => r.lastMessageId).filter((v): v is string => Boolean(v));
    const lastMessages = new Map((await this.toMessageDtos(await this.repo.findMessagesByIds(lastIds))).map((m) => [m.id, m]));
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      subjectType: r.subjectType,
      subjectId: r.subjectId,
      createdBy: r.createdBy,
      createdAt: iso(r.createdAt),
      updatedAt: iso(r.updatedAt),
      lastMessageAt: r.lastMessageAt ? iso(r.lastMessageAt) : null,
      lastMessage: r.lastMessageId ? (lastMessages.get(r.lastMessageId) ?? null) : null,
      archivedAt: r.archivedAt ? iso(r.archivedAt) : null,
      metadata: r.metadata,
      lastChangeSeq: r.lastChangeSeq,
      members: members.get(r.id) ?? [],
    }));
  }

  private async memberDtos(conversationIds: string[]): Promise<Map<string, ConversationMemberDto[]>> {
    const rows = await this.repo.listMembers(conversationIds);
    const names = await this.displayNames(rows.map((r) => r.userId));
    const out = new Map<string, ConversationMemberDto[]>();
    for (const r of rows) {
      const list = out.get(r.conversationId) ?? [];
      list.push({
        userId: r.userId,
        displayName: names.get(r.userId) ?? "—",
        role: r.role,
        joinedAt: iso(r.joinedAt),
        leftAt: r.leftAt ? iso(r.leftAt) : null,
        lastReadMessageId: r.lastReadMessageId,
        lastReadAt: r.lastReadAt ? iso(r.lastReadAt) : null,
      });
      out.set(r.conversationId, list);
    }
    return out;
  }

  private displayNames(userIds: string[]): Promise<Map<string, string>> {
    return this.directory.userNames(userIds);
  }

  private async toMessageDtos(rows: MessageRow[]): Promise<MessageDto[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const [attachments, reactions] = await Promise.all([this.repo.listAttachments(ids), this.repo.listReactions(ids)]);

    const attachmentsBy = new Map<string, MessageAttachmentDto[]>();
    for (const a of attachments) {
      const list = attachmentsBy.get(a.messageId) ?? [];
      list.push({ id: a.id, fileId: a.fileId, fileName: a.fileName, contentType: a.contentType, byteSize: a.byteSize });
      attachmentsBy.set(a.messageId, list);
    }
    const reactionsBy = new Map<string, Map<string, string[]>>();
    for (const r of reactions) {
      const byEmoji = reactionsBy.get(r.messageId) ?? new Map<string, string[]>();
      byEmoji.set(r.emoji, [...(byEmoji.get(r.emoji) ?? []), r.userId]);
      reactionsBy.set(r.messageId, byEmoji);
    }

    return rows.map((r) => {
      const summary: ReactionSummaryDto[] = [...(reactionsBy.get(r.id) ?? new Map<string, string[]>())].map(
        ([emoji, userIds]) => ({ emoji, userIds }),
      );
      return {
        id: r.id,
        conversationId: r.conversationId,
        senderId: r.senderId,
        body: r.deletedAt ? "" : r.body,
        messageType: r.messageType,
        clientMessageId: r.clientMessageId,
        replyToMessageId: r.replyToMessageId,
        seq: r.seq,
        changeSeq: r.changeSeq,
        createdAt: iso(r.createdAt),
        updatedAt: iso(r.updatedAt),
        editedAt: r.editedAt ? iso(r.editedAt) : null,
        deletedAt: r.deletedAt ? iso(r.deletedAt) : null,
        metadata: r.metadata,
        attachments: attachmentsBy.get(r.id) ?? [],
        reactions: summary,
      };
    });
  }
}

const activeIds = (members: ConversationMemberDto[]) => members.filter((m) => !m.leftAt).map((m) => m.userId);

function encodeCursor(row: ConversationListRow): string {
  return Buffer.from(`${row.activityCursor}|${row.id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): { activity: string; id: string } | undefined {
  if (!cursor) return undefined;
  const [activity, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  if (!activity || !id || Number.isNaN(Date.parse(activity))) {
    throw ValidationError("messaging.bad_cursor", "That page cursor is not valid.");
  }
  return { activity, id };
}
