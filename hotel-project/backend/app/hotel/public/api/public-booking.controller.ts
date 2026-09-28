import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import { AppError, ValidationError } from "@core/kernel/errors.js";
import { readHotelConfig } from "@hotel/config.js";
import { isoDate } from "@hotel/hotel/pricing/validation/pricing.schema.js";
import { clientIp } from "../domain/client-ip.js";
import { RateLimiter, type RatePolicy } from "../infrastructure/rate-limiter.js";
import { PublicBookingService } from "../application/public-booking-service.js";

/** Per client address, per hotel. Generous for browsing, tight for making bookings. */
export const PUBLIC_RATE_POLICIES = {
  read: { name: "public:read", limit: 120, windowSeconds: 60 },
  search: { name: "public:search", limit: 60, windowSeconds: 60 },
  book: { name: "public:book", limit: 5, windowSeconds: 600 },
} satisfies Record<string, RatePolicy>;

const slugParam = z.string().regex(/^[a-z0-9-]{2,64}$/);

const searchQuery = z
  .object({
    arrival: isoDate,
    departure: isoDate,
    adults: z.coerce.number().int().min(1).max(8).default(2),
    children: z.coerce.number().int().min(0).max(6).default(0),
    discountCode: z.string().trim().toUpperCase().max(20).optional(),
  })
  .refine((q) => q.departure > q.arrival, {
    message: "Departure must be after arrival",
    path: ["departure"],
  });

const bookingSchema = z
  .object({
    roomTypeId: z.string().min(1).max(64),
    arrival: isoDate,
    departure: isoDate,
    adults: z.number().int().min(1).max(8),
    children: z.number().int().min(0).max(6).default(0),
    discountCode: z.string().trim().toUpperCase().max(20).nullish(),
    notes: z.string().trim().max(500).nullish(),
    guest: z
      .object({
        fullName: z.string().trim().min(2).max(120),
        email: z.string().trim().toLowerCase().email().max(200),
        phone: z.string().trim().max(40).nullish(),
        nationality: z.string().trim().length(2).toUpperCase().nullish(),
      })
      .strict(),
  })
  .strict()
  .refine((b) => b.departure > b.arrival, {
    message: "Departure must be after arrival",
    path: ["departure"],
  });

const KEY = /^[A-Za-z0-9_-]{16,100}$/;

/**
 * The public booking API for the hotel's own website — no sign-in. Every route is rate-limited
 * per client address (Postgres counters shared by all instances; 429 + Retry-After when
 * exceeded) and booking requires an `Idempotency-Key`, so a double-click or a retried request
 * can never book twice.
 */
@ApiTags("public · booking")
@Controller("public/hotels/:slug")
export class PublicBookingController {
  private readonly proxyHops = readHotelConfig().trustedProxyHops;

  constructor(
    private readonly service: PublicBookingService,
    private readonly limiter: RateLimiter,
  ) {}

  @Get()
  async hotel(
    @Param("slug") slug: string,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.limit(PUBLIC_RATE_POLICIES.read, this.slug(slug), req, reply);
    return this.service.hotel(slug);
  }

  @Get("availability")
  async availability(
    @Param("slug") slug: string,
    @Query(ZodQuery(searchQuery)) q: z.infer<typeof searchQuery>,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.limit(PUBLIC_RATE_POLICIES.search, this.slug(slug), req, reply);
    return this.service.search(slug, { ...q, discountCode: q.discountCode ?? null });
  }

  @Post("bookings")
  @HttpCode(201)
  async book(
    @Param("slug") slug: string,
    @Body(ZodBody(bookingSchema)) body: z.infer<typeof bookingSchema>,
    @Headers("idempotency-key") key: string | undefined,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    if (!key || !KEY.test(key)) {
      throw ValidationError(
        "booking.idempotency_key_required",
        "Send an Idempotency-Key header (16–100 letters, digits, - or _).",
      );
    }
    await this.limit(PUBLIC_RATE_POLICIES.book, this.slug(slug), req, reply);
    return this.service.book(
      slug,
      {
        ...body,
        discountCode: body.discountCode ?? null,
        notes: body.notes ?? null,
        guest: {
          fullName: body.guest.fullName,
          email: body.guest.email,
          phone: body.guest.phone ?? null,
          nationality: body.guest.nationality ?? null,
        },
      },
      key,
    );
  }

  private slug(slug: string): string {
    if (!slugParam.safeParse(slug).success) {
      throw new AppError({
        code: "hotel.not_found",
        message: "Hotel not found.",
        kind: "not_found",
      });
    }
    return slug;
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
        message: "Too many requests — please wait a moment and try again.",
        kind: "rate_limited",
        details: { retryAfterSeconds: decision.retryAfterSeconds },
      });
    }
  }
}
