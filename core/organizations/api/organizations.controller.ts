import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import type { z } from "zod";
import { Forbidden } from "../../kernel/errors.js";
import { CurrentUser, RequirePermission } from "../../http/decorators.js";
import { JwtAuthGuard } from "../../http/jwt-auth.guard.js";
import { PermissionGuard } from "../../http/permission.guard.js";
import { ZodBody } from "../../http/zod.pipe.js";
import type { Principal } from "../../http/principal.js";
import { OrganizationService } from "../application/organization-service.js";
import {
  addMemberSchema,
  createOrganizationSchema,
  updateSettingsSchema,
} from "../validation/schemas.js";

/**
 * Organizations & membership (§7.4). The organization **is** the tenant
 * (§ docs/tenancy.md). Creation is self-service; everything else operates on the
 * caller's *active* tenant — `assertActive` rejects a `:id` that isn't it (RLS
 * is the backstop, this is the clean 403).
 */
@Controller("organizations")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OrganizationsController {
  constructor(private readonly service: OrganizationService) {}

  /**
   * POST /api/organizations — any authenticated user may create one and becomes
   * its `owner` + tenant-scoped `admin` (via the `organization.created`
   * subscriber). 201. No RBAC guard — a brand-new user holds no permissions yet.
   * The caller's *current* token stays orgless until they `refresh` into it.
   */
  @Post()
  @HttpCode(201)
  async create(
    @Body(ZodBody(createOrganizationSchema)) input: z.infer<typeof createOrganizationSchema>,
    @CurrentUser() user: Principal,
  ) {
    return { organization: await this.service.createOrganization({ ...input, createdBy: user.userId }) };
  }

  /** GET /api/organizations/:id — the active tenant's record. Needs `read:organization`. */
  @Get(":id")
  @RequirePermission("read", "organization")
  async get(@Param("id") id: string, @CurrentUser() user: Principal) {
    this.assertActive(user, id);
    return { organization: await this.service.getOrganization(id) };
  }

  /** PATCH /api/organizations/:id/settings — replace the JSON settings blob. Needs `update:organization`. */
  @Patch(":id/settings")
  @RequirePermission("update", "organization")
  async updateSettings(
    @Param("id") id: string,
    @Body(ZodBody(updateSettingsSchema)) body: z.infer<typeof updateSettingsSchema>,
    @CurrentUser() user: Principal,
  ) {
    this.assertActive(user, id);
    return { organization: await this.service.updateSettings(id, body.settings) };
  }

  /** GET /api/organizations/:id/members — members of the active tenant. Needs `read:organization`. */
  @Get(":id/members")
  @RequirePermission("read", "organization")
  async members(@Param("id") id: string, @CurrentUser() user: Principal) {
    this.assertActive(user, id);
    return { members: await this.service.listMembers(id) };
  }

  /**
   * POST /api/organizations/:id/members — add an existing user to the active
   * tenant (201). Needs `manage_members:organization`. 409 if already a member.
   */
  @Post(":id/members")
  @HttpCode(201)
  @RequirePermission("manage_members", "organization")
  async addMember(
    @Param("id") id: string,
    @Body(ZodBody(addMemberSchema)) input: z.infer<typeof addMemberSchema>,
    @CurrentUser() user: Principal,
  ) {
    this.assertActive(user, id);
    const member = await this.service.addMember({
      organizationId: id,
      userId: input.userId,
      ...(input.membershipRole ? { membershipRole: input.membershipRole } : {}),
      actorId: user.userId,
    });
    return { member };
  }

  /** DELETE /api/organizations/:id/members/:userId — remove a member from the active tenant (204). */
  @Delete(":id/members/:userId")
  @HttpCode(204)
  @RequirePermission("manage_members", "organization")
  async removeMember(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @CurrentUser() user: Principal,
  ) {
    this.assertActive(user, id);
    await this.service.removeMember(id, userId, user.userId);
  }

  /** Everything but create operates on the caller's active tenant. */
  private assertActive(user: Principal, id: string): void {
    if (id !== user.organizationId) {
      throw Forbidden("organizations.not_active", "That organization is not your active tenant.");
    }
  }
}
