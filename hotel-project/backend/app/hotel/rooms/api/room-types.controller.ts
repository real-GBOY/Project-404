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
import { RoomTypesService } from "../application/room-types-service.js";
import {
  createRoomTypeSchema,
  listRoomTypesQuery,
  updateRoomTypeSchema,
  type CreateRoomTypeBody,
  type ListRoomTypesQuery,
  type UpdateRoomTypeBody,
} from "../validation/rooms.schema.js";

@ApiTags("hotel · rooms")
@ApiBearerAuth("access-token")
@Controller("hotel/room-types")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RoomTypesController {
  constructor(private readonly service: RoomTypesService) {}

  @Get()
  @RequirePermission("read", "room")
  async list(@Query(ZodQuery(listRoomTypesQuery)) q: ListRoomTypesQuery) {
    return { items: await this.service.list(q.includeArchived) };
  }

  @Get(":id")
  @RequirePermission("read", "room")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("manage", "room")
  create(
    @Body(ZodBody(createRoomTypeSchema)) body: CreateRoomTypeBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.create(body, user.userId);
  }

  @Patch(":id")
  @RequirePermission("manage", "room")
  update(
    @Param("id") id: string,
    @Body(ZodBody(updateRoomTypeSchema)) body: UpdateRoomTypeBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.update(id, body, user.userId);
  }

  @Post(":id/archive")
  @HttpCode(200)
  @RequirePermission("manage", "room")
  archive(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.archive(id, user.userId);
  }
}
