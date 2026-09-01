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

@Controller("organizations")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OrganizationsController {
  constructor(private readonly service: OrganizationService) {}

  // Self-service (§ docs/tenancy.md): any authenticated user may create an
  // organization and becomes its owner + tenant-scoped admin. No RBAC guard.
  @Post()
  @HttpCode(201)
  async create(
    @Body(ZodBody(createOrganizationSchema)) input: z.infer<typeof createOrganizationSchema>,
    @CurrentUser() user: Principal,
  ) {
    return { organization: await this.service.createOrganization({ ...input, createdBy: user.userId }) };
  }

  @Get(":id")
  @RequirePermission("read", "organization")
  async get(@Param("id") id: string, @CurrentUser() user: Principal) {
    this.assertActive(user, id);
    return { organization: await this.service.getOrganization(id) };
  }

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

  @Get(":id/members")
  @RequirePermission("read", "organization")
  async members(@Param("id") id: string, @CurrentUser() user: Principal) {
    this.assertActive(user, id);
    return { members: await this.service.listMembers(id) };
  }

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
