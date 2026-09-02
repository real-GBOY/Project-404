import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { AdminService } from "./admin-service.js";

const assignSchema = z.object({ userId: z.string().min(1), role: z.string().min(1) });
const auditQuery = z.object({ q: z.string().optional() });

/**
 * Law-firm adapter over Core RBAC + audit — reshaped to exactly what the web
 * Settings screen expects (`mizan/web/src/features/settings/api/settings.api.ts`).
 */
@Controller("lawfirm")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get("rbac/roles")
  @RequirePermission("read", "role")
  roles() {
    return this.service.roles();
  }

  @Get("rbac/members")
  @RequirePermission("read", "role")
  members() {
    return this.service.members();
  }

  @Post("rbac/assignments")
  @RequirePermission("assign", "role")
  assign(@Body(ZodBody(assignSchema)) body: z.infer<typeof assignSchema>, @CurrentUser() user: Principal) {
    return this.service.assignRole(body.userId, body.role, user.userId);
  }

  @Get("audit-logs")
  @RequirePermission("read", "audit_log")
  auditLogs(@Query(ZodQuery(auditQuery)) q: z.infer<typeof auditQuery>) {
    return this.service.auditLogs(q.q);
  }

  // ─── notifications (Core shape → web NotificationList) ─────────────────────
  @Get("notifications")
  notifications(
    @Query(ZodQuery(z.object({ unread: z.coerce.boolean().optional() }))) q: { unread?: boolean },
    @CurrentUser() user: Principal,
  ) {
    return this.service.notifications(user.userId, q.unread ?? false);
  }

  @Post("notifications/read-all")
  @HttpCode(204)
  async readAll(@CurrentUser() user: Principal) {
    await this.service.markAllNotificationsRead(user.userId);
  }

  @Post("notifications/:id/read")
  @HttpCode(204)
  async readOne(@Param("id") id: string, @CurrentUser() user: Principal) {
    await this.service.markNotificationRead(user.userId, id);
  }
}
