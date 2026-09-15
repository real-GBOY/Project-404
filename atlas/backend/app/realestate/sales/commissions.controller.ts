import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import { CommissionsService } from "./commissions-service.js";
import {
  listCommissionsQuery,
  updateCommissionStatusSchema,
  upsertCommissionSchema,
  type ListCommissionsQuery,
  type UpdateCommissionStatusBody,
  type UpsertCommissionBody,
} from "./commissions.schema.js";

@ApiTags("realestate · commissions")
@ApiBearerAuth("access-token")
@Controller("realestate/commissions")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CommissionsController {
  constructor(private readonly service: CommissionsService) {}

  @Get()
  @RequirePermission("read", "commission")
  list(@Query(ZodQuery(listCommissionsQuery)) q: ListCommissionsQuery) {
    return this.service.list(q);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("update", "commission")
  upsert(@Body(ZodBody(upsertCommissionSchema)) body: UpsertCommissionBody) {
    return this.service.upsert(body);
  }

  @Patch(":id/status")
  @RequirePermission("update", "commission")
  updateStatus(@Param("id") id: string, @Body(ZodBody(updateCommissionStatusSchema)) body: UpdateCommissionStatusBody) {
    return this.service.updateStatus(id, body.status);
  }
}
