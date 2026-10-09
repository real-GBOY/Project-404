/**
 * Deduction scoring: only the General Manager names who may publish the rules, only that person can publish, every
 * publish is an immutable version, an inspection keeps the version it started under, a violation deducts once,
 * and an inspector never receives the score.
 */
import pg from "pg";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { TEST_DATABASE_URL } from "@core/tests/helpers.js";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { createDemoHttpApp, hasTestDb, loginAs } from "./helpers.js";

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

describe.skipIf(!hasTestDb)("Raqib deduction scoring", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};
  const TODAY = "2026-10-04";
  let qmId = "";

  const call = async (who: string, method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return { status: res.statusCode, body: (res.body && res.headers["content-type"]?.toString().includes("json") ? JSON.parse(res.body) : {}) as Json };
  };

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock(`${TODAY}T08:00:00.000Z`) });
    http = booted.http;
    for (const key of ["qm", "qe", "pm", "insA", "gm"]) tokens[key] = await loginAs(http, email(key));
    qmId = (await call("qm", "GET", "/raqib/me")).body.id;
  }, 180_000);

  afterAll(async () => {
    await http?.close();
  });

  const rules = { bySeverity: { low: 2, medium: 5, high: 10 }, byItem: { q9: 12 }, reason: "Initial approved table" };

  it("starts unconfigured, so the earlier policy keeps scoring", async () => {
    const o = (await call("qm", "GET", "/raqib/scoring")).body;
    expect(o.current).toBeNull();
    expect(o.canPublish).toBe(false);
    expect((await call("insA", "GET", "/raqib/scoring")).status).toBe(403);
  });

  it("lets nobody publish until the General Manager has named them", async () => {
    for (const who of ["qm", "qe", "pm", "insA", "gm"]) {
      const r = await call(who, "PUT", "/raqib/scoring", rules);
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe("raqib.not_scoring_admin");
    }
  });

  it("lets only the General Manager name or release the designated person", async () => {
    for (const who of ["qm", "qe", "pm", "insA"]) {
      const r = await call(who, "POST", "/raqib/scoring/designees", { userId: qmId });
      expect(r.status).toBe(403);
    }
    // only the General Manager is told who could be named
    const forGm = (await call("gm", "GET", "/raqib/scoring")).body;
    expect(forGm.candidates.map((c: Json) => c.userId)).toContain(qmId);
    expect((await call("qm", "GET", "/raqib/scoring")).body.candidates).toEqual([]);
    expect((await call("gm", "POST", "/raqib/scoring/designees", { userId: "usr_missing" })).status).toBe(404);
    expect((await call("gm", "POST", "/raqib/scoring/designees", { userId: qmId })).status).toBe(204);
    expect((await call("gm", "POST", "/raqib/scoring/designees", { userId: qmId })).status).toBe(409);
    expect((await call("qm", "GET", "/raqib/scoring")).body).toMatchObject({ canPublish: true });
  });

  it("publishes immutable, numbered versions with a reason, and records who and what changed", async () => {
    expect((await call("qm", "PUT", "/raqib/scoring", { ...rules, reason: "" })).status).toBe(400);
    expect((await call("qm", "PUT", "/raqib/scoring", { bySeverity: { high: 120 }, byItem: {}, reason: "too big" })).status).toBe(400);
    expect((await call("qm", "PUT", "/raqib/scoring", { bySeverity: {}, byItem: {}, reason: "nothing at all" })).status).toBe(400);
    const v1 = await call("qm", "PUT", "/raqib/scoring", rules);
    expect(v1.status).toBe(200);
    expect(v1.body).toMatchObject({ version: 1, base: 100, bySeverity: { high: 10 }, byItem: { q9: 12 } });
    await expect(ownerQuery(`UPDATE raqib_scoring_configs SET base_score = 90 WHERE version = 1`)).rejects.toThrow(/immutable/);
    await expect(ownerQuery(`DELETE FROM raqib_scoring_configs WHERE version = 1`)).rejects.toThrow(/immutable/);
    const audit = await ownerQuery<{ action: string }>(`SELECT action FROM audit_logs WHERE action = 'raqib.scoring.published'`);
    expect(audit).toHaveLength(1);
  });

  describe("an inspection scored under version 1", () => {
    let visitId = "";
    let inspectionId = "";

    it("pins the version at start and scores 100 minus the deductions", async () => {
      const visit = ((await call("qm", "GET", "/raqib/visits")).body.items as Json[]).find((x) => x.site.name.en === "Parking structure")!;
      visitId = visit.id;
      const started = (await call("insA", "POST", `/raqib/visits/${visitId}/inspection/start`)).body;
      inspectionId = started.id;
      const pinned = await ownerQuery<{ scoring_policy: string; scoring_config_id: string | null }>(
        `SELECT scoring_policy, scoring_config_id FROM raqib_inspections WHERE id = $1`,
        [inspectionId],
      );
      expect(pinned[0]).toMatchObject({ scoring_policy: "deduction_v1" });
      expect(pinned[0]!.scoring_config_id).toBeTruthy();

      const items: Json[] = started.sections.flatMap((s: Json) => s.items);
      for (const it of items) await call("insA", "PUT", `/raqib/visits/${visitId}/inspection/answers/${it.id}`, { value: it.key === "q9" ? "n" : "c" });
      const q9 = items.find((i) => i.key === "q9")!;
      await call("insA", "PUT", `/raqib/visits/${visitId}/inspection/answers/${q9.id}`, { note: "3 of 14 checkpoints were not scanned", severity: "high" });
      const fileId = await upload("insA");
      expect((await call("insA", "POST", "/raqib/evidence", { fileId, inspectionId, itemId: q9.id })).status).toBe(201);
      const cur = (await call("insA", "GET", `/raqib/visits/${visitId}/inspection`)).body;
      for (const c of cur.guardCriteria as Json[]) {
        await call("insA", "PUT", `/raqib/visits/${visitId}/inspection/guards/${cur.guards[0].guardId}/scores/${c.id}`, { score: 4 });
      }
    });

    it("keeps the percentage away from the inspector but shows it to the reviewer", async () => {
      const mine = (await call("insA", "GET", `/raqib/visits/${visitId}/inspection`)).body;
      expect(mine.score.visible).toBe(false);
      expect(mine.score.pct).toBeNull();
      expect(mine.score.deductions).toBeUndefined();
      expect(mine.score.nonCompliant).toBe(1);
      const theirs = (await call("qe", "GET", `/raqib/visits/${visitId}/inspection`)).body;
      expect(theirs.score.visible).toBe(true);
      expect(theirs.score.pct).toBe(88); // the item amount (12) overrides the high-severity amount (10)
      expect(theirs.score.deductions).toHaveLength(1);
    });

    it("stores one deduction per violation when submitted, and lists no score for the inspector", async () => {
      const res = await call("insA", "POST", `/raqib/visits/${visitId}/inspection/submit`);
      expect(res.status).toBe(200);
      expect(res.body.score.pct).toBeNull();
      const rows = await ownerQuery<{ item_key: string; amount: number }>(`SELECT item_key, amount FROM raqib_inspection_deductions WHERE inspection_id = $1`, [
        inspectionId,
      ]);
      expect(rows).toEqual([{ item_key: "q9", amount: 12 }]);
      await expect(
        ownerQuery(
          `INSERT INTO raqib_inspection_deductions (organization_id, inspection_id, item_id, item_key, amount, config_id)
           SELECT organization_id, inspection_id, item_id, item_key, amount, config_id FROM raqib_inspection_deductions WHERE inspection_id = $1`,
          [inspectionId],
        ),
      ).rejects.toThrow(/duplicate key/);
      const stored = await ownerQuery<{ score_pct: number }>(`SELECT score_pct FROM raqib_inspections WHERE id = $1`, [inspectionId]);
      expect(stored[0]!.score_pct).toBe(88);
      const list = ((await call("insA", "GET", "/raqib/visits")).body.items as Json[]).find((v) => v.id === visitId)!;
      expect(list.scorePct).toBeNull();
      const forQm = ((await call("qm", "GET", "/raqib/visits")).body.items as Json[]).find((v) => v.id === visitId)!;
      expect(forQm.scorePct).toBe(88);
    });

    it("leaves a submitted inspection on its version when newer rules are published", async () => {
      const v2 = await call("qm", "PUT", "/raqib/scoring", { bySeverity: { high: 30 }, byItem: { q9: 40 }, reason: "Stricter table" });
      expect(v2.body.version).toBe(2);
      const theirs = (await call("qe", "GET", `/raqib/visits/${visitId}/inspection`)).body;
      expect(theirs.score.pct).toBe(88);
      const history = (await call("qm", "GET", "/raqib/scoring")).body;
      expect(history.history.map((h: Json) => h.version)).toEqual([2, 1]);
    });
  });

  describe("corrections of system-generated data", () => {
    const url = (id: string) => `/raqib/inspections/${id}/corrections`;
    let inspectionId = "";

    it("refuses anyone without the right, and requires a reason", async () => {
      inspectionId = (
        await ownerQuery<{ id: string }>(`SELECT id FROM raqib_inspections WHERE submitted_at IS NOT NULL AND scoring_config_id IS NOT NULL LIMIT 1`)
      )[0]!.id;
      const body = { field: "deduction_amount", value: 5, itemKey: "q9", reason: "Rule applied to the wrong item" };
      expect((await call("insA", "POST", url(inspectionId), body)).status).toBe(403); // an inspector can never correct anything
      expect((await call("qe", "POST", url(inspectionId), body)).status).toBe(403); // not the scoring designee
      expect((await call("qm", "POST", url(inspectionId), { ...body, reason: " " })).status).toBe(400);
      expect((await call("qe", "POST", url(inspectionId), { field: "started_at", value: "2026-10-04T05:00:00Z", reason: "device clock" })).status).toBe(403); // review, not approve
    });

    it("corrects a deduction, recomputes the stored result, and keeps previous and new value", async () => {
      const res = await call("qm", "POST", url(inspectionId), { field: "deduction_amount", value: 5, itemKey: "q9", reason: "Rule applied to the wrong item" });
      expect(res.status).toBe(201);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        field: "deduction_amount",
        itemKey: "q9",
        previous: "12",
        next: "5",
        reason: "Rule applied to the wrong item",
        by: { role: "qm" },
      });
      expect((await ownerQuery<{ score_pct: number }>(`SELECT score_pct FROM raqib_inspections WHERE id = $1`, [inspectionId]))[0]!.score_pct).toBe(95);
      expect((await call("qm", "POST", url(inspectionId), { field: "deduction_amount", value: 5, itemKey: "nope", reason: "no such item" })).status).toBe(404);
      expect((await call("qm", "POST", url(inspectionId), { field: "deduction_amount", value: 250, itemKey: "q9", reason: "too many points" })).status).toBe(
        400,
      );
    });

    it("corrects a recorded time within sensible limits, and the history only grows", async () => {
      const earlier = "2026-10-04T05:00:00.000Z"; // before the pinned test clock (2026-10-04T08:00Z)
      const ok = await call("qm", "POST", url(inspectionId), { field: "started_at", value: earlier, reason: "Device clock was an hour fast" });
      expect(ok.status).toBe(201);
      expect(ok.body.items).toHaveLength(2);
      expect(ok.body.items[1]).toMatchObject({ field: "started_at", next: earlier });
      expect((await call("qm", "POST", url(inspectionId), { field: "started_at", value: "2099-01-01T00:00:00Z", reason: "from the future" })).status).toBe(400);
      expect((await call("qm", "POST", url(inspectionId), { field: "submitted_at", value: "2000-01-01T00:00:00Z", reason: "before it started" })).status).toBe(
        400,
      );
      expect((await call("qe", "GET", url(inspectionId))).body.items).toHaveLength(2);
      expect((await call("insA", "GET", url(inspectionId))).status).toBe(403);
      await expect(ownerQuery(`UPDATE raqib_corrections SET reason = 'edited' WHERE inspection_id = $1`, [inspectionId])).rejects.toThrow(/immutable/);
      await expect(ownerQuery(`DELETE FROM raqib_corrections WHERE inspection_id = $1`, [inspectionId])).rejects.toThrow(/immutable/);
    });
  });

  it("stops a released designee from publishing", async () => {
    expect((await call("qe", "DELETE", `/raqib/scoring/designees/${qmId}`)).status).toBe(403);
    expect((await call("gm", "DELETE", `/raqib/scoring/designees/${qmId}`)).status).toBe(204);
    expect((await call("qm", "PUT", "/raqib/scoring", rules)).status).toBe(403);
    expect((await call("gm", "DELETE", `/raqib/scoring/designees/${qmId}`)).status).toBe(404);
  });

  // the real upload path: presign → PUT → confirm
  async function upload(who: string): Promise<string> {
    const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    const p = await call(who, "POST", "/files/uploads", { originalName: "photo.png", contentType: "image/png", byteSize: PNG.length });
    const put = await http.inject({
      method: "PUT",
      url: `/api${p.body.upload.url}`,
      headers: { authorization: `Bearer ${tokens[who]}`, "content-type": "application/octet-stream" },
      payload: PNG,
    });
    expect(put.statusCode).toBe(204);
    expect((await call(who, "POST", `/files/${p.body.fileId}/confirm`)).status).toBe(200);
    return p.body.fileId as string;
  }
});
