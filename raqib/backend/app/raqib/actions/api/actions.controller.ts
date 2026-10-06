import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { ActionsService } from "../application/actions-service.js";
import { parsePage, toPage } from "@raqib/raqib/shared/paging.js";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const createSchema = z
  .object({
    responsibleId: z.string().min(1).max(80),
    dueDate: date,
    priority: z.enum(["low", "medium", "high"]),
    description: z.string().trim().max(2000).default(""),
  })
  .strict();
const commentSchema = z.object({ text: z.string().trim().min(1).max(1000) }).strict();
const returnSchema = z.object({ reason: z.string().trim().min(3).max(1000) }).strict();
const reassignSchema = z
  .object({ responsibleId: z.string().min(1).max(60).optional(), dueDate: date.optional(), reason: z.string().trim().min(3).max(1000) })
  .strict();
const closeSchema = z.object({ comment: z.string().trim().max(1000).optional() }).strict();

@ApiTags("raqib · corrective actions")
@ApiBearerAuth("access-token")
@Controller("raqib")
@UseGuards(JwtAuthGuard, AccessGuard)
export class ActionsController {
  constructor(private readonly service: ActionsService) {}

  @Get("actions")
  @Allow("actions", "V")
  async list(@Query() q: { limit?: string; cursor?: string }, @Caller() who: Access) {
    const page = parsePage(q);
    return toPage(await this.service.list(who, page), page);
  }

  @Get("actions/responsible")
  @Allow("actions", "A")
  async responsible(@Query("projectId") projectId: string | undefined, @Caller() who: Access) {
    return { items: await this.service.eligibleResponsible(who, projectId) };
  }

  @Get("actions/:id")
  @Allow("actions", "V")
  get(@Param("id") id: string, @Caller() who: Access) {
    return this.service.get(id, who);
  }

  /** Create the corrective action for an observation and assign it. */
  @Post("observations/:observationId/action")
  @HttpCode(201)
  @Allow("actions", "A")
  create(@Param("observationId") observationId: string, @Body(ZodBody(createSchema)) b: z.infer<typeof createSchema>, @Caller() who: Access) {
    return this.service.create(observationId, b, who);
  }

  @Post("actions/:id/start")
  @HttpCode(200)
  @Allow("actions", "S")
  start(@Param("id") id: string, @Caller() who: Access) {
    return this.service.step(id, "start", {}, who);
  }

  /** Hand the work to quality review. Needs closure evidence. */
  @Post("actions/:id/submit")
  @HttpCode(200)
  @Allow("actions", "S")
  submit(@Param("id") id: string, @Caller() who: Access) {
    return this.service.step(id, "submit", {}, who);
  }

  @Post("actions/:id/return")
  @HttpCode(200)
  @Allow("actions", "R")
  return(@Param("id") id: string, @Body(ZodBody(returnSchema)) b: z.infer<typeof returnSchema>, @Caller() who: Access) {
    return this.service.step(id, "return", { text: b.reason }, who);
  }

  /** Close the action — the approve right, separate from review. */
  @Post("actions/:id/close")
  @HttpCode(200)
  @Allow("actions", "P")
  close(@Param("id") id: string, @Body(ZodBody(closeSchema)) b: z.infer<typeof closeSchema>, @Caller() who: Access) {
    return this.service.step(id, "close", { text: b.comment }, who);
  }

  /** Move an open action to another responsible person and/or a new due date, with a reason. */
  @Post("actions/:id/reassign")
  @HttpCode(200)
  @Allow("actions", "A")
  reassign(@Param("id") id: string, @Body(ZodBody(reassignSchema)) b: z.infer<typeof reassignSchema>, @Caller() who: Access) {
    return this.service.reassign(id, b, who);
  }

  @Post("actions/:id/comments")
  @HttpCode(201)
  @Allow("actions", "V")
  comment(@Param("id") id: string, @Body(ZodBody(commentSchema)) b: z.infer<typeof commentSchema>, @Caller() who: Access) {
    return this.service.comment(id, b.text, who);
  }
}
