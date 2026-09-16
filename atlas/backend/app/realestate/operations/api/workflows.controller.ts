import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import { WorkflowsService } from "../application/workflows-service.js";
import { createWorkflowSchema, type CreateWorkflowBody } from "../validation/workflows.schema.js";

@ApiTags("realestate · workflows")
@ApiBearerAuth("access-token")
@Controller("realestate/workflows")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WorkflowsController {
  constructor(private readonly service: WorkflowsService) {}

  @Get()
  @RequirePermission("read", "workflow")
  list() {
    return this.service.list();
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "workflow")
  create(@Body(ZodBody(createWorkflowSchema)) body: CreateWorkflowBody) {
    return this.service.create(body);
  }

  @Post(":id/steps/:seqNo/advance")
  @RequirePermission("create", "workflow")
  advance(@Param("id") id: string, @Param("seqNo") seqNo: string) {
    return this.service.advance(id, Number(seqNo));
  }
}
