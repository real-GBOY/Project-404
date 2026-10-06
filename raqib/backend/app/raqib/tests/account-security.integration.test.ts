/**
 * Account security: lock-out after wrong passwords, a TOTP second factor with recovery codes, the organization's
 * password rule, set-up enforcement and an administrator's reset — all over real HTTP.
 */
import { createHash } from "node:crypto";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Clock } from "@core/kernel/clock.js";
import { DEMO_PASSWORD, DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { hotp, stepOf } from "@raqib/raqib/account/domain/totp.js";
import { createDemoHttpApp, hasTestDb, loginAs } from "./helpers.js";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;

describe.skipIf(!hasTestDb)("Raqib account security", () => {
  let http: NestFastifyApplication;
  let nowMs = Date.parse("2026-10-04T08:00:00.000Z");
  const clock: Clock = { now: () => new Date(nowMs) };
  const advance = (ms: number) => (nowMs += ms);

  const post = async (url: string, payload: unknown, token?: string, headers: Record<string, string> = {}) => {
    const res = await http.inject({
      method: "POST",
      url: `/api${url}`,
      payload: payload as never,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    });
    return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : {}) as Json };
  };
  const get = async (url: string, token: string) => {
    const res = await http.inject({ method: "GET", url: `/api${url}`, headers: { authorization: `Bearer ${token}` } });
    return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : {}) as Json };
  };
  // each test uses its own client address so the (per address) rate limiter never interferes
  let ipSeq = 10;
  const login = (who: string, password = DEMO_PASSWORD, otp?: string, ip?: string) =>
    post("/auth/login", { email: who, password, ...(otp ? { otp } : {}) }, undefined, { "x-forwarded-for": ip ?? `10.9.0.${ipSeq++}` });

  beforeAll(async () => {
    http = (await createDemoHttpApp({ clock })).http;
  }, 180_000);

  afterAll(async () => {
    delete process.env.RAQIB_ENFORCE_ACCOUNT_POLICY;
    await http?.close();
  });

  describe("lock-out", () => {
    it("locks the address after five wrong passwords, even for the right password, then frees it", async () => {
      const who = email("insB");
      for (let i = 0; i < 5; i++) expect((await login(who, "wrong-password-" + i)).status).toBe(401);
      const locked = await login(who);
      expect(locked.status).toBe(429);
      expect(locked.body.error.code).toBe("raqib.account_locked");
      expect(locked.body.error.details.retryAfterSec).toBeGreaterThan(0);

      advance(16 * 60_000);
      expect((await login(who)).status).toBeLessThan(300);
    });

    it("a success clears the count, so scattered mistakes never add up", async () => {
      const who = email("insA");
      for (let round = 0; round < 3; round++) {
        for (let i = 0; i < 3; i++) await login(who, "nope-nope-" + i);
        expect((await login(who)).status).toBeLessThan(300);
      }
    });

    it("treats an unknown address the same way (no account enumeration)", async () => {
      const ghost = "nobody-here@raqib.sa";
      for (let i = 0; i < 5; i++) expect((await login(ghost, "x-" + i)).status).toBe(401);
      const r = await login(ghost, "x");
      expect(r.status).toBe(429);
      expect(r.body.error.code).toBe("raqib.account_locked");
    });
  });

  describe("second factor", () => {
    let token = "";
    let secret = "";
    let recovery: string[] = [];
    const who = () => email("insA");

    it("enrols with a secret, confirmed by a first code, and returns recovery codes once", async () => {
      token = await loginAs(http, who());
      expect((await get("/raqib/account/security", token)).body.mfa).toMatchObject({ enabled: false, required: false });
      const setup = await post("/raqib/account/mfa/setup", {}, token);
      expect(setup.status).toBe(200);
      secret = setup.body.secret;
      expect(setup.body.uri).toContain("otpauth://totp/");

      const bad = await post("/raqib/account/mfa/enable", { code: "000000" }, token);
      expect(bad.status).toBe(400);
      const ok = await post("/raqib/account/mfa/enable", { code: hotp(secret, stepOf(clock.now())) }, token);
      expect(ok.status).toBe(200);
      recovery = ok.body.recoveryCodes;
      expect(recovery).toHaveLength(10);
      expect((await get("/raqib/account/security", token)).body.mfa).toMatchObject({ enabled: true, pending: false, recoveryLeft: 10 });
    });

    it("the secret is stored sealed, never in the clear", async () => {
      const pg = (await import("pg")).default;
      const { TEST_DATABASE_URL } = await import("@core/tests/helpers.js");
      const c = new pg.Client({ connectionString: TEST_DATABASE_URL });
      await c.connect();
      try {
        const rows = (await c.query("SELECT mfa_secret, mfa_recovery FROM raqib_account_security WHERE mfa_secret IS NOT NULL")).rows;
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) {
          expect(r.mfa_secret).toMatch(/^v1:/);
          expect(r.mfa_secret).not.toContain(secret);
          expect(JSON.stringify(r.mfa_recovery)).not.toContain(recovery[0]);
        }
      } finally {
        await c.end();
      }
    });

    it("sign-in now needs the code; a wrong code is refused and counted; a replay of a used code is refused", async () => {
      const ip = "10.9.1.1";
      expect((await login(who(), DEMO_PASSWORD, undefined, ip)).body.error.code).toBe("raqib.mfa_required");
      expect((await login(who(), "wrong-password-xx", undefined, ip)).body.error.code).toBe("identity.invalid_credentials");
      expect((await login(who(), DEMO_PASSWORD, "123456", ip)).body.error.code).toBe("raqib.mfa_invalid");

      advance(60_000);
      const code = hotp(secret, stepOf(clock.now()));
      expect((await login(who(), DEMO_PASSWORD, code, ip)).status).toBeLessThan(300);
      expect((await login(who(), DEMO_PASSWORD, code, ip)).body.error.code).toBe("raqib.mfa_invalid");
    });

    it("a recovery code works exactly once", async () => {
      const ip = "10.9.1.2";
      expect((await login(who(), DEMO_PASSWORD, recovery[0], ip)).status).toBeLessThan(300);
      expect((await login(who(), DEMO_PASSWORD, recovery[0], ip)).body.error.code).toBe("raqib.mfa_invalid");
      expect((await get("/raqib/account/security", token)).body.mfa.recoveryLeft).toBe(9);
    });

    it("can be turned off by someone the organization does not require it of, with password and code", async () => {
      advance(120_000);
      const code = hotp(secret, stepOf(clock.now()));
      expect((await post("/raqib/account/mfa/disable", { password: "wrong-password-xx", code }, token)).status).toBe(401);
      expect((await post("/raqib/account/mfa/disable", { password: DEMO_PASSWORD, code }, token)).status).toBe(204);
      expect((await login(who())).status).toBeLessThan(300);
    });

    it("cannot be turned off by a role the organization requires it for", async () => {
      const qe = await loginAs(http, email("qe"));
      expect((await get("/raqib/account/security", qe)).body.mfa.required).toBe(true);
      const setup = await post("/raqib/account/mfa/setup", {}, qe);
      advance(30_000);
      await post("/raqib/account/mfa/enable", { code: hotp(setup.body.secret, stepOf(clock.now())) }, qe);
      advance(60_000);
      const r = await post("/raqib/account/mfa/disable", { password: DEMO_PASSWORD, code: hotp(setup.body.secret, stepOf(clock.now())) }, qe);
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe("raqib.mfa_required_by_policy");
    });
  });

  describe("password rule and change", () => {
    it("a reset link refuses a password shorter than the organization's minimum, and works with a long one", async () => {
      const who = email("guard");
      await post("/auth/password/forgot", { email: who });
      const pg = (await import("pg")).default;
      const { TEST_DATABASE_URL } = await import("@core/tests/helpers.js");
      const c = new pg.Client({ connectionString: TEST_DATABASE_URL });
      await c.connect();
      const token = "reset-token-for-test-" + Date.now();
      try {
        const u = (await c.query("SELECT id FROM users WHERE email_normalized = $1", [who])).rows[0];
        await c.query("UPDATE verification_tokens SET consumed_at = now() WHERE user_id = $1 AND purpose = 'password_reset'", [u.id]);
        await c.query(
          "INSERT INTO verification_tokens (id, user_id, purpose, token_hash, expires_at) VALUES ($1, $2, 'password_reset', $3, now() + interval '1 hour')",
          ["vt_test_" + Date.now(), u.id, createHash("sha256").update(token).digest("hex")],
        );
      } finally {
        await c.end();
      }
      const short = await post("/auth/password/reset", { token, password: "elevenchars" });
      expect(short.status).toBe(400);
      expect(short.body.error.code).toBe("raqib.password_too_short");
      expect((await post("/auth/password/reset", { token, password: "a-sufficiently-long-pass-1" })).status).toBe(204);
      expect((await login(who, "a-sufficiently-long-pass-1")).status).toBeLessThan(300);
    });

    it("changing the password needs the current one, applies the rule and ends other sessions", async () => {
      const who = email("sultan");
      const first = await post("/auth/login", { email: who, password: DEMO_PASSWORD }, undefined, { "x-forwarded-for": "10.9.3.1" });
      const token = first.body.tokens.accessToken as string;
      const refresh = first.body.tokens.refreshToken as string;
      expect((await post("/raqib/account/password", { current: "wrong-current-pass", next: "a-sufficiently-long-pass-2" }, token)).status).toBe(401);
      expect((await post("/raqib/account/password", { current: DEMO_PASSWORD, next: "elevenchars" }, token)).body.error.code).toBe("raqib.password_too_short");
      expect((await post("/raqib/account/password", { current: DEMO_PASSWORD, next: "a-sufficiently-long-pass-2" }, token)).status).toBe(204);
      expect((await post("/auth/refresh", { refreshToken: refresh })).status).toBe(401);
      expect((await login(who, "a-sufficiently-long-pass-2")).status).toBeLessThan(300);
      expect((await get("/raqib/account/security", token)).body.password.changedAt).toBeTruthy();
    });
  });

  describe("set-up enforcement", () => {
    it("with enforcement on, a role that must have a second factor can only reach set-up routes until it has one", async () => {
      process.env.RAQIB_ENFORCE_ACCOUNT_POLICY = "true";
      try {
        const pm = await loginAs(http, email("pm"));
        const blocked = await get("/raqib/visits", pm);
        expect(blocked.status).toBe(403);
        expect(blocked.body.error.code).toBe("raqib.security_setup_required");
        expect(blocked.body.error.details.steps).toEqual(["mfa"]);
        expect((await get("/raqib/me", pm)).status).toBe(200);
        expect((await get("/raqib/account/security", pm)).body.setupRequired).toEqual(["mfa"]);

        const setup = await post("/raqib/account/mfa/setup", {}, pm);
        advance(30_000);
        expect((await post("/raqib/account/mfa/enable", { code: hotp(setup.body.secret, stepOf(clock.now())) }, pm)).status).toBe(200);
        expect((await get("/raqib/visits", pm)).status).toBe(200);

        // a role the organization does not require a second factor of is never held up
        const ins = await loginAs(http, email("insB"));
        expect((await get("/raqib/visits", ins)).status).toBe(200);
      } finally {
        delete process.env.RAQIB_ENFORCE_ACCOUNT_POLICY;
      }
    });

    it("an administrator can reset another person's second factor, with a reason, and never their own", async () => {
      const qm = await loginAs(http, email("qm"));
      const ins = await loginAs(http, email("insB"));
      const users = (await get("/raqib/users?limit=100", qm)).body.items as Json[];
      const pm = users.find((u) => u.email === email("pm"))!;
      const me = (await get("/raqib/me", qm)).body;
      expect((await post(`/raqib/account/users/${me.id}/mfa-reset`, { reason: "testing it" }, qm)).status).toBe(403);
      expect((await post(`/raqib/account/users/${pm.id}/mfa-reset`, { reason: "x" }, qm)).status).toBe(400);
      expect((await post(`/raqib/account/users/${pm.id}/mfa-reset`, { reason: "Lost phone and recovery codes" }, ins)).status).toBe(403);
      expect((await post(`/raqib/account/users/${pm.id}/mfa-reset`, { reason: "Lost phone and recovery codes" }, qm)).status).toBe(204);
      expect((await login(email("pm"))).status).toBeLessThan(300);
    });
  });
});
