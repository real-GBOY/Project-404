import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { ContractsService } from "./contracts-service.js";
import { createContractSchema, type CreateContractBody } from "./contracts.schema.js";
import type { ContractStatus } from "./contracts-repository.js";

@ApiTags("realestate · contracts")
@ApiBearerAuth("access-token")
@Controller("realestate/contracts")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Get()
  @RequirePermission("read", "contract")
  list(@Query("status") status?: ContractStatus) {
    return this.service.list(status);
  }

  @Get(":id")
  @RequirePermission("read", "contract")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "contract")
  create(@Body(ZodBody(createContractSchema)) body: CreateContractBody, @CurrentUser() user: Principal) {
    return this.service.create(body, user.userId);
  }

  @Post(":id/sign")
  @RequirePermission("sign", "contract")
  sign(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.sign(id, user.userId);
  }
}
