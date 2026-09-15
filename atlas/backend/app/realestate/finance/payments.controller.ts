import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { PaymentsService } from "./payments-service.js";
import {
  recordPaymentSchema,
  listPaymentsQuery,
  collectionsQuery,
  outstandingQuery,
  type RecordPaymentBody,
  type ListPaymentsQuery,
  type CollectionsQuery,
  type OutstandingQuery,
} from "./payments.schema.js";

@ApiTags("realestate · payments")
@ApiBearerAuth("access-token")
@Controller("realestate/payments")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get()
  @RequirePermission("read", "payment")
  list(@Query(ZodQuery(listPaymentsQuery)) q: ListPaymentsQuery) {
    return this.service.list(q);
  }

  @Get("collections")
  @RequirePermission("read", "payment")
  collections(@Query(ZodQuery(collectionsQuery)) q: CollectionsQuery) {
    return this.service.collections(q);
  }

  @Get("outstanding")
  @RequirePermission("read", "payment")
  outstanding(@Query(ZodQuery(outstandingQuery)) q: OutstandingQuery) {
    return this.service.outstanding(q);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("record", "payment")
  record(@Body(ZodBody(recordPaymentSchema)) body: RecordPaymentBody, @CurrentUser() user: Principal) {
    return this.service.record(body, user.userId);
  }
}
