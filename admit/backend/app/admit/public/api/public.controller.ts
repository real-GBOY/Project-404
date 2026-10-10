import { Body, Controller, Get, Headers, HttpCode, Param, Post, Put, Query, Req, Res, StreamableFile } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import { AppError, NotFound, ValidationError } from "@core/kernel/errors.js";
import { CLOCK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import { Inject } from "@nestjs/common";
import { readAdmitConfig } from "@admit/config.js";
import { createBookingSchema, resendLinkSchema, type CreateBookingBody, type ResendLinkBody } from "@admit/admit/bookings/validation/bookings.schema.js";
import { proofPresignSchema, submitProofSchema, type ProofPresignBody, type SubmitProofBody } from "@admit/admit/payments/validation/payments.schema.js";
import { clientIp } from "../domain/client-ip.js";
import { RateLimiter, type RatePolicy } from "../infrastructure/rate-limiter.js";
import { PublicService } from "../application/public-service.js";

/** Per client address, per organizer. Generous for browsing, tight for anything that creates or guesses. */
export const PUBLIC_RATE_POLICIES = {
  read: { name: "public:read", limit: 120, windowSeconds: 60 },
  /** Every call that presents a booking secret: keeps guessing a ref + key impractical. */
  access: { name: "public:access", limit: 60, windowSeconds: 60 },
  book: { name: "public:book", limit: 8, windowSeconds: 600 },
  upload: { name: "public:upload", limit: 12, windowSeconds: 600 },
  resend: { name: "public:resend", limit: 3, windowSeconds: 600 },
} satisfies Record<string, RatePolicy>;

const slugParam = z.string().regex(/^[a-z0-9-]{2,64}$/);
const refParam = z.string().regex(/^[A-Za-z0-9-]{6,20}$/);
const keyParam = z
  .string()
  .min(16)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);
const idParam = z.string().regex(/^[A-Za-z0-9_-]{3,64}$/);
const IDEM = /^[A-Za-z0-9_-]{16,100}$/;

const accessQuery = z.object({ k: keyParam });

/**
 * The customer API - no sign-in. Every route is rate-limited per client address (Postgres counters shared by all instances;
 * 429 + Retry-After when exceeded). Everything about a booking needs its magic-link secret `k`, not just its public ref.
 * Booking creation requires an `Idempotency-Key`, so a double-click or a retried request can never book twice.
 */
@ApiTags("public · admit")
@Controller("admit/public/:org")
export class PublicController {
  private readonly proxyHops = readAdmitConfig().trustedProxyHops;

