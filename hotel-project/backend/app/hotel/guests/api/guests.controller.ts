import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { GuestsService } from "../application/guests-service.js";
import {
  addNoteSchema,
  createGuestSchema,
  listGuestsQuery,
  updateGuestSchema,
  type AddNoteBody,
  type CreateGuestBody,
  type ListGuestsQuery,
  type UpdateGuestBody,
} from "../validation/guests.schema.js";

@ApiTags("hotel · guests")
@ApiBearerAuth("access-token")
@Controller("hotel/guests")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class GuestsController {
  constructor(private readonly service: GuestsService) {}

  @Get()
  @RequirePermission("read", "guest")
  list(@Query(ZodQuery(listGuestsQuery)) q: ListGuestsQuery) {
    return this.service.search(q);
  }

  @Get(":id")
  @RequirePermission("read", "guest")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "guest")
  create(@Body(ZodBody(createGuestSchema)) body: CreateGuestBody, @CurrentUser() user: Principal) {
    return this.service.create(body, user.userId);
  }

  @Patch(":id")
  @RequirePermission("update", "guest")
  update(
    @Param("id") id: string,
    @Body(ZodBody(updateGuestSchema)) body: UpdateGuestBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.update(id, body, user.userId);
  }

  @Post(":id/notes")
  @HttpCode(201)
  @RequirePermission("update", "guest")
  addNote(
    @Param("id") id: string,
    @Body(ZodBody(addNoteSchema)) body: AddNoteBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.addNote(id, body.body, user.userId);
  }
}
