import { Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { NotificationService } from "@core/notifications/application/notification-service.js";

const listQuery = z.object({
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

/**
 * In-app notification inbox (§7.5). Every route acts on the **caller's own**
 * notifications — the id in the token, not a path param — so no RBAC permission
 * is needed, just a valid session. A person's notifications are visible in any
 * tenant context (account-level rows have a NULL `organization_id`).
 */
@ApiTags("notifications")
@ApiBearerAuth("access-token")
@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationService) {}

  /**
   * GET /api/notifications — the caller's notifications, newest first.
   * `?unreadOnly=true`, `?limit=`, `?cursor=` (keyset). Returns the page plus
   * `unreadCount` and `nextCursor`.
   */
  @Get()
  async list(
    @Query(ZodQuery(listQuery)) q: z.infer<typeof listQuery>,
    @CurrentUser() user: Principal,
  ) {
    const rows = await this.service.listForUser(user.userId, q);
    return {
      notifications: rows.map((row) => this.service.toPublic(row)),
      unreadCount: await this.service.unreadCount(user.userId),
      nextCursor: rows.length === (q.limit ?? 30) ? rows[rows.length - 1]?.id : undefined,
    };
  }

  /** POST /api/notifications/:id/read — mark one of the caller's notifications read (204, idempotent). */
  @Post(":id/read")
  @HttpCode(204)
  async markRead(@Param("id") id: string, @CurrentUser() user: Principal) {
    await this.service.markRead(user.userId, id);
  }

  /** POST /api/notifications/read-all — mark all of the caller's unread notifications read (204). */
  @Post("read-all")
  @HttpCode(204)
  async markAllRead(@CurrentUser() user: Principal) {
    await this.service.markAllRead(user.userId);
  }
}
