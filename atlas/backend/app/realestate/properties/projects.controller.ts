import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { ProjectsService } from "./projects-service.js";
import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectBody,
  type UpdateProjectBody,
} from "./projects.schema.js";

@ApiTags("realestate · projects")
@ApiBearerAuth("access-token")
@Controller("realestate/projects")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  @RequirePermission("read", "project")
  list() {
    return this.service.list();
  }

  @Get(":id")
  @RequirePermission("read", "project")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "project")
  create(@Body(ZodBody(createProjectSchema)) body: CreateProjectBody, @CurrentUser() user: Principal) {
    return this.service.create(body, user.userId);
  }

  @Patch(":id")
  @RequirePermission("update", "project")
  update(
    @Param("id") id: string,
    @Body(ZodBody(updateProjectSchema)) body: UpdateProjectBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.update(id, body, user.userId);
  }
}
