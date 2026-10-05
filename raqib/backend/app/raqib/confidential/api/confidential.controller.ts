import { Body, Controller, Get, Headers, HttpCode, Param, Post, Res, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { z } from "zod";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodBody } from "@core/http/zod.pipe.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { NoStoreInterceptor } from "./no-store.interceptor.js";
import { ConfidentialService } from "../application/confidential-service.js";

const submitSchema = z
  .object({
    kind: z.enum(["misconduct", "violation", "safety"]),
    subject: z.string().trim().min(3).max(200),
    body: z.string().trim().min(10).max(5000),
    place: z.string().trim().max(200).default(""),
    identity: z.enum(["named", "confidential", "anonymous"]),
    fileIds: z.array(z.string().min(1).max(80)).max(5).default([]),
  })
  .strict();
const enterSchema = z.object({ reason: z.string().min(1).max(40), ack: z.boolean() }).strict();
const respondSchema = z.object({ text: z.string().trim().min(2).max(3000), status: z.enum(["new", "under_review", "closed"]).optional() }).strict();
const statusSchema = z.object({ status: z.enum(["new", "under_review", "closed"]) }).strict();
const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();
const grantSchema = z
  .object({ userId: z.string().min(1).max(80), level: z.enum(["view", "respond"]), scope: z.enum(["all", "standard"]), reason: z.string().trim().min(3).max(500), expiresAt: z.string().min(10).max(40) })
  .strict();

const device = (ua: string | undefined): string | null => (ua ? ua.slice(0, 120) : null);

/**
 * The confidential area. No endpoint is guarded by a module permission: the service decides from the person's
 * explicit grant, their open session and (for management) the GM role. Responses carry no store headers.
 */
@ApiTags("raqib · confidential")
@ApiBearerAuth("access-token")
@Controller("raqib/confidential")
@UseGuards(JwtAuthGuard, AccessGuard)
@UseInterceptors(NoStoreInterceptor)
export class ConfidentialController {
  constructor(private readonly service: ConfidentialService) {}

  /** Anyone may report; the reporter's identity is stored apart (or not at all when anonymous). */
  @Post("reports")
  @HttpCode(201)
  @Allow()
  submit(@Body(ZodBody(submitSchema)) b: z.infer<typeof submitSchema>, @Caller() who: Access) {
    return this.service.submit(b, who);
  }

  /** The caller's own non-anonymous reports with their status and any response. */
  @Get("mine")
  @Allow()
  async mine(@Caller() who: Access) {
    return { items: await this.service.mine(who) };
  }

  @Get("access")
  @Allow()
  access(@Caller() who: Access) {
    return this.service.accessOf(who);
  }

  @Post("session")
  @HttpCode(200)
  @Allow()
  enter(@Body(ZodBody(enterSchema)) b: z.infer<typeof enterSchema>, @Headers("user-agent") ua: string | undefined, @Caller() who: Access) {
    return this.service.enter(b.reason, b.ack, device(ua), who);
  }

  @Post("session/exit")
  @HttpCode(204)
  @Allow()
  async exit(@Headers("user-agent") ua: string | undefined, @Caller() who: Access) {
    await this.service.exit(device(ua), who);
  }

  @Get("reports")
  @Allow()
  async list(@Headers("user-agent") ua: string | undefined, @Caller() who: Access) {
    return { items: await this.service.list(device(ua), who) };
  }

  @Get("reports/:id")
  @Allow()
  get(@Param("id") id: string, @Headers("user-agent") ua: string | undefined, @Caller() who: Access) {
    return this.service.get(id, device(ua), who);
  }

  @Post("reports/:id/respond")
  @HttpCode(200)
  @Allow()
  respond(@Param("id") id: string, @Body(ZodBody(respondSchema)) b: z.infer<typeof respondSchema>, @Headers("user-agent") ua: string | undefined, @Caller() who: Access) {
    return this.service.respond(id, b.text, b.status, device(ua), who);
  }

  @Post("reports/:id/status")
  @HttpCode(200)
  @Allow()
  status(@Param("id") id: string, @Body(ZodBody(statusSchema)) b: z.infer<typeof statusSchema>, @Headers("user-agent") ua: string | undefined, @Caller() who: Access) {
    return this.service.setStatus(id, b.status, device(ua), who);
  }

  @Post("reports/:id/reveal")
  @HttpCode(200)
  @Allow()
  reveal(@Param("id") id: string, @Body(ZodBody(reasonSchema)) b: z.infer<typeof reasonSchema>, @Headers("user-agent") ua: string | undefined, @Caller() who: Access) {
    return this.service.reveal(id, b.reason, device(ua), who);
  }

  @Get("reports/:id/files/:fileId")
  @Allow()
  async file(@Param("id") id: string, @Param("fileId") fileId: string, @Headers("user-agent") ua: string | undefined, @Caller() who: Access, @Res() reply: FastifyReply) {
    const f = await this.service.fileContent(id, fileId, device(ua), who);
    reply
      .header("Content-Type", f.mime)
      .header("Content-Disposition", `inline; filename="${encodeURIComponent(f.name)}"`)
      .header("Cache-Control", "private, no-store")
      .send(f.content);
  }

  // ── General Manager ────────────────────────────────────────────────────

  @Get("grants")
  @Allow()
  async grants(@Caller() who: Access) {
    return { items: await this.service.grants(who) };
  }

  @Get("grantees")
  @Allow()
  async grantees(@Caller() who: Access) {
    return { items: await this.service.grantees(who) };
  }

  @Post("grants")
  @HttpCode(201)
  @Allow()
  async issue(@Body(ZodBody(grantSchema)) b: z.infer<typeof grantSchema>, @Caller() who: Access) {
    await this.service.issueGrant(b, who);
    return { items: await this.service.grants(who) };
  }

  @Post("grants/:id/revoke")
  @HttpCode(200)
  @Allow()
  async revoke(@Param("id") id: string, @Body(ZodBody(reasonSchema)) b: z.infer<typeof reasonSchema>, @Caller() who: Access) {
    await this.service.revokeGrant(id, b.reason, who);
    return { items: await this.service.grants(who) };
  }

  @Get("log")
  @Allow()
  async log(@Caller() who: Access) {
    return { items: await this.service.log(who) };
  }
}
