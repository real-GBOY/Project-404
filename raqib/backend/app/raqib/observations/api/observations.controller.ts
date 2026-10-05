import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { ObservationsService } from "../application/observations-service.js";

const createSchema = z
  .object({
    projectId: z.string().min(1).max(80),
    siteId: z.string().min(1).max(80),
    text: z.string().trim().min(3).max(500),
    note: z.string().trim().max(2000).default(""),
    severity: z.enum(["low", "medium", "high"]),
  })
  .strict();

@ApiTags("raqib · observations")
@ApiBearerAuth("access-token")
@Controller("raqib/observations")
@UseGuards(JwtAuthGuard, AccessGuard)
export class ObservationsController {
  constructor(private readonly service: ObservationsService) {}

  @Get()
  @Allow("observations", "V")
  async list(@Caller() who: Access) {
    return { items: await this.service.list(who) };
  }

  @Get(":id")
  @Allow("observations", "V")
  get(@Param("id") id: string, @Caller() who: Access) {
    return this.service.get(id, who);
  }

  /** Report an observation directly (outside a scored inspection item). */
  @Post()
  @HttpCode(201)
  @Allow("observations", "A")
  create(@Body(ZodBody(createSchema)) b: z.infer<typeof createSchema>, @Caller() who: Access) {
    return this.service.create(b, who);
  }
}
