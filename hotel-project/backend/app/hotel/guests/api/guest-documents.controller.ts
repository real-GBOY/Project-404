import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { GuestDocumentsService } from "../application/guest-documents-service.js";

const attachSchema = z
  .object({
    fileId: z.string().min(1),
    kind: z.enum(["id_document", "other"]),
    label: z.string().trim().max(120).nullable().default(null),
  })
  .strict();

@ApiTags("hotel · guests")
@ApiBearerAuth("access-token")
@Controller("hotel/guests/:guestId/documents")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class GuestDocumentsController {
  constructor(private readonly service: GuestDocumentsService) {}

  @Get()
  @RequirePermission("read", "guest")
  async list(@Param("guestId") guestId: string) {
    return { items: await this.service.list(guestId) };
  }

  /** Attach a file already uploaded through Core (`/api/files/uploads` → PUT → confirm). */
  @Post()
  @HttpCode(201)
  @RequirePermission("update", "guest")
  attach(
    @Param("guestId") guestId: string,
    @Body(ZodBody(attachSchema)) body: z.infer<typeof attachSchema>,
    @CurrentUser() user: Principal,
  ) {
    return this.service.attach(guestId, body, user.userId);
  }

  @Delete(":documentId")
  @HttpCode(200)
  @RequirePermission("update", "guest")
  remove(
    @Param("guestId") guestId: string,
    @Param("documentId") documentId: string,
    @CurrentUser() user: Principal,
  ) {
    return this.service.remove(guestId, documentId, user.userId);
  }
}
