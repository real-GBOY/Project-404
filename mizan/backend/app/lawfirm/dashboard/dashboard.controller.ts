import { Controller, Get, UseGuards } from "@nestjs/common";
import { RequirePermission } from "../../../../../core/http/decorators.js";
import { JwtAuthGuard } from "../../../../../core/http/jwt-auth.guard.js";
import { PermissionGuard } from "../../../../../core/http/permission.guard.js";
import { DashboardService } from "./dashboard-service.js";

@Controller("dashboard")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  @RequirePermission("read", "dashboard")
  data() {
    return this.service.data();
  }
}
