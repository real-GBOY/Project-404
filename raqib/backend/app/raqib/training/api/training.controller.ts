import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { GuardHistoryService } from "../application/guard-history-service.js";
import { TrainingService } from "../application/training-service.js";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const createSchema = z
  .object({
    guardId: z.string().min(1).max(80),
    reason: z.enum(["low_score", "repeat_issue", "incident", "refresher", "new_assignment"]),
    course: z.string().trim().min(2).max(200),
    related: z.string().trim().max(200).default(""),
    priority: z.enum(["low", "medium", "high"]),
    notes: z.string().trim().max(2000).default(""),
  })
  .strict();
const reasonSchema = z.object({ reason: z.string().trim().min(3).max(1000) }).strict();
const noteSchema = z.object({ comment: z.string().trim().max(1000).optional() }).strict();
const resubmitSchema = z.object({ notes: z.string().trim().max(2000).default("") }).strict();
const scheduleSchema = z.object({ date, provider: z.enum(["internal", "academy", "external"]) }).strict();
const completeSchema = z.object({ date, result: z.enum(["passed", "attended", "failed"]), note: z.string().trim().max(1000).optional() }).strict();

@ApiTags("raqib · training")
@ApiBearerAuth("access-token")
@Controller("raqib")
@UseGuards(JwtAuthGuard, AccessGuard)
export class TrainingController {
  constructor(
    private readonly service: TrainingService,
    private readonly history: GuardHistoryService,
  ) {}

  @Get("training")
  @Allow("training", "V")
  async list(@Query("guardId") guardId: string | undefined, @Caller() who: Access) {
    return { items: await this.service.list(who, guardId) };
  }

  @Get("training/:id")
  @Allow("training", "V")
  get(@Param("id") id: string, @Caller() who: Access) {
    return this.service.get(id, who);
  }

  @Post("training")
  @HttpCode(201)
  @Allow("training", "A")
  create(@Body(ZodBody(createSchema)) b: z.infer<typeof createSchema>, @Caller() who: Access) {
    return this.service.create(b, who);
  }

  @Post("training/:id/approve")
  @HttpCode(200)
  @Allow("training", "P")
  approve(@Param("id") id: string, @Body(ZodBody(noteSchema)) b: z.infer<typeof noteSchema>, @Caller() who: Access) {
    return this.service.step(id, "approve", { text: b.comment }, who);
  }

  @Post("training/:id/return")
  @HttpCode(200)
  @Allow("training", "P")
  return(@Param("id") id: string, @Body(ZodBody(reasonSchema)) b: z.infer<typeof reasonSchema>, @Caller() who: Access) {
    return this.service.step(id, "return", { text: b.reason }, who);
  }

  @Post("training/:id/reject")
  @HttpCode(200)
  @Allow("training", "P")
  reject(@Param("id") id: string, @Body(ZodBody(reasonSchema)) b: z.infer<typeof reasonSchema>, @Caller() who: Access) {
    return this.service.step(id, "reject", { text: b.reason }, who);
  }

  @Post("training/:id/resubmit")
  @HttpCode(200)
  @Allow("training", "E")
  resubmit(@Param("id") id: string, @Body(ZodBody(resubmitSchema)) b: z.infer<typeof resubmitSchema>, @Caller() who: Access) {
    return this.service.step(id, "resubmit", { notes: b.notes }, who);
  }

  @Post("training/:id/schedule")
  @HttpCode(200)
  @Allow("training", "R")
  schedule(@Param("id") id: string, @Body(ZodBody(scheduleSchema)) b: z.infer<typeof scheduleSchema>, @Caller() who: Access) {
    return this.service.step(id, "schedule", b, who);
  }

  @Post("training/:id/complete")
  @HttpCode(200)
  @Allow("training", "R")
  complete(@Param("id") id: string, @Body(ZodBody(completeSchema)) b: z.infer<typeof completeSchema>, @Caller() who: Access) {
    return this.service.step(id, "complete", { date: b.date, result: b.result, text: b.note }, who);
  }

  @Get("guards-summary")
  @Allow()
  async guardSummary(@Caller() who: Access) {
    return { items: await this.history.summaries(who) };
  }

  /** A guard's record: evaluations from issued reports and their training. */
  @Get("guards/:id/history")
  @Allow()
  guardHistory(@Param("id") id: string, @Caller() who: Access) {
    return this.history.of(id, who);
  }
}
