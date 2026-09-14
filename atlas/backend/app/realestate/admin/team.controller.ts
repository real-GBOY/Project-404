import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { TeamService } from "./team-service.js";

@ApiTags("realestate · team")
@ApiBearerAuth("access-token")
@Controller("team")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TeamController {
  constructor(private readonly service: TeamService) {}

  @Get()
  @RequirePermission("read", "role")
  list() {
    return this.service.list();
  }
}
