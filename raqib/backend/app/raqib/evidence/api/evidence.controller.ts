import { Body, Controller, Delete, Get, HttpCode, Param, Post, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { z } from "zod";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { EvidenceService } from "../application/evidence-service.js";

const attachSchema = z
  .object({
    fileId: z.string().min(1).max(80),
    inspectionId: z.string().min(1).max(80).optional(),
    actionId: z.string().min(1).max(80).optional(),
    itemId: z.string().min(1).max(80).nullish(),
    guardId: z.string().min(1).max(80).nullish(),
  })
  .strict()
  .refine((b) => !!b.inspectionId !== !!b.actionId, { message: "Give either inspectionId or actionId." });
type AttachBody = z.infer<typeof attachSchema>;

@ApiTags("raqib · evidence")
@ApiBearerAuth("access-token")
@Controller("raqib/evidence")
@UseGuards(JwtAuthGuard, AccessGuard)
export class EvidenceController {
  constructor(private readonly service: EvidenceService) {}

  /** Link a confirmed, privately-stored upload to an inspection item (or a guard evaluation). */
  @Post()
  @HttpCode(201)
  @Allow()
  async attach(@Body(ZodBody(attachSchema)) b: AttachBody, @Caller() who: Access) {
    const e = b.actionId
      ? await this.service.attachToAction({ fileId: b.fileId, actionId: b.actionId }, who)
      : await this.service.attach({ ...b, inspectionId: b.inspectionId! }, who);
    return { id: e.id, name: e.name, kind: e.kind, mime: e.mime, sizeBytes: e.sizeBytes, at: e.uploadedAt.toISOString(), by: null };
  }

  @Delete(":id")
  @HttpCode(204)
  @Allow()
  async remove(@Param("id") id: string, @Caller() who: Access) {
    await this.service.remove(id, who);
  }

  /** The evidence bytes — authorized against the record the evidence belongs to, and audited. */
  @Get(":id/content")
  @Allow()
  async content(@Param("id") id: string, @Caller() who: Access, @Res() reply: FastifyReply) {
    const f = await this.service.content(id, who);
    reply
      .header("Content-Type", f.mime)
      .header("Content-Disposition", `inline; filename="${encodeURIComponent(f.name)}"`)
      .header("Cache-Control", "private, no-store")
      .send(f.content);
  }
}
