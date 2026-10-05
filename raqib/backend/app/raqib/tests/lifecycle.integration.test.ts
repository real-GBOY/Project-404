/**
 * Data lifecycle: national IDs are sealed at rest (and legacy plaintext rows get sealed), decided account requests and
 * expired evidence are erased by the scheduled retention job, and a person's data can be exported on request.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Clock } from "@core/kernel/clock.js";
import { TEST_DATABASE_URL } from "@core/tests/helpers.js";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { JobsRunner } from "@raqib/raqib/jobs/jobs-runner.js";
import { LifecycleService } from "@raqib/raqib/lifecycle/lifecycle-service.js";
import { open } from "@raqib/raqib/shared/data-key.js";
import { createDemoHttpApp, get, hasTestDb, loginAs } from "./helpers.js";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;

describe.skipIf(!hasTestDb)("Raqib data lifecycle", () => {
  let app: NestFastifyApplication;
  let runner: JobsRunner;
  let lifecycle: LifecycleService;
  let nowMs = Date.parse("2026-10-04T08:00:00.000Z");
  const clock: Clock = { now: () => new Date(nowMs) };
  const tokens: Record<string, string> = {};

  async function sql<T extends pg.QueryResultRow = Json>(text: string, params: unknown[] = []): Promise<T[]> {
    const c = new pg.Client({ connectionString: TEST_DATABASE_URL });
    await c.connect();
    try {
      return (await c.query<T>(text, params)).rows;
    } finally {
      await c.end();
    }
  }
  const call = async (who: string, url: string) => {
    const res = await app.inject({ method: "GET", url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` } });
    return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : {}) as Json };
  };

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock });
    app = booted.http;
    runner = get<JobsRunner>(booted.moduleRef, JobsRunner);
    lifecycle = get<LifecycleService>(booted.moduleRef, LifecycleService);
    for (const k of ["qm", "pm", "insA"]) tokens[k] = await loginAs(app, email(k));
  }, 180_000);

  afterAll(async () => {
    await app?.close();
  });

  describe("national ids at rest", () => {
    it("are stored sealed for guards and for account requests, and read back whole", async () => {
      const guards = await sql<{ national_id: string }>("SELECT national_id FROM raqib_guards");
      const requests = await sql<{ national_id: string }>("SELECT national_id FROM raqib_account_requests");
      expect(guards.length).toBeGreaterThan(0);
      expect(requests.length).toBeGreaterThan(0);
      for (const r of [...guards, ...requests]) expect(r.national_id).toMatch(/^v1:/);
      expect(open(requests[0]!.national_id)).toMatch(/^\d{10}$/);
      // the API still shows guards masked and reviewers the request's id in full
      const list = ((await call("qm", "/raqib/guards")).body.items as Json[])[0]!;
      expect(list.nationalId).toMatch(/^\d{4}•••\d{3}$/);
    });

    it("seals plaintext rows that predate field encryption, once", async () => {
      await sql("UPDATE raqib_guards SET national_id = '1099887766' WHERE id = (SELECT id FROM raqib_guards ORDER BY id LIMIT 1)");
      const first = await lifecycle.sealLegacy();
      expect(first.guards).toBe(1);
      const row = (await sql<{ national_id: string }>("SELECT national_id FROM raqib_guards WHERE national_id LIKE 'v1:%' ORDER BY id LIMIT 1"))[0]!;
      expect(row.national_id).toMatch(/^v1:/);
      expect(await lifecycle.sealLegacy()).toEqual({ guards: 0, requests: 0 });
    });
  });

  describe("retention", () => {
    it("erases the personal details of decided account requests after the retention period, never a pending one", async () => {
      const before = await sql<{ status: string }>("SELECT status FROM raqib_account_requests");
      expect(before.some((r) => r.status === "pending")).toBe(true);
      nowMs = Date.parse("2027-11-01T08:00:00.000Z"); // 13 months on
      const report = await runner.tick();
      expect(report?.requestsErased).toBeGreaterThanOrEqual(1);
      const rows = await sql<{ status: string; name: string; email: string; national_id: string; erased_at: Date | null; ref: string }>(
        "SELECT status, name, email, national_id, erased_at, ref FROM raqib_account_requests",
      );
      for (const r of rows.filter((x) => x.status !== "pending")) {
        expect(r.name).toBe("[erased]");
        expect(r.national_id).toBe("");
        expect(r.email).toMatch(/@erased\.invalid$/);
        expect(r.erased_at).not.toBeNull();
        expect(r.ref).toMatch(/^[A-Z]+-/); // the reference and decision stay
      }
      for (const r of rows.filter((x) => x.status === "pending")) {
        expect(r.name).not.toBe("[erased]");
        expect(r.erased_at).toBeNull();
      }
      const audit = await sql("SELECT 1 FROM audit_logs WHERE action = 'raqib.retention.requests_erased'");
      expect(audit.length).toBeGreaterThan(0);
    });

    it("deletes evidence older than the organization's attachment retention, keeps the row flagged, and does nothing when retention is 0", async () => {
      const evidence = await sql<{ id: string; file_id: string }>("SELECT id, file_id FROM raqib_evidence WHERE removed_at IS NULL");
      expect(evidence.length).toBeGreaterThan(0);

      // default retention is 7 years: nothing from a year ago is touched
      expect((await runner.tick())?.evidencePurged).toBe(0);

      await sql("UPDATE raqib_settings SET data = jsonb_set(data, '{attach,retention}', '0')");
      nowMs = Date.parse("2040-01-01T00:00:00.000Z");
      expect((await runner.tick())?.evidencePurged).toBe(0); // 0 = keep forever

      await sql("UPDATE raqib_settings SET data = jsonb_set(data, '{attach,retention}', '1')");
      const report = await runner.tick();
      expect(report?.evidencePurged).toBe(evidence.length);
      const after = await sql<{ removed_at: Date | null; purged_at: Date | null }>("SELECT removed_at, purged_at FROM raqib_evidence");
      expect(after.every((e) => e.removed_at && e.purged_at)).toBe(true);
      const files = await sql("SELECT 1 FROM files WHERE id = ANY($1) AND deleted_at IS NULL", [evidence.map((e) => e.file_id)]);
      expect(files).toHaveLength(0);
      expect(await sql("SELECT 1 FROM audit_logs WHERE action = 'raqib.retention.evidence_purged'")).not.toHaveLength(0);
      expect((await runner.tick())?.evidencePurged).toBe(0); // idempotent
    });
  });

  describe("personal data export", () => {
    it("gives the quality manager one document about a person, audited, and refuses everyone else", async () => {
      for (const k of ["qm", "pm"]) tokens[k] = await loginAs(app, email(k)); // the clock moved on: earlier tokens have expired
      const users = (await call("qm", "/raqib/users?limit=100")).body.items as Json[];
      const ins = users.find((u) => u.email === email("insA"))!;
      const res = await call("qm", `/raqib/account/users/${ins.id}/personal-data`);
      expect(res.status).toBe(200);
      expect(res.body.profile).toMatchObject({ role: "ins" });
      expect(Array.isArray(res.body.visitsAsInspector)).toBe(true);
      expect(res.body.visitsAsInspector.length).toBeGreaterThan(0);
      expect(res.body.notIncluded).toMatch(/confidential/i);
      expect(JSON.stringify(res.body)).not.toContain("v1:"); // sealed values are opened for the subject
      expect((await call("pm", `/raqib/account/users/${ins.id}/personal-data`)).status).toBe(403);
      expect((await call("qm", "/raqib/account/users/usr_missing/personal-data")).status).toBe(404);
      expect(await sql("SELECT 1 FROM audit_logs WHERE action = 'raqib.personal_data.exported'")).toHaveLength(1);
    });
  });
});
