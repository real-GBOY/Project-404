import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { createJwtService } from "../infrastructure/jwt-service.js";
import { fixedClock } from "../../kernel/clock.js";

const make = (over: Partial<Parameters<typeof createJwtService>[0]> = {}) =>
  createJwtService({
    secret: "unit-test-secret",
    accessTtlSeconds: 900,
    clock: fixedClock("2026-08-29T12:00:00.000Z"),
    ...over,
  });

describe("JwtService — access tokens", () => {
  it("round-trips the claims", () => {
    const svc = make();
    const token = svc.signAccessToken({
      sub: "usr_1",
      email: "a@b.com",
      org: "org_1",
      perms: ["read:file"],
    });
    expect(svc.verifyAccessToken(token)).toEqual({
      sub: "usr_1",
      email: "a@b.com",
      org: "org_1",
      perms: ["read:file"],
    });
  });

  it("rejects a token signed with a different secret", () => {
    const token = make({ secret: "one" }).signAccessToken({ sub: "u", email: "", org: null, perms: [] });
    expect(() => make({ secret: "two" }).verifyAccessToken(token)).toThrow();
  });

  it("rejects a token from a different issuer", () => {
    const token = make({ issuer: "other-service" }).signAccessToken({
      sub: "u",
      email: "",
      org: null,
      perms: [],
    });
    expect(() => make().verifyAccessToken(token)).toThrow();
  });

  it("rejects a tampered token", () => {
    const svc = make();
    const token = svc.signAccessToken({ sub: "u", email: "", org: null, perms: [] });
    const tampered = token.slice(0, -3) + "aaa";
    expect(() => svc.verifyAccessToken(tampered)).toThrow();
  });

  it("honours expiry against the injected clock", () => {
    const token = make().signAccessToken({ sub: "u", email: "", org: null, perms: [] });

    // clock 20 minutes ahead — past the 15-minute TTL
    const later = fixedClock(new Date(Date.now() + 20 * 60 * 1000).toISOString());
    expect(() => make({ clock: later }).verifyAccessToken(token)).toThrow(jwt.TokenExpiredError);

    // clock at "now" — still valid
    expect(() =>
      make({ clock: fixedClock(new Date().toISOString()) }).verifyAccessToken(token),
    ).not.toThrow();
  });

  it("defaults email and perms when the payload omits them", () => {
    const svc = make();
    const bare = jwt.sign({}, "unit-test-secret", {
      subject: "usr_9",
      issuer: "auric-core",
      algorithm: "HS256",
    });
    expect(svc.verifyAccessToken(bare)).toEqual({ sub: "usr_9", email: "", org: null, perms: [] });
  });

  it("rejects a token with no subject", () => {
    const svc = make();
    const noSub = jwt.sign({ email: "x" }, "unit-test-secret", {
      issuer: "auric-core",
      algorithm: "HS256",
    });
    expect(() => svc.verifyAccessToken(noSub)).toThrow(/malformed/);
  });
});

describe("JwtService — refresh tokens", () => {
  it("hashes deterministically with SHA-256 hex", () => {
    const svc = make();
    const h = svc.hashRefreshToken("abc");
    expect(h).toBe(svc.hashRefreshToken("abc"));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(svc.hashRefreshToken("abc")).not.toBe(svc.hashRefreshToken("abd"));
  });

  it("newRefreshToken returns a fresh secret plus its matching hash", () => {
    const svc = make();
    const a = svc.newRefreshToken();
    const b = svc.newRefreshToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toBe(svc.hashRefreshToken(a.token));
    // opaque, URL-safe, not a JWT
    expect(a.token).not.toContain(".");
    expect(a.token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
