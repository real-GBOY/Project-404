import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import type { Principal } from "@core/http/principal.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import { MessagingService } from "@core/messaging/application/messaging-service.js";
import {
  addMembersSchema,
  createConversationSchema,
  editMessageSchema,
  historyQuerySchema,
  listConversationsQuerySchema,
  markReadSchema,
  reactionSchema,
  searchQuerySchema,
  sendMessageSchema,
  syncQuerySchema,
  updateConversationSchema,
  type CreateConversationInput,
  type SendMessageInput,
  type UpdateConversationInput,
} from "@core/messaging/validation/schemas.js";
import type { z } from "zod";

/**
 * REST surface for messaging. WebSocket handles the live flow; REST handles
 * history, resync, and anything that is not latency-sensitive (and gives
 * non-browser callers a way in). Both paths call the same `MessagingService`,
 * so the rules cannot drift apart.
 *
 * Authorization is two layers: the coarse RBAC permission on each route, then
 * conversation MEMBERSHIP inside the service.
 */
@ApiTags("messaging")
@ApiBearerAuth("access-token")
@Controller("conversations")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get()
  @RequirePermission("read", "conversation")
  list(
    @Query(ZodQuery(listConversationsQuerySchema)) q: z.infer<typeof listConversationsQuerySchema>,
    @CurrentUser() user: Principal,
  ) {
    return this.messaging.listConversations(user.userId, q);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "conversation")
  create(@Body(ZodBody(createConversationSchema)) body: CreateConversationInput, @CurrentUser() user: Principal) {
    return this.messaging.createConversation(user.userId, body);
  }

  /** Cross-conversation search over the caller's own conversations. */
  @Get("search")
  @RequirePermission("read", "conversation")
  search(@Query(ZodQuery(searchQuerySchema)) q: z.infer<typeof searchQuerySchema>, @CurrentUser() user: Principal) {
    return this.messaging.searchMessages(user.userId, {
      query: q.q,
      ...(q.conversationId ? { conversationId: q.conversationId } : {}),
      limit: q.limit,
    });
  }

  @Get(":id")
  @RequirePermission("read", "conversation")
  get(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.messaging.getConversation(user.userId, id);
  }

  @Patch(":id")
  @RequirePermission("create", "conversation")
  update(
    @Param("id") id: string,
    @Body(ZodBody(updateConversationSchema)) body: UpdateConversationInput,
    @CurrentUser() user: Principal,
  ) {
    return this.messaging.updateConversation(user.userId, id, body);
  }

  @Post(":id/members")
  @HttpCode(200)
  @RequirePermission("create", "conversation")
  addMembers(
    @Param("id") id: string,
    @Body(ZodBody(addMembersSchema)) body: z.infer<typeof addMembersSchema>,
    @CurrentUser() user: Principal,
  ) {
    return this.messaging.addMembers(user.userId, id, body.userIds);
  }

  /** Remove a member (owner) — or, with your own id, leave. */
  @Delete(":id/members/:userId")
  @HttpCode(204)
  @RequirePermission("read", "conversation")
  async removeMember(@Param("id") id: string, @Param("userId") userId: string, @CurrentUser() user: Principal) {
    await this.messaging.removeMember(user.userId, id, userId);
  }

  /** History: latest page by default; pass `before=<olderCursor>` to scroll upward. */
  @Get(":id/messages")
  @RequirePermission("read", "conversation")
  history(
    @Param("id") id: string,
    @Query(ZodQuery(historyQuerySchema)) q: z.infer<typeof historyQuerySchema>,
    @CurrentUser() user: Principal,
  ) {
    return this.messaging.listMessages(user.userId, id, q);
  }

  /** Reconnect resync: everything that changed after `afterChangeSeq`. */
  @Get(":id/sync")
  @RequirePermission("read", "conversation")
  sync(
    @Param("id") id: string,
    @Query(ZodQuery(syncQuerySchema)) q: z.infer<typeof syncQuerySchema>,
    @CurrentUser() user: Principal,
  ) {
    return this.messaging.syncMessages(user.userId, id, q);
  }

  @Post(":id/messages")
  @HttpCode(201)
  @RequirePermission("send", "message")
  send(@Param("id") id: string, @Body(ZodBody(sendMessageSchema)) body: SendMessageInput, @CurrentUser() user: Principal) {
    return this.messaging.sendMessage(user.userId, id, body);
  }

  @Patch(":id/messages/:messageId")
  @RequirePermission("send", "message")
  edit(
    @Param("id") id: string,
    @Param("messageId") messageId: string,
    @Body(ZodBody(editMessageSchema)) body: z.infer<typeof editMessageSchema>,
    @CurrentUser() user: Principal,
  ) {
    return this.messaging.editMessage(user.userId, id, messageId, body.body);
  }

  @Delete(":id/messages/:messageId")
  @HttpCode(204)
  @RequirePermission("send", "message")
  async remove(@Param("id") id: string, @Param("messageId") messageId: string, @CurrentUser() user: Principal) {
    await this.messaging.deleteMessage(user.userId, id, messageId);
  }

  @Put(":id/messages/:messageId/reactions")
  @RequirePermission("send", "message")
  react(
    @Param("id") id: string,
    @Param("messageId") messageId: string,
    @Body(ZodBody(reactionSchema)) body: z.infer<typeof reactionSchema>,
    @CurrentUser() user: Principal,
  ) {
    return this.messaging.addReaction(user.userId, id, messageId, body.emoji);
  }

  @Delete(":id/messages/:messageId/reactions/:emoji")
  @RequirePermission("send", "message")
  unreact(
    @Param("id") id: string,
    @Param("messageId") messageId: string,
    @Param("emoji") emoji: string,
    @CurrentUser() user: Principal,
  ) {
    return this.messaging.removeReaction(user.userId, id, messageId, emoji);
  }

  @Post(":id/read")
  @HttpCode(200)
  @RequirePermission("read", "conversation")
  markRead(
    @Param("id") id: string,
    @Body(ZodBody(markReadSchema)) body: z.infer<typeof markReadSchema>,
    @CurrentUser() user: Principal,
  ) {
    return this.messaging.markRead(user.userId, id, body.messageId);
  }

  /** Membership-checked attachment download (bytes come from Core file storage). */
  @Get(":id/attachments/:attachmentId")
  @RequirePermission("read", "conversation")
  async downloadAttachment(
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: Principal,
    @Res() reply: FastifyReply,
  ) {
    const { content, ref } = await this.messaging.downloadAttachment(user.userId, id, attachmentId);
    reply
      .header("Content-Type", ref.contentType)
      // Uploaded content is untrusted: never let a browser sniff it into something executable.
      .header("X-Content-Type-Options", "nosniff")
      .header("Content-Disposition", `attachment; filename="${encodeURIComponent(ref.originalName)}"`)
      .send(content);
  }
}
