import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
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
