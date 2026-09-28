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
import { RoomsService } from "../application/rooms-service.js";
import type { HousekeepingStatus, ServiceStatus } from "../domain/room-status.js";
import {
  createRoomSchema,
  listRoomsQuery,
  updateRoomSchema,
  type CreateRoomBody,
  type ListRoomsQuery,
  type UpdateRoomBody,
} from "../validation/rooms.schema.js";

@ApiTags("hotel · rooms")
@ApiBearerAuth("access-token")
@Controller("hotel/rooms")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RoomsController {
  constructor(private readonly service: RoomsService) {}

  @Get()
  @RequirePermission("read", "room")
  async list(@Query(ZodQuery(listRoomsQuery)) q: ListRoomsQuery) {
    return {
      items: await this.service.list({
        ...q,
        housekeepingStatus: q.housekeepingStatus as HousekeepingStatus | undefined,
        serviceStatus: q.serviceStatus as ServiceStatus | undefined,
      }),
    };
  }

  @Get(":id")
  @RequirePermission("read", "room")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("manage", "room")
  create(@Body(ZodBody(createRoomSchema)) body: CreateRoomBody, @CurrentUser() user: Principal) {
    return this.service.create(body, user.userId);
  }

  @Patch(":id")
  @RequirePermission("manage", "room")
  update(
    @Param("id") id: string,
    @Body(ZodBody(updateRoomSchema)) body: UpdateRoomBody,
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
