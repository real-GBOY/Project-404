import { randomUUID } from "node:crypto";
import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { enterContext, patchContext } from "@core/kernel/logging/context.js";
import { CONFIG } from "@core/kernel/tokens.js";
import type { AuricConfig } from "@core/kernel/config.js";
import { directionOf, negotiateLocale } from "@core/localization/domain/locale.js";

const CORRELATION_HEADER = "x-correlation-id";

/**
 * Runs before guards and controllers. Binds the ambient request context
 * (correlation id — every downstream log/audit/outbox row carries it) and
 * resolves the locale from `?locale` → `Accept-Language` → default, setting
 * `Content-Language` + `X-Content-Direction`.
 *
 * Replaces the old Fastify `onRequest` correlation hook + `localeHook`.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(@Inject(CONFIG) private readonly config: AuricConfig) {}

  use(req: FastifyRequest["raw"] & Partial<FastifyRequest>, res: FastifyReply["raw"], next: () => void): void {
    const inbound = req.headers?.[CORRELATION_HEADER];
    const correlationId =
      (Array.isArray(inbound) ? inbound[0] : inbound)?.trim() || randomUUID();
    enterContext({ correlationId });
    res.setHeader(CORRELATION_HEADER, correlationId);

    const url = new URL(req.url ?? "/", "http://localhost");
    const queryLocale = url.searchParams.get("locale");
    const headerLocales = String(req.headers?.["accept-language"] ?? "")
      .split(",")
      .map((part) => part.split(";")[0]?.trim())
      .filter((x): x is string => Boolean(x));

    const locale = negotiateLocale(
      [queryLocale, ...headerLocales],
      this.config.supportedLocales,
      this.config.defaultLocale,
    );
    patchContext({ locale });
    (req as Partial<FastifyRequest>).locale = locale;
    res.setHeader("Content-Language", locale);
    res.setHeader("X-Content-Direction", directionOf(locale));

    next();
  }
}
