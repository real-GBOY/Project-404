import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodQuery } from "@core/http/zod.pipe.js";
import { z } from "zod";
import { TeamService } from "./team-service.js";

const listTeamQuery = z.object({
  role: z.string().optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

@ApiTags("realestate · team")
@ApiBearerAuth("access-token")
@Controller("team")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TeamController {
  constructor(private readonly service: TeamService) {}

  @Get()
  @RequirePermission("read", "role")
  list(@Query(ZodQuery(listTeamQuery)) q: z.infer<typeof listTeamQuery>) {
    return this.service.list(q);
  }
}
