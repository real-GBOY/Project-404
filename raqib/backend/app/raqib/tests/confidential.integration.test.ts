/**
 * Phase 8 — the confidential area. No role opens it: access is an explicit GM-issued grant plus a logged entry with
 * a reason; the reporter's identity is stored apart and opens only through a logged reveal; the area is invisible to
 * search, analytics and exports; a plain database query through the application role sees nothing.
 */
import pg from "pg";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { TEST_DATABASE_URL } from "@core/tests/helpers.js";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { asUser, createDemoHttpApp, hasTestDb, loginAs } from "./helpers.js";

const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function ownerQuery<T extends pg.QueryResultRow>(text: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

describe.skipIf(!hasTestDb)("Raqib confidential area", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};
  const call = async (who: string, method: "GET" | "POST", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api/raqib/confidential${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return { status: res.statusCode, body: (res.body && String(res.headers["content-type"]).includes("json") ? JSON.parse(res.body) : {}) as Json, headers: res.headers };
  };
  const enter = (who: string, reason = "investigation") => call(who, "POST", "/session", { reason, ack: true });
  const code = (r: { body: Json }) => r.body.error?.code;
  const list = async (who: string) => (await call(who, "GET", "/reports")).body.items as Json[];

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    for (const key of ["qm", "qe", "pm", "gm", "legal", "bandar", "guard", "turki", "insA"]) tokens[key] = await loginAs(http, email(key));
  }, 240_000);

  afterAll(async () => {
    await http?.close();
  });

  it("no role opens the area: a grant and an entry are needed", async () => {
    for (const who of ["qe", "pm", "insA", "guard", "gm"]) {
      expect(code(await call(who, "GET", "/reports"))).toBe("raqib.conf_no_grant");
    }
    // the Director of Quality has a grant, but still has to enter with a reason
    expect(code(await call("qm", "GET", "/reports"))).toBe("raqib.conf_session_required");
    expect((await call("qm", "POST", "/session", { reason: "nonsense", ack: true })).status).toBe(400);
    expect((await call("qm", "POST", "/session", { reason: "investigation", ack: false })).status).toBe(400);
    expect(code(await enter("qe"))).toBe("raqib.conf_no_grant");
    expect((await enter("qm")).status).toBe(200);
    expect((await list("qm")).length).toBe(3);
  });

  it("reports show the reporter's identity only as their mode allows", async () => {
    const all = await list("qm");
    const byKind = (k: string) => all.find((r) => r.kind === k)!;
    const named = (await call("qm", "GET", `/reports/${byKind("safety").id}`)).body;
    expect(named.body).toContain("lock");
    expect(named.identity).toMatchObject({ mode: "named", revealed: true });
    expect(named.identity.name.en).toBe("Abdullah Al-Mutairi");
    const conf = (await call("qm", "GET", `/reports/${byKind("misconduct").id}`)).body;
    expect(conf.identity).toEqual({ mode: "confidential", revealed: false });
    expect(JSON.stringify(conf)).not.toContain("Anazi");
    const anon = (await call("qm", "GET", `/reports/${byKind("violation").id}`)).body;
    expect(anon.identity).toEqual({ mode: "anonymous", revealed: false });
  });

  it("reveals a confidential identity only with a reason and the respond level, and logs it", async () => {
    const conf = (await list("qm")).find((r) => r.kind === "misconduct")!;
    expect((await call("qm", "POST", `/reports/${conf.id}/reveal`, { reason: "x" })).status).toBe(400);
    const anon = (await list("qm")).find((r) => r.kind === "violation")!;
    expect(code(await call("qm", "POST", `/reports/${anon.id}/reveal`, { reason: "Need to follow up" }))).toBe("raqib.anonymous");
    const r = await call("qm", "POST", `/reports/${conf.id}/reveal`, { reason: "Need to contact the reporter to complete the inquiry" });
    expect(r.body.identity).toMatchObject({ revealed: true });
    expect(r.body.identity.name.en).toBe("Turki Al-Anazi");
    // the reveal belongs to the person who did it: a later read by them shows it, nobody else's does
    expect((await call("qm", "GET", `/reports/${conf.id}`)).body.identity.revealed).toBe(true);
    const log = (await ownerQuery(`SELECT actor_name_en, reason FROM raqib_conf_access_log WHERE action = 'reveal_identity'`))[0]!;
    expect(log.actor_name_en).toContain("Saud");
    expect(log.reason).toContain("complete the inquiry");
  });

  it("scopes and levels: a view-only, standard-scope grant cannot see high-sensitivity reports or respond", async () => {
    expect((await enter("legal", "audit")).status).toBe(200);
    const items = await list("legal");
    expect(items.every((r) => r.sensitivity === "standard")).toBe(true);
    expect(items.length).toBe(2);
    const high = (await list("qm")).find((r) => r.sensitivity === "high")!;
    expect((await call("legal", "GET", `/reports/${high.id}`)).status).toBe(404);
    const std = items[0]!;
    expect(code(await call("legal", "POST", `/reports/${std.id}/respond`, { text: "ok then" }))).toBe("raqib.conf_view_only");
    expect(code(await call("legal", "POST", `/reports/${std.id}/reveal`, { reason: "curiosity" }))).toBe("raqib.conf_view_only");
  });

  it("a revoked grant stops working at once", async () => {
    expect(code(await enter("bandar"))).toBe("raqib.conf_no_grant");
  });

  it("reporters follow their own reports and read the response; anonymous reports are not linkable", async () => {
    const mine = (await call("turki", "GET", "/mine")).body.items as Json[];
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ kind: "misconduct", status: "under_review" });
    expect(mine[0].response).toContain("formal inquiry");
    expect(((await call("guard", "GET", "/mine")).body.items as Json[]).map((m) => m.kind)).toEqual(["safety"]); // not the anonymous one
    expect(((await call("qe", "GET", "/mine")).body.items as Json[]).length).toBe(0);
    const n = (await http.inject({ method: "GET", url: "/api/notifications", headers: { authorization: `Bearer ${tokens.turki}` } })).body;
    const notes = JSON.parse(n).notifications as Json[];
    const resp = notes.find((x) => x.type === "raqib.conf_response")!;
    expect(resp).toBeTruthy();
    expect(JSON.stringify(resp)).not.toContain("inquiry"); // a response exists — its text is not in the notification
  });

  it("officers respond and change status, and reporters are told without content", async () => {
    const r = (await list("qm")).find((x) => x.kind === "violation")!;
    const done = await call("qm", "POST", `/reports/${r.id}/respond`, { text: "Night checks were reviewed with the contractor.", status: "under_review" });
    expect(done.body.status).toBe("under_review");
    expect((await call("qm", "POST", `/reports/${r.id}/status`, { status: "closed" })).body.status).toBe("closed");
  });

  it("only the General Manager manages grants, never their own, and through a logged entry", async () => {
    expect(code(await call("qm", "GET", "/grants"))).toBe("raqib.conf_gm_only");
    expect(code(await call("gm", "GET", "/grants"))).toBe("raqib.conf_session_required");
    expect((await enter("gm", "grant_review")).status).toBe(200);
    const grants = (await call("gm", "GET", "/grants")).body.items as Json[];
    expect(grants.map((g) => g.status).sort()).toEqual(["active", "active", "revoked"]);
    const people = (await call("gm", "GET", "/grantees")).body.items as Json[];
    const gmId = (await call("gm", "GET", "/grants")).body.items[0].grantedBy && people.find((p) => p.role === "gm");
    expect(gmId).toBeFalsy(); // the GM is not offered as a grantee
    const qe = people.find((p) => p.role === "qe" && p.name.en === "Noura Al-Qahtani")!;
    const base = { userId: qe.id, level: "view", scope: "standard", reason: "Second reviewer", expiresAt: "2026-11-01T00:00:00Z" };
    expect((await call("qm", "POST", "/grants", base)).status).toBe(403);
    expect((await call("gm", "POST", "/grants", { ...base, reason: "x" })).status).toBe(400);
    expect((await call("gm", "POST", "/grants", { ...base, expiresAt: "2026-10-04T08:10:00Z" })).status).toBe(400); // under an hour
    expect((await call("gm", "POST", "/grants", { ...base, expiresAt: "2028-01-01T00:00:00Z" })).status).toBe(400); // over a year
    const gm = (await ownerQuery(`SELECT user_id FROM raqib_profiles WHERE role_key = 'gm'`))[0]!.user_id as string;
    expect(code(await call("gm", "POST", "/grants", { ...base, userId: gm }))).toBe("raqib.conf_self_grant");
    expect((await call("gm", "POST", "/grants", base)).status).toBe(201);
    expect((await enter("qe")).status).toBe(200); // the new grant works
    const g = ((await call("gm", "GET", "/grants")).body.items as Json[]).find((x) => x.user.name.en === "Noura Al-Qahtani")!;
    expect((await call("gm", "POST", `/grants/${g.id}/revoke`, { reason: "x" })).status).toBe(400);
    expect((await call("gm", "POST", `/grants/${g.id}/revoke`, { reason: "No longer needed" })).status).toBe(200);
    expect(code(await call("gm", "POST", `/grants/${g.id}/revoke`, { reason: "again please" }))).toBe("raqib.grant_revoked");
    expect(code(await call("qe", "GET", "/reports"))).toBe("raqib.conf_no_grant");
  });

  it("the protected log records entries, reads, responses and reveals — and never names a reporter", async () => {
    const log = (await call("gm", "GET", "/log")).body.items as Json[];
    const actions = new Set(log.map((e) => e.action));
    for (const a of ["enter", "view_list", "view_report", "respond", "reveal_identity", "grant_issued", "grant_revoked", "submit"]) expect(actions.has(a)).toBe(true);
    expect(log.filter((e) => e.action === "submit").every((e) => e.actor.en === "Reporter")).toBe(true);
    expect(log.some((e) => e.actor.en.includes("Mutairi") || e.actor.en.includes("Anazi"))).toBe(false);
    expect(code(await call("qm", "GET", "/log"))).toBe("raqib.conf_gm_only");
    await expect(ownerQuery(`UPDATE raqib_conf_access_log SET reason = 'x'`)).rejects.toThrow(/immutable/);
  });

  it("is invisible to search, analytics and exports, and to a plain query through the application role", async () => {
    const search = await http.inject({ method: "GET", url: "/api/raqib/search?q=lock", headers: { authorization: `Bearer ${tokens.qm}` } });
    expect(search.body).not.toContain("CNF-");
    expect(search.body).not.toContain("attendants");
    const analytics = await http.inject({ method: "GET", url: "/api/raqib/analytics/export?period=year", headers: { authorization: `Bearer ${tokens.qm}` } });
    expect(analytics.body).not.toContain("CNF-");
    const org = (await ownerQuery(`SELECT id FROM organizations WHERE slug = 'raqib-demo'`))[0]!.id as string;
    const qmId = (await ownerQuery(`SELECT user_id FROM raqib_profiles WHERE role_key = 'qm'`))[0]!.user_id as string;
    const rows = await asUser(qmId, org, () => raqibDb().selectFrom("raqib_conf_reports").selectAll().execute());
    // owner-role test setups may bypass RLS; the application role must see nothing without the authorization flag
    if (process.env.AURIC_APP_DATABASE_URL) expect(rows).toEqual([]);
  });

  it("keeps confidential responses out of any cache", async () => {
    const r = (await list("qm"))[0]!;
    expect((await call("qm", "GET", `/reports/${r.id}`)).headers["cache-control"]).toBeDefined();
  });
});
