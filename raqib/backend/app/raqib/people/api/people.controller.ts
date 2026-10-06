import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, UseGuards, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import { Allow, AccessGuard, Caller, SetupRoute } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { PeopleService } from "../application/people-service.js";
import {
  changeRoleSchema,
  setScopeSchema,
  setStatusSchema,
  updateProfileSchema,
  type ChangeRoleBody,
  type SetScopeBody,
  type SetStatusBody,
  type UpdateProfileBody,
} from "../validation/people.schema.js";
import { parsePage, toPage } from "@raqib/raqib/shared/paging.js";

@ApiTags("raqib · people")
@ApiBearerAuth("access-token")
@Controller("raqib")
@UseGuards(JwtAuthGuard, AccessGuard)
export class PeopleController {
  constructor(private readonly service: PeopleService) {}

  /** The signed-in person: identity, role, project scope and effective permission template. */
  @Get("me")
  @Allow()
  @SetupRoute()
  me(@Caller() who: Access) {
    return this.service.me(who);
  }

  @Get("users")
  @Allow("users", "V")
  async list(@Query() q: { limit?: string; cursor?: string }, @Caller() who: Access) {
    const page = parsePage(q);
    return toPage(await this.service.list(who, page), page);
  }

  @Get("users/:id")
  @Allow("users", "V")
  get(@Param("id") id: string, @Caller() who: Access) {
    return this.service.get(id, who);
  }

  /** Correct how a person is named, titled and reached. Role, scope and status have their own routes. */
  @Patch("users/:id")
  @Allow("users", "E")
  updateProfile(@Param("id") id: string, @Body(ZodBody(updateProfileSchema)) b: UpdateProfileBody, @Caller() who: Access) {
    const { reason, ...patch } = b;
    return this.service.updateProfile(id, patch, reason, who);
  }

  @Put("users/:id/role")
  @Allow("users", "E")
  changeRole(@Param("id") id: string, @Body(ZodBody(changeRoleSchema)) b: ChangeRoleBody, @Caller() who: Access) {
    return this.service.changeRole(id, b.role, b.reason, who);
  }

  @Put("users/:id/scope")
  @Allow("users", "E")
  setScope(@Param("id") id: string, @Body(ZodBody(setScopeSchema)) b: SetScopeBody, @Caller() who: Access) {
    return this.service.setScope(id, b.projectIds, b.reason, who);
  }

  @Post("users/:id/status")
  @HttpCode(200)
  @Allow("users", "E")
  setStatus(@Param("id") id: string, @Body(ZodBody(setStatusSchema)) b: SetStatusBody, @Caller() who: Access) {
    return this.service.setStatus(id, b.status, b.reason, who);
  }
}
