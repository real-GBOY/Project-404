import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Defensive response headers on every API response. The API serves JSON and file bytes, never pages, so the policy
 * can be as strict as it gets: nothing may be framed, sniffed or sent a referrer, and all of it is HTTPS-only.
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(_req: IncomingMessage, res: ServerResponse, next: () => void): void {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    next();
  }
}
