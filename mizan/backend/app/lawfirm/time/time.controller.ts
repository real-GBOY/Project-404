import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { TimeService } from "./time-service.js";

const status = z.enum(["unbilled", "billed"]);
const listQuery = z.object({
  mine: z.coerce.boolean().optional(),
  matterId: z.string().optional(),
  status: status.optional(),
});
const summaryQuery = z.object({ mine: z.coerce.boolean().optional() });
const createSchema = z.object({
  matterId: z.string().min(1),
  activity: z.string().trim().min(1).max(200),
  narrative: z.string().trim().max(4000).nullish(),
  minutes: z.number().int().positive().max(24 * 60),
  billable: z.boolean().optional(),
  loggedAt: z.string().nullish(),
});
const updateSchema = z.object({
  activity: z.string().trim().min(1).max(200).optional(),
  narrative: z.string().trim().max(4000).nullish(),
  minutes: z
    .number()
    .int()
    .positive()
    .max(24 * 60)
    .optional(),
  billable: z.boolean().optional(),
  loggedAt: z.string().nullish(),
});

@ApiTags("lawfirm · time entries")
@ApiBearerAuth("access-token")
@Controller("time-entries")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TimeController {
  constructor(private readonly service: TimeService) {}

  @Get("summary")
  @RequirePermission("read", "time_entry")
  summary(
    @Query(ZodQuery(summaryQuery)) q: z.infer<typeof summaryQuery>,
    @CurrentUser() user: Principal,
  ) {
    return this.service.summary({ mine: q.mine, actorId: user.userId });
  }

  @Get()
  @RequirePermission("read", "time_entry")
  list(@Query(ZodQuery(listQuery)) q: z.infer<typeof listQuery>, @CurrentUser() user: Principal) {
    return this.service.list({ ...q, actorId: user.userId });
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "time_entry")
  create(
    @Body(ZodBody(createSchema)) body: z.infer<typeof createSchema>,
    @CurrentUser() user: Principal,
  ) {
    return this.service.create(body, user.userId);
  }

  @Patch(":id")
  @RequirePermission("update", "time_entry")
  update(
    @Param("id") id: string,
    @Body(ZodBody(updateSchema)) body: z.infer<typeof updateSchema>,
  ) {
    return this.service.update(id, body);
  }

  @Delete(":id")
  @RequirePermission("delete", "time_entry")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
