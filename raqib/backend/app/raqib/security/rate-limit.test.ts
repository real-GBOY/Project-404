import { describe, expect, it } from "vitest";
import { clientIp, RateLimiter } from "./rate-limit.js";

describe("rate limiter", () => {
  it("limits sign-in attempts per client address and recovers after the window", () => {
    const l = new RateLimiter();
    const t0 = 1_000_000;
    for (let n = 0; n < 60; n++) expect(l.check("POST", "/auth/login", "1.1.1.1", null, t0).allowed).toBe(true);
    const blocked = l.check("POST", "/auth/login", "1.1.1.1", null, t0 + 1000);
    expect(blocked).toMatchObject({ allowed: false, rule: "auth" });
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(l.check("POST", "/auth/login", "2.2.2.2", null, t0 + 1000).allowed).toBe(true); // another address
    expect(l.check("POST", "/auth/login", "1.1.1.1", null, t0 + 61_000).allowed).toBe(true); // a new window
  });

  it("does not let sign-ins use up the budget for renewing sessions, or the other way round", () => {
    const l = new RateLimiter();
    const t0 = 1_000_000;
    for (let n = 0; n < 60; n++) l.check("POST", "/auth/login", "9.9.9.9", null, t0);
    expect(l.check("POST", "/auth/login", "9.9.9.9", null, t0 + 1)).toMatchObject({ allowed: false, rule: "auth" });
    for (let n = 0; n < 300; n++) expect(l.check("POST", "/auth/refresh", "9.9.9.9", null, t0 + 2).allowed).toBe(true);
    expect(l.check("POST", "/auth/refresh", "9.9.9.9", null, t0 + 3)).toMatchObject({ allowed: false, rule: "auth-refresh" });
  });

  it("limits confidential submissions per person, not per address", () => {
    const l = new RateLimiter();
    for (let n = 0; n < 5; n++) expect(l.check("POST", "/raqib/confidential/reports", "9.9.9.9", "u1", 1).allowed).toBe(true);
    expect(l.check("POST", "/raqib/confidential/reports", "9.9.9.9", "u1", 2).allowed).toBe(false);
    expect(l.check("POST", "/raqib/confidential/reports", "9.9.9.9", "u2", 2).allowed).toBe(true);
  });

  it("limits report downloads and leaves ordinary reads generous", () => {
    const l = new RateLimiter();
    for (let n = 0; n < 12; n++) expect(l.check("GET", "/raqib/reports/rep_1/html", "i", "u1", 5).allowed).toBe(true);
    expect(l.check("GET", "/raqib/reports/rep_1/html", "i", "u1", 6)).toMatchObject({ allowed: false, rule: "pdf" });
    for (let n = 0; n < 500; n++) expect(l.check("GET", "/raqib/visits", "i", "u1", 5).allowed).toBe(true);
  });

  it("takes the client address from the right of X-Forwarded-For by the trusted hop count", () => {
    expect(clientIp("6.6.6.6, 5.5.5.5", "10.0.0.1", 0)).toBe("10.0.0.1");
    expect(clientIp("6.6.6.6, 5.5.5.5", "10.0.0.1", 1)).toBe("5.5.5.5"); // what our proxy appended, not what the visitor claimed
    expect(clientIp(undefined, "10.0.0.1", 1)).toBe("10.0.0.1");
  });
});
