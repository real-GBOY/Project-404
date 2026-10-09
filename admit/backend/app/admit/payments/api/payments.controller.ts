import { Body, Controller, Get, HttpCode, Param, Post, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { PaymentsService } from "../application/payments-service.js";
import { approveSchema, queueQuery, rejectSchema, type ApproveBody, type QueueQuery, type RejectBody } from "../validation/payments.schema.js";

@ApiTags("admit · payments")
@ApiBearerAuth("access-token")
@Controller("admit/payments")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get()
  @RequirePermission("read", "payment")
  async queue(@CurrentUser() who: Principal, @Query(ZodQuery(queueQuery)) q: QueueQuery) {
    return { items: await this.service.queue(who, q) };
  }

  @Get(":id")
  @RequirePermission("read", "payment")
  detail(@CurrentUser() who: Principal, @Param("id") id: string) {
    return this.service.detail(who, id);
  }

  /** The proof file. Streamed through the API so every view is permission-checked; never cached, never linked publicly. */
  @Get(":id/proof")
  @RequirePermission("read", "payment")
  async proof(@CurrentUser() who: Principal, @Param("id") id: string, @Res({ passthrough: true }) reply: FastifyReply) {
    const f = await this.service.proof(who, id);
    reply.header("content-type", f.contentType);
    reply.header("content-disposition", `inline; filename="${encodeURIComponent(f.name)}"`);
    reply.header("cache-control", "private, no-store");
    reply.header("x-content-type-options", "nosniff");
    return new StreamableFile(f.content);
  }

  @Post(":id/claim")
  @HttpCode(200)
  @RequirePermission("read", "payment")
  claim(@CurrentUser() who: Principal, @Param("id") id: string) {
    return this.service.claim(who, id);
  }

  @Post(":id/release")
  @HttpCode(204)
  @RequirePermission("read", "payment")
  async release(@CurrentUser() who: Principal, @Param("id") id: string) {
    await this.service.release(who, id);
  }

  @Post(":id/approve")
  @HttpCode(200)
  @RequirePermission("approve", "payment")
  approve(@CurrentUser() who: Principal, @Param("id") id: string, @Body(ZodBody(approveSchema)) b: ApproveBody) {
    return this.service.approve(who, id, b);
  }

  @Post(":id/reject")
  @HttpCode(200)
  @RequirePermission("reject", "payment")
  reject(@CurrentUser() who: Principal, @Param("id") id: string, @Body(ZodBody(rejectSchema)) b: RejectBody) {
    return this.service.reject(who, id, b);
  }
}
