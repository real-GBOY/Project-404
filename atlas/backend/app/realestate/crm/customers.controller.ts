import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { CustomersService } from "./customers-service.js";
import {
  createCustomerSchema,
  updateCustomerSchema,
  type CreateCustomerBody,
  type UpdateCustomerBody,
} from "./customers.schema.js";

@ApiTags("realestate · customers")
@ApiBearerAuth("access-token")
@Controller("realestate/customers")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  @RequirePermission("read", "customer")
  list() {
    return this.service.list();
  }

  @Get(":id")
  @RequirePermission("read", "customer")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "customer")
  create(@Body(ZodBody(createCustomerSchema)) body: CreateCustomerBody, @CurrentUser() user: Principal) {
    return this.service.create(body, user.userId);
  }

  @Patch(":id")
  @RequirePermission("update", "customer")
  update(
    @Param("id") id: string,
    @Body(ZodBody(updateCustomerSchema)) body: UpdateCustomerBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.update(id, body, user.userId);
  }
}
