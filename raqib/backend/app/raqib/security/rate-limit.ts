import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { AppError } from "@core/kernel/errors.js";
import { JWT_SERVICE } from "@core/kernel/tokens.js";
import type { JwtService } from "@core/identity/infrastructure/jwt-service.js";
import { readRaqibConfig } from "@raqib/config.js";

interface Rule {
  name: string;
  /** Path prefix (after /api) and optional method the rule applies to. */
  match: (method: string, path: string) => boolean;
  limit: number | (() => number);
  windowMs: number;
  /** Count per authenticated person when known, else per client address. */
  by: "ip" | "user";
}

/**
 * Per-bucket limits, tightest first. Sign-in and the public account request are limited per client address (they
 * are the guessable doors); confidential submissions per person (to blunt spam without identifying anyone beyond
 * the request itself); report downloads and uploads per person; everything else generously.
 */
export const RULES: Rule[] = [
  // Renewing a session needs a valid refresh token already, so it is not a guessable door: it gets its own roomy bucket instead of
  // sharing the sign-in one (a whole shift behind one office address must not be signed out because someone else is signing in).
  { name: "auth-refresh", match: (m, p) => m === "POST" && p === "/auth/refresh", limit: 300, windowMs: 60_000, by: "ip" },
  // The guessable doors. Per-account lock-out is the real brake on password guessing; this is the coarse per-address one, sized so
  // a shift starting at one site (many people, one public address) is not locked out.
  { name: "auth", match: (m, p) => m === "POST" && /^\/auth\/(login|password|forgot|reset|register)/.test(p), limit: 60, windowMs: 60_000, by: "ip" },
  {
    name: "account-request",
    match: (m, p) => m === "POST" && p.startsWith("/raqib/public/onboarding"),
    limit: () => readRaqibConfig().accountRequestsPerHour,
    windowMs: 3_600_000,
    by: "ip",
  },
  { name: "confidential-submit", match: (m, p) => m === "POST" && p === "/raqib/confidential/reports", limit: 5, windowMs: 3_600_000, by: "user" },
  { name: "confidential-session", match: (m, p) => m === "POST" && p === "/raqib/confidential/session", limit: 20, windowMs: 3_600_000, by: "user" },
  { name: "pdf", match: (m, p) => m === "GET" && /^\/raqib\/reports\/[^/]+\/html/.test(p), limit: 12, windowMs: 60_000, by: "user" },
  { name: "uploads", match: (m, p) => m === "POST" && p.startsWith("/files/uploads"), limit: 60, windowMs: 60_000, by: "user" },
  { name: "default", match: () => true, limit: 1200, windowMs: 60_000, by: "user" },
];

export interface Decision {
  allowed: boolean;
  retryAfterSec: number;
  rule: string;
}

/** Fixed-window counters in memory: one process serves a client, so this needs no shared store. */
export class RateLimiter {
  private readonly hits = new Map<string, { n: number; resetAt: number }>();

  check(method: string, path: string, ip: string, userId: string | null, now: number): Decision {
    const rule = RULES.find((r) => r.match(method, path))!;
    const who = rule.by === "user" && userId ? `u:${userId}` : `ip:${ip}`;
    const key = `${rule.name}|${who}`;
    const cur = this.hits.get(key);
    if (!cur || cur.resetAt <= now) {
      this.hits.set(key, { n: 1, resetAt: now + rule.windowMs });
      this.sweep(now);
      return { allowed: true, retryAfterSec: 0, rule: rule.name };
    }
    cur.n += 1;
    if (cur.n > (typeof rule.limit === "function" ? rule.limit() : rule.limit))
      return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)), rule: rule.name };
    return { allowed: true, retryAfterSec: 0, rule: rule.name };
  }

  private sweep(now: number): void {
    if (this.hits.size < 5000) return;
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}

/** The client's address: X-Forwarded-For counted from the right by the configured number of trusted proxies. */
export function clientIp(forwarded: string | undefined, socketIp: string, hops: number): string {
  if (!hops || !forwarded) return socketIp;
  const parts = forwarded
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts[Math.max(0, parts.length - hops)] ?? socketIp;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limiter = new RateLimiter();

  constructor(@Inject(JWT_SERVICE) private readonly jwt: JwtService) {}

  /** The person behind a VERIFIED bearer token, if any — a forged or expired token never earns its own bucket. */
  private userOf(header: string | undefined): string | null {
    if (!header?.startsWith("Bearer ")) return null;
    try {
      return this.jwt.verifyAccessToken(header.slice(7)).sub;
    } catch {
      return null;
    }
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ method: string; url: string; ip: string; headers: Record<string, string | undefined> }>();
    const path = req.url.split("?")[0]!.replace(/^\/api/, "");
    const ip = clientIp(req.headers["x-forwarded-for"], req.ip, readRaqibConfig().trustedProxyHops);
    const d = this.limiter.check(req.method, path, ip, this.userOf(req.headers.authorization), Date.now());
    if (!d.allowed) {
      throw new AppError({
        code: "raqib.rate_limited",
        message: `Too many requests. Try again in ${d.retryAfterSec} seconds.`,
        kind: "rate_limited",
        details: { retryAfterSec: d.retryAfterSec, rule: d.rule },
      });
    }
    return true;
  }
}
