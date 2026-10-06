/**
 * Phase 9 — hardening: every endpoint is closed unless explicitly opened, responses carry defensive headers, sign-in
 * is rate limited, the audit trail is readable by its holders only, and nothing answers an anonymous caller.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { createDemoHttpApp, hasTestDb, loginAs } from "./helpers.js";

const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function controllers(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? controllers(p) : p.endsWith(".controller.ts") ? [p] : [];
  });
}

describe("authorization is declared on every endpoint (static review)", () => {
  const root = join(__dirname, "..");
  const files = controllers(root);

  it("finds the controllers", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  const isPublic = (src: string) => src.startsWith("// PUBLIC:");
  /** The operations controller (metrics, readiness): not tenant data, so not behind a person's JWT. It has its own rules below. */
  const isOps = (src: string) => src.startsWith("// OPS:");

  it("every Raqib controller is behind JWT + the access guard, except the one marked PUBLIC", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (isPublic(src) || isOps(src)) continue;
      expect(src, f).toMatch(/@UseGuards\(JwtAuthGuard, AccessGuard\)/);
    }
  });

  it("the public controller is a single file, lives under /raqib/public/ and only reads options or creates a pending request", () => {
    const pub = files.filter((f) => isPublic(readFileSync(f, "utf8")));
    expect(pub).toHaveLength(1);
    const src = readFileSync(pub[0]!, "utf8");
    expect(src).toMatch(/@Controller\("raqib\/public\//);
    expect((src.match(/@(Put|Patch|Delete)\(/g) ?? []).length).toBe(0);
    expect((src.match(/@Post\(/g) ?? []).length).toBe(1);
  });

  it("the operations controller is a single read-only file: GET routes only, the metrics route needs its token, and it touches no tenant service", () => {
    const ops = files.filter((f) => isOps(readFileSync(f, "utf8")));
    expect(ops).toHaveLength(1);
    const src = readFileSync(ops[0]!, "utf8");
    expect((src.match(/@(Post|Put|Patch|Delete)\(/g) ?? []).length).toBe(0);
    expect(src).toMatch(/metricsToken/);
    expect(src).toMatch(/401/);
    expect(src).not.toMatch(/Service.*from "@raqib\/raqib\/(?!jobs|reports\/infrastructure)/);
  });

  it("every route declares @Allow(...) — the guard fails closed without it", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (isPublic(src) || isOps(src)) continue;
      const routes = (src.match(/@(Get|Post|Put|Patch|Delete)\(/g) ?? []).length;
      const allows = (src.match(/@Allow\(/g) ?? []).length;
      expect(allows, `${f}: ${routes} routes, ${allows} @Allow`).toBe(routes);
    }
  });
});

describe.skipIf(!hasTestDb)("Raqib hardening", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};
  const call = async (who: string | null, url: string) => {
    const res = await http.inject({ method: "GET", url: `/api${url}`, headers: who ? { authorization: `Bearer ${tokens[who]}` } : {} });
    return {
      status: res.statusCode,
      body: (res.body && String(res.headers["content-type"]).includes("json") ? JSON.parse(res.body) : {}) as Json,
      text: res.body,
      headers: res.headers,
    };
  };

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    for (const key of ["qm", "pm", "gm"]) tokens[key] = await loginAs(http, email(key));
  }, 240_000);

  afterAll(async () => {
    await http?.close();
  });

  it("answers nobody who is not signed in", async () => {
    for (const url of [
      "/raqib/me",
      "/raqib/projects",
      "/raqib/visits",
      "/raqib/reports",
      "/raqib/actions",
      "/raqib/training",
      "/raqib/analytics",
      "/raqib/audit",
      "/raqib/confidential/access",
      "/raqib/search?q=gate",
    ]) {
      expect((await call(null, url)).status, url).toBe(401);
    }
  });

  it("sends defensive headers on every response", async () => {
    const r = await call("qm", "/raqib/me");
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(r.headers["x-frame-options"]).toBe("DENY");
    expect(r.headers["referrer-policy"]).toBe("no-referrer");
    expect(String(r.headers["content-security-policy"])).toContain("frame-ancestors 'none'");
    expect(r.headers["strict-transport-security"]).toBeDefined();
  });

  it("lets the audit trail be read by its holders only", async () => {
    expect((await call("pm", "/raqib/audit")).status).toBe(403);
    const r = await call("qm", "/raqib/audit");
    expect(r.status).toBe(200);
    const actions = new Set((r.body.items as Json[]).map((e) => e.action));
    for (const a of ["raqib.inspection.approved", "raqib.report.issued", "raqib.action.created", "raqib.training.requested"])
      expect(actions.has(a), a).toBe(true);
    expect((r.body.items as Json[]).every((e) => e.actor.name.en)).toBe(true);
    const only = (await call("qm", "/raqib/audit?entity=raqib_report")).body.items as Json[];
    expect(only.length).toBeGreaterThan(0);
    expect(only.every((e) => e.entity === "raqib_report")).toBe(true);
    expect(((await call("qm", "/raqib/audit?q=zzzz-nothing")).body.items as Json[]).length).toBe(0);
    expect((await call("qm", "/raqib/audit?from=yesterday")).status).toBe(400);
    expect((await call("qm", "/raqib/audit/export")).status).toBe(200);
    expect((await call("gm", "/raqib/audit")).status).toBe(200);
    // the confidential area never writes into the general audit trail
    expect(r.text).not.toContain("CNF-");
  });

  it("rate limits sign-in attempts", async () => {
    let limited = 0;
    for (let n = 0; n < 80; n++) {
      const res = await http.inject({ method: "POST", url: "/api/auth/login", payload: { email: "nobody@example.com", password: "wrong-password-1" } });
      if (res.statusCode === 429) limited++;
    }
    expect(limited).toBeGreaterThan(0);
    const body = JSON.parse(
      (await http.inject({ method: "POST", url: "/api/auth/login", payload: { email: "nobody@example.com", password: "wrong-password-1" } })).body,
    );
    expect(body.error.code).toBe("raqib.rate_limited");
  });
});
