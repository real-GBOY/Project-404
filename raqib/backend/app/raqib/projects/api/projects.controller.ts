import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { ProjectsService } from "../application/projects-service.js";
import {
  createGuardSchema,
  createProjectSchema,
  guardStatusSchema,
  nameSchema,
  updateGuardSchema,
  updateProjectSchema,
  type CreateGuardBody,
  type CreateProjectBody,
  type GuardStatusBody,
  type NameBody,
  type UpdateGuardBody,
  type UpdateProjectBody,
} from "../validation/projects.schema.js";

@ApiTags("raqib · projects")
@ApiBearerAuth("access-token")
@Controller("raqib")
@UseGuards(JwtAuthGuard, AccessGuard)
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get("projects")
  @Allow("projects", "V")
  async list(@Caller() who: Access) {
    return { items: await this.service.list(who) };
  }

  @Get("projects/:id")
  @Allow("projects", "V")
  get(@Param("id") id: string, @Caller() who: Access) {
    return this.service.get(id, who);
  }

  @Post("projects")
  @HttpCode(201)
  @Allow("projects", "A")
  create(@Body(ZodBody(createProjectSchema)) b: CreateProjectBody, @Caller() who: Access) {
    return this.service.create(b, who);
  }

  @Patch("projects/:id")
  @Allow("projects", "E")
  update(@Param("id") id: string, @Body(ZodBody(updateProjectSchema)) b: UpdateProjectBody, @Caller() who: Access) {
    return this.service.update(id, b, who);
  }

  @Post("projects/:id/sites")
  @HttpCode(201)
  @Allow("projects", "E")
  addSite(@Param("id") id: string, @Body(ZodBody(nameSchema)) b: NameBody, @Caller() who: Access) {
    return this.service.addSite(id, b.name, who);
  }

  @Patch("sites/:id")
  @Allow("projects", "E")
  renameSite(@Param("id") id: string, @Body(ZodBody(nameSchema)) b: NameBody, @Caller() who: Access) {
    return this.service.renameSite(id, b.name, who);
  }

  @Delete("sites/:id")
  @Allow("projects", "E")
  archiveSite(@Param("id") id: string, @Caller() who: Access) {
    return this.service.archiveSite(id, who);
  }

  @Post("sites/:id/areas")
  @HttpCode(201)
  @Allow("projects", "E")
  addArea(@Param("id") id: string, @Body(ZodBody(nameSchema)) b: NameBody, @Caller() who: Access) {
    return this.service.addArea(id, b.name, who);
  }

  @Delete("areas/:id")
  @Allow("projects", "E")
  archiveArea(@Param("id") id: string, @Caller() who: Access) {
    return this.service.archiveArea(id, who);
  }

  // Guards are managed with the project's edit right, and read through the same scope model (no template module of their own).
  @Post("guards")
  @HttpCode(201)
  @Allow("projects", "E")
  createGuard(@Body(ZodBody(createGuardSchema)) b: CreateGuardBody, @Caller() who: Access) {
    return this.service.createGuard(b, who);
  }

  @Patch("guards/:id")
  @Allow("projects", "E")
  updateGuard(@Param("id") id: string, @Body(ZodBody(updateGuardSchema)) b: UpdateGuardBody, @Caller() who: Access) {
    return this.service.updateGuard(id, b, who);
  }

  @Post("guards/:id/status")
  @HttpCode(200)
  @Allow("projects", "E")
  setGuardStatus(@Param("id") id: string, @Body(ZodBody(guardStatusSchema)) b: GuardStatusBody, @Caller() who: Access) {
    return this.service.setGuardStatus(id, b.status, who);
  }

  // Guards are read through the same scope model (no template module of their own).
  @Get("guards")
  @Allow()
  async guards(@Caller() who: Access) {
    return { items: await this.service.guards(who) };
  }

  @Get("guards/:id")
  @Allow()
  guard(@Param("id") id: string, @Caller() who: Access) {
    return this.service.guard(id, who);
  }
}
