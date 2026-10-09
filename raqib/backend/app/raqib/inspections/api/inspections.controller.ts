import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { InspectionsService } from "../application/inspections-service.js";
import { answerSchema, guardNoteSchema, guardScoreSchema, type AnswerBody, type GuardNoteBody, type GuardScoreBody } from "../validation/inspections.schema.js";

@ApiTags("raqib · inspections")
@ApiBearerAuth("access-token")
@Controller("raqib/visits/:visitId/inspection")
@UseGuards(JwtAuthGuard, AccessGuard)
export class InspectionsController {
  constructor(private readonly service: InspectionsService) {}

  @Get()
  @Allow("inspections", "V")
  get(@Param("visitId") visitId: string, @Query("formId") formId: string | undefined, @Caller() who: Access) {
    return this.service.get(visitId, who, formId);
  }

  /** The forms this visit requires and how far each has got. */
  @Get("forms")
  @Allow("visits", "V")
  async forms(@Param("visitId") visitId: string, @Caller() who: Access) {
    return { items: await this.service.formsOf(visitId, who) };
  }

  @Post("start")
  @HttpCode(200)
  @Allow("inspections", "S")
  start(@Param("visitId") visitId: string, @Query("formId") formId: string | undefined, @Caller() who: Access) {
    return this.service.start(visitId, who, formId);
  }

  @Put("answers/:itemId")
  @Allow("inspections", "S")
  answer(@Param("visitId") visitId: string, @Param("itemId") itemId: string, @Body(ZodBody(answerSchema)) b: AnswerBody, @Caller() who: Access) {
    return this.service.saveAnswer(visitId, itemId, b, who);
  }

  @Put("guards/:guardId/scores/:itemId")
  @Allow("guardEval", "S")
  guardScore(
    @Param("visitId") visitId: string,
    @Param("guardId") guardId: string,
    @Param("itemId") itemId: string,
    @Body(ZodBody(guardScoreSchema)) b: GuardScoreBody,
    @Caller() who: Access,
  ) {
    return this.service.setGuardScore(visitId, guardId, itemId, b.score, who);
  }

  @Put("guards/:guardId/note")
  @Allow("guardEval", "S")
  guardNote(@Param("visitId") visitId: string, @Param("guardId") guardId: string, @Body(ZodBody(guardNoteSchema)) b: GuardNoteBody, @Caller() who: Access) {
    return this.service.setGuardNote(visitId, guardId, b.note, who);
  }

  @Post("submit")
  @HttpCode(200)
  @Allow("inspections", "S")
  submit(@Param("visitId") visitId: string, @Caller() who: Access) {
    return this.service.submit(visitId, who);
  }
}
