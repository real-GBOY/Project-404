import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Clock } from "@core/kernel/clock.js";

/**
 * Access tokens are short-lived JWTs (§2). Refresh tokens are opaque random
 * strings stored hashed (see refresh-token-repository) — never JWTs — so they
 * can be revoked server-side.
 */
export interface AccessTokenClaims {
  sub: string;
  email: string;
  /** The active tenant (§ docs/tenancy.md), or null for an orgless token. */
  org: string | null;
  /** Permission keys the user holds *in `org`*. Empty for an orgless token. */
  perms: string[];
}

export interface JwtService {
  signAccessToken(claims: AccessTokenClaims): string;
  verifyAccessToken(token: string): AccessTokenClaims;
  /** A fresh opaque refresh-token secret and its storage hash. */
  newRefreshToken(): { token: string; hash: string };
  hashRefreshToken(token: string): string;
}

export function createJwtService(params: {
  secret: string;
  accessTtlSeconds: number;
  clock: Clock;
  issuer?: string;
}): JwtService {
  const issuer = params.issuer ?? "auric-core";

  return {
    signAccessToken(claims) {
      return jwt.sign(
        { email: claims.email, org: claims.org, perms: claims.perms },
        params.secret,
        {
          subject: claims.sub,
          issuer,
          expiresIn: params.accessTtlSeconds,
          algorithm: "HS256",
        },
      );
    },

    verifyAccessToken(token) {
      const decoded = jwt.verify(token, params.secret, {
        issuer,
        algorithms: ["HS256"],
        clockTimestamp: Math.floor(params.clock.now().getTime() / 1000),
      });
      if (typeof decoded === "string" || !decoded.sub) {
        throw new jwt.JsonWebTokenError("malformed access token");
      }
      return {
        sub: String(decoded.sub),
        email: typeof decoded.email === "string" ? decoded.email : "",
        org: typeof decoded.org === "string" ? decoded.org : null,
        perms: Array.isArray(decoded.perms) ? (decoded.perms as string[]) : [],
      };
    },

    newRefreshToken() {
      const token = crypto.randomBytes(32).toString("base64url");
      return { token, hash: this.hashRefreshToken(token) };
    },

    hashRefreshToken(token) {
      return crypto.createHash("sha256").update(token).digest("hex");
    },
  };
}
