import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { AdminService } from "../application/admin-service.js";
import { OrgSettingsService } from "../application/org-settings-service.js";
import { assignRoleSchema, updateOrgSettingsSchema, type AssignRoleBody, type UpdateOrgSettingsBody } from "../validation/admin.schema.js";
import { z } from "zod";

const auditQuery = z.object({ q: z.string().optional(), action: z.string().optional(), actor: z.string().optional() });

/**
 * Real-estate adapter over Core RBAC/audit/notifications, reshaped for the
 * Administration screens (Team, Roles & Permissions, Audit Logs,
 * Notifications) — mirrors `mizan/backend/app/lawfirm/admin/admin.controller.ts`.
 */
@ApiTags("realestate · admin")
@ApiBearerAuth("access-token")
@Controller("realestate")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly settings: OrgSettingsService,
  ) {}

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
  assign(@Body(ZodBody(assignRoleSchema)) body: AssignRoleBody, @CurrentUser() user: Principal) {
    return this.service.assignRole(body.userId, body.role, user.userId);
  }

  @Get("audit-logs")
  @RequirePermission("read", "audit_log")
  auditLogs(@Query(ZodQuery(auditQuery)) q: z.infer<typeof auditQuery>) {
    return this.service.auditLogs(q);
  }

  @Get("org-settings")
  @RequirePermission("read", "org_setting")
  getSettings() {
    return this.settings.get();
  }

  @Patch("org-settings")
  @RequirePermission("update", "org_setting")
  updateSettings(@Body(ZodBody(updateOrgSettingsSchema)) body: UpdateOrgSettingsBody) {
    return this.settings.update(body);
  }

  @Get("notifications")
  notifications(@Query(ZodQuery(z.object({ unread: z.coerce.boolean().optional() }))) q: { unread?: boolean }, @CurrentUser() user: Principal) {
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
