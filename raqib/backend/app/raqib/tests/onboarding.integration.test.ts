/**
 * Account onboarding: a public, rate-limited request with a signed declaration; a reviewer's decision that creates the
 * account with an unknown password and emails the secure setup link; nobody ever chooses or sees a password.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { EventRegistry } from "@core/events/registry.js";
import { DEMO_ORG, DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { createDemoHttpApp, get, hasTestDb, loginAs } from "./helpers.js";

const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const form = (over: Json = {}) => ({
  name: "Faisal Al-Otaibi", email: "f.alotaibi@example.com", phone: "0551234567", nationalId: "1098765432", employeeNo: "E-5521", department: "Operations", role: "ins", projects: "Jeddah hub",
  justification: "I will be inspecting the Jeddah sites from next month.", signature: "Faisal Al-Otaibi", agree: true, ...over,
});

describe.skipIf(!hasTestDb)("Raqib account onboarding", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};
  const resetTokens: Array<{ email: string; token: string }> = [];

  const call = async (who: string | null, method: "GET" | "POST", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: who ? { authorization: `Bearer ${tokens[who]}` } : {}, payload: payload as never });
    return { status: res.statusCode, body: (res.body && String(res.headers["content-type"]).includes("json") ? JSON.parse(res.body) : {}) as Json };
  };
  const pub = (path: string, payload?: unknown) => call(null, payload ? "POST" : "GET", `/raqib/public/onboarding/${DEMO_ORG.slug}${path}`, payload);
  const requests = async () => (await call("qm", "GET", "/raqib/account-requests")).body.items as Json[];

  beforeAll(async () => {
    process.env.RAQIB_ACCOUNT_REQUESTS_PER_HOUR = "200"; // the limit itself is covered by the rate-limit tests
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    get<EventRegistry>(booted.moduleRef, EventRegistry).onInProcess("user.password_reset_requested", async (e) => {
      const p = e.payload as { email: string; token: string };
      resetTokens.push({ email: p.email, token: p.token });
    });
    for (const key of ["qm", "pm", "insA"]) tokens[key] = await loginAs(http, email(key));
  }, 240_000);

  afterAll(async () => {
    delete process.env.RAQIB_ACCOUNT_REQUESTS_PER_HOUR;
    await http?.close();
  });

  it("serves the form's options to anyone, and nothing sensitive", async () => {
    const r = await pub("");
    expect(r.status).toBe(200);
    expect(r.body.organization.name).toBe(DEMO_ORG.name);
    expect(r.body.projects.length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(r.body.projects[0]).sort()).toEqual(["id", "name"]);
    expect(r.body.roles).not.toContain("qm");
    expect(r.body.roles).not.toContain("gm");
    expect((await call(null, "GET", "/raqib/public/onboarding/nope")).status).toBe(404);
  });

  it("accepts a request only with a valid form, the agreement and a matching signature", async () => {
    expect((await pub("/requests", form({ agree: false }))).body.error.code).toBe("raqib.declaration_required");
    expect((await pub("/requests", form({ signature: "Someone Else" }))).body.error.code).toBe("raqib.declaration_required");
    expect((await pub("/requests", form({ nationalId: "123" }))).status).toBe(400);
    expect((await pub("/requests", form({ role: "qm" }))).status).toBe(400);
    expect((await pub("/requests", { ...form(), extra: 1 })).status).toBe(400);
    const ok = await pub("/requests", form());
    expect(ok.status).toBe(201);
    expect(ok.body.ref).toMatch(/^ACR-26-\d{4}$/);
    expect((await pub("/requests", form())).body.error.code).toBe("raqib.request_pending");
  });

  it("shows requests only to those who manage users, masking the national ID in the list", async () => {
    expect((await call("pm", "GET", "/raqib/account-requests")).status).toBe(403);
    expect((await call("insA", "GET", "/raqib/account-requests")).status).toBe(403);
    const list = await requests();
    const r = list.find((x) => x.email === "f.alotaibi@example.com")!;
    expect(r.nationalId).toMatch(/^•+5432$/);
    expect(r.declaration).toMatchObject({ version: "2026-1", signedName: "Faisal Al-Otaibi" });
    const full = (await call("qm", "GET", `/raqib/account-requests/${r.id}`)).body;
    expect(full.nationalId).toBe("1098765432");
  });

  it("approval creates the account, scopes it, and sends a setup link — the applicant sets their own password", async () => {
    const r = (await requests()).find((x) => x.email === "f.alotaibi@example.com")!;
    const projects = (await call("qm", "GET", "/raqib/projects")).body.items as Json[];
    const jed = projects.find((p) => p.code === "PRJ-JED-007")!;
    expect((await call("pm", "POST", `/raqib/account-requests/${r.id}/approve`, { role: "ins", projectIds: [jed.id] })).status).toBe(403);
    expect((await call("qm", "POST", `/raqib/account-requests/${r.id}/approve`, { role: "qm", projectIds: [] })).status).toBe(400);
    expect((await call("qm", "POST", `/raqib/account-requests/${r.id}/approve`, { role: "ins", projectIds: [] })).body.error.code).toBe("raqib.projects_required");
    expect((await call("qm", "POST", `/raqib/account-requests/${r.id}/approve`, { role: "ins", projectIds: ["prj_missing"] })).body.error.code).toBe("raqib.project_not_found");
    const ok = await call("qm", "POST", `/raqib/account-requests/${r.id}/approve`, { role: "ins", projectIds: [jed.id], comment: "Welcome." });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: "approved", assignedRole: "ins" });
    expect(ok.body.decidedBy.en).toContain("Saud");
    expect((await call("qm", "POST", `/raqib/account-requests/${r.id}/approve`, { role: "ins", projectIds: [jed.id] })).body.error.code).toBe("raqib.request_decided");

    // the account cannot be entered with a guessed password, only through the emailed link
    const bad = await http.inject({ method: "POST", url: "/api/auth/login", payload: { email: "f.alotaibi@example.com", password: "demo-password-2026" } });
    expect(bad.statusCode).toBe(401);
    const link = resetTokens.find((t) => t.email === "f.alotaibi@example.com")!;
    expect(link.token.length).toBeGreaterThan(20);
    const set = await http.inject({ method: "POST", url: "/api/auth/password/reset", payload: { token: link.token, password: "Applicant-chosen-2026" } });
    expect(set.statusCode).toBeLessThan(300);
    expect((await http.inject({ method: "POST", url: "/api/auth/password/reset", payload: { token: link.token, password: "Another-attempt-2026" } })).statusCode).toBe(400); // single use
    const newTokens = await loginWith("f.alotaibi@example.com", "Applicant-chosen-2026");
    const me = await http.inject({ method: "GET", url: "/api/raqib/me", headers: { authorization: `Bearer ${newTokens}` } });
    const body = JSON.parse(me.body);
    expect(body.role).toBe("ins");
    expect(body.scope.length).toBe(1);
    const visits = JSON.parse((await http.inject({ method: "GET", url: "/api/raqib/visits", headers: { authorization: `Bearer ${newTokens}` } })).body).items as Json[];
    expect(visits.every((v) => v.project.code === "PRJ-JED-007")).toBe(true);
  });

  it("refuses to approve over an existing account, leaving the request pending", async () => {
    const dup = await pub("/requests", form({ name: "Existing Person", email: email("insB"), signature: "Existing Person", nationalId: "1000000001" }));
    expect(dup.status).toBe(201);
    const r = (await requests()).find((x) => x.email === email("insB"))!;
    const projects = (await call("qm", "GET", "/raqib/projects")).body.items as Json[];
    expect((await call("qm", "POST", `/raqib/account-requests/${r.id}/approve`, { role: "ins", projectIds: [projects[0]!.id] })).body.error.code).toBe("raqib.email_taken");
    expect((await requests()).find((x) => x.id === r.id)!.status).toBe("pending");
  });

  it("rejects with a reason, and a rejected request stays rejected", async () => {
    await pub("/requests", form({ name: "Another Applicant", email: "another@example.com", signature: "Another Applicant", nationalId: "1000000002" }));
    const r = (await requests()).find((x) => x.email === "another@example.com")!;
    expect((await call("qm", "POST", `/raqib/account-requests/${r.id}/reject`, { reason: "x" })).status).toBe(400);
    const done = await call("qm", "POST", `/raqib/account-requests/${r.id}/reject`, { reason: "No post is open in that project." });
    expect(done.body).toMatchObject({ status: "rejected", decisionReason: "No post is open in that project." });
    expect((await call("qm", "POST", `/raqib/account-requests/${r.id}/approve`, { role: "ins", projectIds: ["x"] })).body.error.code).toBe("raqib.request_decided");
    expect((await call("qm", "POST", `/raqib/account-requests/${r.id}/resend`)).body.error.code).toBe("raqib.request_not_approved");
  });

  it("can send a fresh setup link to an approved applicant, and audits every decision", async () => {
    const r = (await requests()).find((x) => x.email === "f.alotaibi@example.com")!;
    const before = resetTokens.length;
    expect((await call("qm", "POST", `/raqib/account-requests/${r.id}/resend`)).status).toBe(204);
    expect(resetTokens.length).toBe(before + 1);
    const audit = (await call("qm", "GET", "/raqib/audit?entity=raqib_account_request")).body.items as Json[];
    const actions = new Set(audit.map((a) => a.action));
    for (const a of ["raqib.account_request.submitted", "raqib.account_request.approved", "raqib.account_request.rejected", "raqib.account_request.link_resent"]) expect(actions.has(a), a).toBe(true);
  });

  async function loginWith(mail: string, password: string): Promise<string> {
    return loginAs(http, mail, password);
  }
});
