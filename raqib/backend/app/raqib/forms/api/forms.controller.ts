import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { FormsService } from "../application/forms-service.js";
import {
  activeSchema,
  createFormSchema,
  reasonSchema,
  saveDraftSchema,
  updateFormSchema,
  type ActiveBody,
  type CreateFormBody,
  type ReasonBody,
  type SaveDraftBody,
  type UpdateFormBody,
} from "../validation/forms.schema.js";

@ApiTags("raqib · forms")
@ApiBearerAuth("access-token")
@Controller("raqib/forms")
@UseGuards(JwtAuthGuard, AccessGuard)
export class FormsController {
  constructor(private readonly service: FormsService) {}

  @Get()
  @Allow("forms", "V")
  async list(@Caller() who: Access) {
    return { items: await this.service.list(who), capabilities: this.service.capabilities(who) };
  }

  @Get(":id")
  @Allow("forms", "V")
  get(@Param("id") id: string, @Caller() who: Access) {
    return this.service.get(id, who);
  }

  @Post()
  @HttpCode(201)
  @Allow("forms", "A")
  create(@Body(ZodBody(createFormSchema)) b: CreateFormBody, @Caller() who: Access) {
    return this.service.create(b, who);
  }

  @Patch(":id")
  @Allow("forms", "E")
  update(@Param("id") id: string, @Body(ZodBody(updateFormSchema)) b: UpdateFormBody, @Caller() who: Access) {
    return this.service.updateMeta(id, b, who);
  }

  @Post(":id/versions")
  @HttpCode(201)
  @Allow("forms", "E")
  createDraft(@Param("id") id: string, @Caller() who: Access) {
    return this.service.createDraft(id, who);
  }

  @Put(":id/draft")
  @Allow("forms", "E")
  saveDraft(@Param("id") id: string, @Body(ZodBody(saveDraftSchema)) b: SaveDraftBody, @Caller() who: Access) {
    return this.service.saveDraft(id, b.sections, b.note, who);
  }

  @Delete(":id/draft")
  @Allow("forms", "E")
  discardDraft(@Param("id") id: string, @Caller() who: Access) {
    return this.service.discardDraft(id, who);
  }

  @Post(":id/publish")
  @HttpCode(200)
  @Allow("forms", "E")
  publish(@Param("id") id: string, @Body(ZodBody(reasonSchema)) b: ReasonBody, @Caller() who: Access) {
    return this.service.publish(id, b.reason, who);
  }

  @Post(":id/active")
  @HttpCode(200)
  @Allow("forms", "E")
  setActive(@Param("id") id: string, @Body(ZodBody(activeSchema)) b: ActiveBody, @Caller() who: Access) {
    return this.service.setActive(id, b.active, b.reason, who);
  }

  @Post(":id/default")
  @HttpCode(200)
  @Allow("forms", "P")
  setDefault(@Param("id") id: string, @Caller() who: Access) {
    return this.service.setDefault(id, who);
  }
}
