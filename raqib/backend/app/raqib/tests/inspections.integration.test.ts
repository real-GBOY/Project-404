/**
 * Phase 3 — the inspection engine: form versions are immutable once published, starting an inspection snapshots
 * the form, answers follow ownership and lock rules, scoring and submission are enforced by the backend, and
 * evidence is private (presigned upload → link → authorized read only).
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

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

describe.skipIf(!hasTestDb)("Raqib forms & inspections", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};
  const TODAY = "2026-10-04";

  const call = async (who: string, method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return {
      status: res.statusCode,
      body: (res.body && res.headers["content-type"]?.toString().includes("json") ? JSON.parse(res.body) : {}) as Json,
      raw: res,
    };
  };
  const visitBy = async (pred: (v: Json) => boolean) => ((await call("qm", "GET", "/raqib/visits")).body.items as Json[]).find(pred)!;
  const forms = async () => (await call("qm", "GET", "/raqib/forms")).body.items as Json[];
  const formBy = async (code: string) => (await forms()).find((f) => f.code === code)!;

  /** The real upload path: presign → PUT to the returned URL → confirm. Returns the Core file id. */
  async function upload(who: string, name = "photo.png", type = "image/png", bytes: Buffer = PNG): Promise<string> {
    const p = await call(who, "POST", "/files/uploads", { originalName: name, contentType: type, byteSize: bytes.length });
    expect(p.status).toBe(201);
    const put = await http.inject({
      method: "PUT",
      url: `/api${p.body.upload.url}`,
      headers: { authorization: `Bearer ${tokens[who]}`, "content-type": "application/octet-stream" },
      payload: bytes,
    });
    expect(put.statusCode).toBe(204);
    expect((await call(who, "POST", `/files/${p.body.fileId}/confirm`)).status).toBe(200);
    return p.body.fileId as string;
  }

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock(`${TODAY}T08:00:00.000Z`) });
    http = booted.http;
    for (const key of ["qm", "qe", "pm", "insA", "insB", "gs", "guard"]) tokens[key] = await loginAs(http, email(key));
  }, 180_000);

  afterAll(async () => {
    await http?.close();
  });

  describe("forms and versions", () => {
    it("lists the demo forms with their version history and usage", async () => {
      const list = await forms();
      expect(list.map((f) => f.code).sort()).toEqual(["FRM-GRD-02", "FRM-HSP-01", "FRM-LOG-01", "FRM-SEC-01"]);
      const core = list.find((f) => f.code === "FRM-SEC-01")!;
      expect(core.versions.map((v: Json) => `${v.version}:${v.status}`)).toEqual(["2.2:draft", "2.1:published", "2.0:archived", "1.4:archived"]);
      expect(core.versions.find((v: Json) => v.version === "2.1").uses).toBeGreaterThan(0); // the in-progress demo inspection
      expect(core.diff.length).toBeGreaterThan(0);
    });

    it("limits the forms module to roles whose template grants it", async () => {
      for (const who of ["insA", "pm", "gs", "guard"]) expect((await call(who, "GET", "/raqib/forms")).status).toBe(403);
      expect((await call("qe", "GET", "/raqib/forms")).status).toBe(200);
    });

    it("never lets a published or archived version change — not in the API, not in the database", async () => {
      const core = await formBy("FRM-SEC-01");
      const hsp = await formBy("FRM-HSP-01");
      const res = await call("qm", "PUT", `/raqib/forms/${hsp.id}/draft`, { sections: [] });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("raqib.version_locked");
      await expect(ownerQuery(`UPDATE raqib_form_versions SET sections = '[]' WHERE status = 'published'`)).rejects.toThrow(/immutable/);
      await expect(ownerQuery(`UPDATE raqib_form_versions SET status = 'draft' WHERE status = 'archived'`)).rejects.toThrow(/immutable/);
      await expect(ownerQuery(`DELETE FROM raqib_form_versions WHERE status = 'published'`)).rejects.toThrow(/cannot be deleted/);
      expect(core.versions.length).toBe(4);
    });

    it("lets editors build a draft but only approvers publish it; publishing archives the old version", async () => {
      const hsp = await formBy("FRM-HSP-01");
      const draft = await call("qe", "POST", `/raqib/forms/${hsp.id}/versions`);
      expect(draft.status).toBe(201);
      expect(draft.body.versions[0]).toMatchObject({ version: "1.1", status: "draft" });
      const sections = draft.body.versions[0].sections as Json[];
      sections[0].items[0].weight = 2;
      expect((await call("qe", "PUT", `/raqib/forms/${hsp.id}/draft`, { sections })).status).toBe(200);
      expect((await call("qe", "POST", `/raqib/forms/${hsp.id}/publish`, { reason: "Lower the weight" })).status).toBe(403); // review ≠ approve
      const pub = await call("qm", "POST", `/raqib/forms/${hsp.id}/publish`, { reason: "Lower the weight of visitor control" });
      expect(pub.status).toBe(200);
      expect(pub.body.versions.map((v: Json) => `${v.version}:${v.status}`)).toEqual(["1.1:published", "1.0:archived"]);
      expect(pub.body.diff).toEqual([]);
    });

    it("refuses to publish an incomplete draft and a second draft", async () => {
      const created = await call("qm", "POST", "/raqib/forms", { code: "FRM-TST-01", category: "site", name: { ar: "اختبار", en: "Test" } });
      expect(created.status).toBe(201);
      const pub = await call("qm", "POST", `/raqib/forms/${created.body.id}/publish`, { reason: "Too early" });
      expect(pub.status).toBe(400);
      expect(pub.body.error.code).toBe("raqib.form_incomplete");
      expect((await call("qm", "POST", `/raqib/forms/${created.body.id}/versions`)).status).toBe(409); // a draft already exists
      expect((await call("qm", "POST", "/raqib/forms", { code: "FRM-TST-01", category: "site", name: { ar: "اختبار", en: "Test" } })).status).toBe(409);
    });
  });

  describe("an in-progress inspection (demo: main gate)", () => {
    it("shows the inspector their snapshot of the form with live scoring and the blocking issues", async () => {
      const v = await visitBy((x) => x.ref && x.site.name.en === "Main Gate");
      const res = await call("insA", "GET", `/raqib/visits/${v.id}/inspection`);
      expect(res.status).toBe(200);
      expect(res.body.form).toMatchObject({ code: "FRM-SEC-01", version: "2.1" });
      expect(res.body.sections).toHaveLength(5);
      expect(res.body.sections.flatMap((s: Json) => s.items)).toHaveLength(16);
      expect(res.body.score).toMatchObject({ pct: 67, answered: 4, compliant: 3, nonCompliant: 1 }); // 6 of 9 weight
      expect(res.body.editable).toBe(true);
      const codes = (res.body.issues as Json[]).map((i) => i.code);
      expect(codes).toContain("unanswered");
      expect(res.body.guardCriteria).toHaveLength(5);
      expect(res.body.guards).toHaveLength(2);
    });

    it("keeps the inspection on its form version when a newer one is published", async () => {
      const core = await formBy("FRM-SEC-01");
      const before = await visitBy((x) => x.site.name.en === "Main Gate");
      const pub = await call("qm", "POST", `/raqib/forms/${core.id}/publish`, { reason: "Radio test and checkpoint weight" });
      expect(pub.status).toBe(200);
      expect(pub.body.versions[0]).toMatchObject({ version: "2.2", status: "published" });
      const res = await call("insA", "GET", `/raqib/visits/${before.id}/inspection`);
      expect(res.body.form.version).toBe("2.1");
      expect(res.body.sections.flatMap((s: Json) => s.items)).toHaveLength(16); // 2.2 has 17
      const rows = await ownerQuery<{ n: string }>(`SELECT count(*)::text AS n FROM raqib_inspection_items WHERE kind = 'site' AND item_key = 'q17'`);
      expect(rows[0]!.n).toBe("0");
      await expect(ownerQuery(`UPDATE raqib_inspection_items SET weight = 9`)).rejects.toThrow(/immutable/);
    });

    it("lets only the owning inspector edit; reviewers can read, others cannot", async () => {
      const v = await visitBy((x) => x.site.name.en === "Main Gate");
      const res = await call("insA", "GET", `/raqib/visits/${v.id}/inspection`);
      const item = res.body.sections[0].items[3]; // q4
      expect((await call("insB", "GET", `/raqib/visits/${v.id}/inspection`)).status).toBe(403);
      expect((await call("insB", "PUT", `/raqib/visits/${v.id}/inspection/answers/${item.id}`, { value: "c" })).status).toBe(403);
      expect((await call("pm", "GET", `/raqib/visits/${v.id}/inspection`)).status).toBe(403); // results reach managers only after approval
      expect((await call("qe", "GET", `/raqib/visits/${v.id}/inspection`)).status).toBe(200);
      expect((await call("qe", "PUT", `/raqib/visits/${v.id}/inspection/answers/${item.id}`, { value: "c" })).status).toBe(403);
      expect((await call("guard", "GET", `/raqib/visits/${v.id}/inspection`)).status).toBe(403);
    });

    it("validates answers", async () => {
      const v = await visitBy((x) => x.site.name.en === "Main Gate");
      const item = (await call("insA", "GET", `/raqib/visits/${v.id}/inspection`)).body.sections[0].items[0];
      expect((await call("insA", "PUT", `/raqib/visits/${v.id}/inspection/answers/${item.id}`, { value: "maybe" })).status).toBe(400);
      expect((await call("insA", "PUT", `/raqib/visits/${v.id}/inspection/answers/${item.id}`, {})).status).toBe(400);
      expect((await call("insA", "PUT", `/raqib/visits/${v.id}/inspection/answers/nope`, { value: "c" })).status).toBe(404);
    });

    it("refuses to submit while anything blocks it, naming each issue", async () => {
      const v = await visitBy((x) => x.site.name.en === "Main Gate");
      const res = await call("insA", "POST", `/raqib/visits/${v.id}/inspection/submit`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("raqib.cannot_submit");
      expect((res.body.error.details.issues as Json[]).length).toBeGreaterThan(10);
    });
  });

  describe("completing and submitting an inspection (demo: level P2 parking)", () => {
    let visitId = "";
    let view: Json;

    it("starts only for the assigned inspector, snapshotting the current published forms", async () => {
      const v = await visitBy((x) => x.site.name.en === "Parking structure");
      visitId = v.id;
      expect((await call("insB", "POST", `/raqib/visits/${visitId}/inspection/start`)).status).toBe(403);
      expect((await call("qe", "POST", `/raqib/visits/${visitId}/inspection/start`)).status).toBe(403);
      const started = await call("insA", "POST", `/raqib/visits/${visitId}/inspection/start`);
      expect(started.status).toBe(200);
      view = started.body;
      expect(view.form.version).toBe("2.2");
      expect(view.sections.flatMap((s: Json) => s.items)).toHaveLength(17);
      expect((await call("insA", "GET", `/raqib/visits/${visitId}`)).body.storedStatus).toBe("in_progress");
      // idempotent
      expect((await call("insA", "POST", `/raqib/visits/${visitId}/inspection/start`)).body.id).toBe(view.id);
    });

    it("rejects N/A on an item that does not allow it", async () => {
      const q17 = view.sections.flatMap((s: Json) => s.items).find((i: Json) => i.key === "q17");
      const res = await call("insA", "PUT", `/raqib/visits/${visitId}/inspection/answers/${q17.id}`, { value: "x" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("raqib.na_not_allowed");
    });

    it("answers everything, requires a note and stored evidence for the non-compliance, and evaluates the guard", async () => {
      const items: Json[] = view.sections.flatMap((s: Json) => s.items);
      for (const it of items) {
        const value = it.key === "q9" ? "n" : "c";
        const r = await call("insA", "PUT", `/raqib/visits/${visitId}/inspection/answers/${it.id}`, { value });
        expect(r.status).toBe(200);
      }
      let cur = (await call("insA", "GET", `/raqib/visits/${visitId}/inspection`)).body;
      const codes = (cur.issues as Json[]).map((i) => `${i.code}:${i.at}`);
      expect(codes).toContain("note_required:3.2");
      expect(codes).toContain("evidence_required:3.2");
      expect(codes.some((c) => c.startsWith("guard_incomplete"))).toBe(true);

      const q9 = items.find((i) => i.key === "q9")!;
      await call("insA", "PUT", `/raqib/visits/${visitId}/inspection/answers/${q9.id}`, { note: "3 of 14 checkpoints were not scanned" });
      const fileId = await upload("insA");
      const att = await call("insA", "POST", "/raqib/evidence", { fileId, inspectionId: cur.id, itemId: q9.id });
      expect(att.status).toBe(201);

      const g = cur.guards[0];
      for (const c of cur.guardCriteria as Json[]) {
        expect((await call("insA", "PUT", `/raqib/visits/${visitId}/inspection/guards/${g.guardId}/scores/${c.id}`, { score: 4 })).status).toBe(200);
      }
      expect(
        (await call("insA", "PUT", `/raqib/visits/${visitId}/inspection/guards/${g.guardId}/scores/${cur.guardCriteria[0].id}`, { score: 6 })).status,
      ).toBe(400);
      cur = (await call("insA", "GET", `/raqib/visits/${visitId}/inspection`)).body;
      expect(cur.issues).toEqual([]);
      expect(cur.guards[0]).toMatchObject({ done: true, pct: 80 });
      expect(cur.score.pct).toBe(92); // 35 of 38 weight in v2.2 (q9 is non-compliant, weight 3)
    });

    it("keeps evidence private: only people who may read the inspection can read it, never by file id", async () => {
      const cur = (await call("insA", "GET", `/raqib/visits/${visitId}/inspection`)).body;
      const ev = cur.sections.flatMap((s: Json) => s.items).find((i: Json) => i.evidence.length).evidence[0];
      const mine = await call("insA", "GET", `/raqib/evidence/${ev.id}/content`);
      expect(mine.status).toBe(200);
      expect(Buffer.from(mine.raw.rawPayload).equals(PNG)).toBe(true);
      expect((await call("qe", "GET", `/raqib/evidence/${ev.id}/content`)).status).toBe(200);
      for (const who of ["insB", "pm", "guard"]) expect((await call(who, "GET", `/raqib/evidence/${ev.id}/content`)).status).toBe(403);
      expect((await http.inject({ method: "GET", url: `/api/raqib/evidence/${ev.id}/content` })).statusCode).toBe(401);
      // The raw Core download route is closed to everyone but the uploader — a leaked file id gives nothing.
      const rows = await ownerQuery<{ file_id: string }>(`SELECT file_id FROM raqib_evidence WHERE id = $1`, [ev.id]);
      expect((await call("qe", "GET", `/files/${rows[0]!.file_id}`)).status).toBe(403);
      expect((await call("qm", "GET", `/files/${rows[0]!.file_id}`)).status).toBe(403);
      const audit = await ownerQuery(`SELECT 1 FROM audit_logs WHERE action = 'raqib.evidence.downloaded'`);
      expect(audit.length).toBeGreaterThan(0);
    });

    it("only links files that landed, that the person uploaded, and that are photos, videos or PDFs", async () => {
      const cur = (await call("insA", "GET", `/raqib/visits/${visitId}/inspection`)).body;
      const item = cur.sections[0].items[0];
      const other = await upload("insB");
      expect((await call("insA", "POST", "/raqib/evidence", { fileId: other, inspectionId: cur.id, itemId: item.id })).status).toBe(403);
      const pending = await call("insA", "POST", "/files/uploads", { originalName: "p.png", contentType: "image/png", byteSize: PNG.length });
      expect((await call("insA", "POST", "/raqib/evidence", { fileId: pending.body.fileId, inspectionId: cur.id, itemId: item.id })).status).toBe(409);
      const text = await upload("insA", "notes.txt", "text/plain", Buffer.from("hello"));
      const res = await call("insA", "POST", "/raqib/evidence", { fileId: text, inspectionId: cur.id, itemId: item.id });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("raqib.file_type_not_allowed");
      expect((await call("insA", "POST", "/raqib/evidence", { fileId: "file_missing", inspectionId: cur.id, itemId: item.id })).status).toBe(404);
    });

    it("submits, stores the score, locks the inspection and tells the reviewers (not the submitter)", async () => {
      const res = await call("insA", "POST", `/raqib/visits/${visitId}/inspection/submit`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("pending_review");
      expect(res.body.editable).toBe(false);
      const row = await ownerQuery<{ score_pct: number; counts: Json }>(`SELECT score_pct, counts FROM raqib_inspections WHERE visit_id = $1`, [visitId]);
      expect(row[0]!.score_pct).toBe(92);
      const item = res.body.sections[0].items[0];
      expect((await call("insA", "PUT", `/raqib/visits/${visitId}/inspection/answers/${item.id}`, { value: "n" })).status).toBe(409);
      expect((await call("insA", "POST", `/raqib/visits/${visitId}/inspection/submit`)).status).toBe(409);
      const v = (await call("qm", "GET", `/raqib/visits/${visitId}`)).body;
      expect(v.history.map((h: Json) => h.action)).toEqual(["scheduled", "assigned", "started", "submitted"]);
      expect(v.history.at(-1).actor.role).toBe("ins");
      const qe = ((await call("qe", "GET", "/notifications")).body.notifications as Json[]).find((n) => n.type === "raqib.inspection_submitted");
      expect(qe?.data.go).toEqual(["review", visitId]);
      expect(((await call("insA", "GET", "/notifications")).body.notifications as Json[]).some((n) => n.type === "raqib.inspection_submitted")).toBe(false);
    });

    it("cannot remove evidence from a locked inspection", async () => {
      const cur = (await call("insA", "GET", `/raqib/visits/${visitId}/inspection`)).body;
      const ev = cur.sections.flatMap((s: Json) => s.items).find((i: Json) => i.evidence.length).evidence[0];
      expect((await call("insA", "DELETE", `/raqib/evidence/${ev.id}`)).status).toBe(409);
    });
  });
});
