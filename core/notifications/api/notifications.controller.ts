import { Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser } from "../../http/decorators.js";
import { JwtAuthGuard } from "../../http/jwt-auth.guard.js";
import { ZodQuery } from "../../http/zod.pipe.js";
import type { Principal } from "../../http/principal.js";
import { NotificationService } from "../application/notification-service.js";

const listQuery = z.object({
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationService) {}

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

  @Post(":id/read")
  @HttpCode(204)
  async markRead(@Param("id") id: string, @CurrentUser() user: Principal) {
    await this.service.markRead(user.userId, id);
  }

  @Post("read-all")
  @HttpCode(204)
  async markAllRead(@CurrentUser() user: Principal) {
    await this.service.markAllRead(user.userId);
  }
}