  constructor(
    private readonly service: PublicService,
    private readonly limiter: RateLimiter,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get("events")
  async events(@Param("org") org: string, @Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.limit(PUBLIC_RATE_POLICIES.read, this.slug(org), req, reply);
    return this.service.listEvents(org, this.clock.now());
  }

  @Get("events/:event")
  async event(@Param("org") org: string, @Param("event") event: string, @Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.limit(PUBLIC_RATE_POLICIES.read, this.slug(org), req, reply);
    if (!slugParam.safeParse(event).success) throw NotFound("admit.event_not_found", "Event not found.");
    return this.service.eventDetail(org, event, this.clock.now());
  }

  @Post("events/:event/bookings")
  @HttpCode(201)
  async book(
    @Param("org") org: string,
    @Param("event") event: string,
    @Body(ZodBody(createBookingSchema)) body: CreateBookingBody,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    if (!key || !IDEM.test(key)) throw ValidationError("admit.idempotency_key_required", "Send an Idempotency-Key header (16-100 letters, digits, - or _).");
    await this.limit(PUBLIC_RATE_POLICIES.book, this.slug(org), req, reply);
    if (!slugParam.safeParse(event).success) throw NotFound("admit.event_not_found", "Event not found.");
    const out = await this.service.createBooking(org, event, body, key);
    if (!out.created) void reply.status(200); // a replayed request returns the original, not a second booking
    return out;
  }

  @Get("bookings/:ref")
  async booking(
    @Param("org") org: string,
    @Param("ref") ref: string,
    @Query(ZodQuery(accessQuery)) q: z.infer<typeof accessQuery>,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.limit(PUBLIC_RATE_POLICIES.access, this.slug(org), req, reply);
    return this.service.booking(org, this.ref(ref), q.k);
  }

  @Post("bookings/:ref/cancel")
  @HttpCode(200)
  async cancel(
    @Param("org") org: string,
    @Param("ref") ref: string,
    @Query(ZodQuery(accessQuery)) q: z.infer<typeof accessQuery>,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.limit(PUBLIC_RATE_POLICIES.access, this.slug(org), req, reply);
    return this.service.cancel(org, this.ref(ref), q.k);
  }

  @Post("bookings/:ref/proof/presign")
  @HttpCode(201)
  async presign(
    @Param("org") org: string,
    @Param("ref") ref: string,
    @Query(ZodQuery(accessQuery)) q: z.infer<typeof accessQuery>,
    @Body(ZodBody(proofPresignSchema)) body: ProofPresignBody,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.limit(PUBLIC_RATE_POLICIES.upload, this.slug(org), req, reply);
    return this.service.presign(org, this.ref(ref), q.k, body);
  }

  /** Local storage driver only; with R2 the browser PUTs straight to the presigned bucket URL. */
  @Put("bookings/:ref/proof/:fileId/bytes")
  @HttpCode(204)
  async putBytes(
    @Param("org") org: string,
    @Param("ref") ref: string,
    @Param("fileId") fileId: string,
    @Query(ZodQuery(accessQuery)) q: z.infer<typeof accessQuery>,
    @Body() content: Buffer,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.limit(PUBLIC_RATE_POLICIES.upload, this.slug(org), req, reply);
    if (!Buffer.isBuffer(content) || !content.length) throw ValidationError("admit.empty_upload", "The uploaded file is empty.");
    if (!idParam.safeParse(fileId).success) throw NotFound("admit.file_not_found", "That upload was not found for this booking.");
    await this.service.putBytes(org, this.ref(ref), q.k, fileId, content);
  }

  @Post("bookings/:ref/proof")
  @HttpCode(201)
  async submit(
    @Param("org") org: string,
    @Param("ref") ref: string,
    @Query(ZodQuery(accessQuery)) q: z.infer<typeof accessQuery>,
    @Body(ZodBody(submitProofSchema)) body: SubmitProofBody,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.limit(PUBLIC_RATE_POLICIES.upload, this.slug(org), req, reply);
    return this.service.submitProof(org, this.ref(ref), q.k, body);
  }

  @Get("bookings/:ref/tickets")
  async tickets(
    @Param("org") org: string,
    @Param("ref") ref: string,
    @Query(ZodQuery(accessQuery)) q: z.infer<typeof accessQuery>,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.limit(PUBLIC_RATE_POLICIES.access, this.slug(org), req, reply);
    return this.service.ticketsFor(org, this.ref(ref), q.k);
  }

  @Get("bookings/:ref/tickets/:ticketId/qr.png")
  async qr(
    @Param("org") org: string,
    @Param("ref") ref: string,
    @Param("ticketId") ticketId: string,
    @Query(ZodQuery(accessQuery)) q: z.infer<typeof accessQuery>,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.limit(PUBLIC_RATE_POLICIES.access, this.slug(org), req, reply);
    if (!idParam.safeParse(ticketId).success) throw NotFound("admit.ticket_not_found", "Ticket not found.");
    const png = await this.service.qr(org, this.ref(ref), q.k, ticketId);
    reply.header("content-type", "image/png");
    reply.header("cache-control", "private, max-age=300");
    reply.header("x-content-type-options", "nosniff");
    return new StreamableFile(png);
  }

  /** Always answers 202 with the same body, whether or not the ref and email match a booking. */
  @Post("links/resend")
  @HttpCode(202)
  async resend(
    @Param("org") org: string,
    @Body(ZodBody(resendLinkSchema)) body: ResendLinkBody,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.limit(PUBLIC_RATE_POLICIES.resend, this.slug(org), req, reply);
    if (refParam.safeParse(body.ref).success) await this.service.resendLink(org, body.ref, body.email, randomUUID());
    return { accepted: true };
  }

  private slug(slug: string): string {
    if (!slugParam.safeParse(slug).success) throw NotFound("admit.organizer_not_found", "Organizer not found.");
    return slug;
  }
  private ref(ref: string): string {
    if (!refParam.safeParse(ref).success) throw NotFound("admit.booking_not_found", "We couldn't find that booking.");
    return ref;
  }

  private async limit(policy: RatePolicy, slug: string, req: FastifyRequest, reply: FastifyReply) {
    const ip = clientIp(req.ip, req.headers["x-forwarded-for"], this.proxyHops);
    const decision = await this.limiter.hit(policy, `${slug}:${ip}`);
    void reply.header("X-RateLimit-Limit", String(policy.limit));
    void reply.header("X-RateLimit-Remaining", String(decision.remaining));
    if (!decision.allowed) {
      void reply.header("Retry-After", String(decision.retryAfterSeconds));
      throw new AppError({
        code: "rate_limited",
        message: "Too many requests - please wait a moment and try again.",
        kind: "rate_limited",
        details: { retryAfterSeconds: decision.retryAfterSeconds },
      });
    }
  }
}
