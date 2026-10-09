import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { SurveysService } from "../application/surveys-service.js";

const l10n = (max: number) => z.object({ ar: z.string().trim().min(1).max(max), en: z.string().trim().min(1).max(max) }).strict();
const createSchema = z
  .object({
    title: l10n(160),
    intro: z
      .object({ ar: z.string().trim().max(1000), en: z.string().trim().max(1000) })
      .strict()
      .default({ ar: "", en: "" }),
    questions: z
      .array(z.object({ type: z.enum(["rating", "text"]), text: l10n(400) }).strict())
      .min(1)
      .max(30),
  })
  .strict();
const answerSchema = z
  .object({
    answers: z.record(z.string().max(20), z.union([z.string().max(2000), z.number()])),
    identity: z.enum(["named", "confidential", "anonymous"]).default("anonymous"),
  })
  .strict();
const personSchema = z.object({ userId: z.string().min(1).max(64) }).strict();

/**
 * Surveys. Reading the open surveys and answering one is for any signed-in person with a Raqib profile (a guard, in practice);
 * managing them is for the people the General Manager names, which the service checks. Answers are never returned here: they
 * go to the confidential area.
 */
@ApiTags("raqib · surveys")
@ApiBearerAuth("access-token")
@Controller("raqib/surveys")
@UseGuards(JwtAuthGuard, AccessGuard)
export class SurveysController {
  constructor(private readonly service: SurveysService) {}

  @Get()
  @Allow()
  list(@Caller() who: Access) {
    return this.service.list(who);
  }

  @Post()
  @HttpCode(201)
  @Allow()
  create(@Body(ZodBody(createSchema)) b: z.infer<typeof createSchema>, @Caller() who: Access) {
    return this.service.create(b, who);
  }

  @Post("managers")
  @HttpCode(204)
  @Allow()
  async name(@Body(ZodBody(personSchema)) b: z.infer<typeof personSchema>, @Caller() who: Access) {
    await this.service.designate(b.userId, who);
  }

  @Delete("managers/:userId")
  @HttpCode(204)
  @Allow()
  async unname(@Param("userId") userId: string, @Caller() who: Access) {
    await this.service.revoke(userId, who);
  }

  @Post(":id/publish")
  @HttpCode(200)
  @Allow()
  publish(@Param("id") id: string, @Caller() who: Access) {
    return this.service.publish(id, who);
  }

  @Post(":id/close")
  @HttpCode(200)
  @Allow()
  close(@Param("id") id: string, @Caller() who: Access) {
    return this.service.close(id, who);
  }

  @Post(":id/answers")
  @HttpCode(201)
  @Allow()
  answer(@Param("id") id: string, @Body(ZodBody(answerSchema)) b: z.infer<typeof answerSchema>, @Caller() who: Access) {
    return this.service.answer(id, b.answers, b.identity, who);
  }
}
