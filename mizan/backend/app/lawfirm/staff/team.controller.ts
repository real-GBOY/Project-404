import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import { TeamService } from "./team-service.js";

const updateSchema = z.object({
  title: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(60).nullish(),
  practiceAreas: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  weeklyCapacityHours: z.number().int().min(0).max(80).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

const createSchema = z.object({
  userId: z.string().min(1),
  title: z.string().trim().max(120).optional(),
  weeklyCapacityHours: z.number().int().min(0).max(80).optional(),
  practiceAreas: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});

@ApiTags("lawfirm · staff")
@ApiBearerAuth("access-token")
@Controller("team")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TeamController {
  constructor(private readonly service: TeamService) {}

  @Get("summary")
  @RequirePermission("read", "staff")
  summary() {
    return this.service.summary();
  }

  @Get()
  @RequirePermission("read", "staff")
  list() {
    return this.service.list();
  }

  @Get("candidates")
  @RequirePermission("manage", "staff")
  candidates() {
    return this.service.candidates();
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("manage", "staff")
  create(@Body(ZodBody(createSchema)) body: z.infer<typeof createSchema>) {
    return this.service.create(body);
  }

  @Get(":id")
  @RequirePermission("read", "staff")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Patch(":id")
  @RequirePermission("manage", "staff")
  update(@Param("id") id: string, @Body(ZodBody(updateSchema)) body: z.infer<typeof updateSchema>) {
    return this.service.update(id, {
      title: body.title,
      phone: body.phone ?? undefined,
      practiceAreas: body.practiceAreas,
      weeklyCapacityHours: body.weeklyCapacityHours,
      status: body.status,
    });
  }
}
