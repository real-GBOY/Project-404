/**
 * Phase 7 — analytics computed from persisted data, scoped to what the caller may see, exportable with the export
 * right, plus scope- and permission-filtered search that never reaches confidential material.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { createDemoHttpApp, hasTestDb, loginAs } from "./helpers.js";

const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe.skipIf(!hasTestDb)("Raqib analytics and search", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};
  const call = async (who: string, url: string) => {
    const res = await http.inject({ method: "GET", url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` } });
    return {
      status: res.statusCode,
      body: (res.body && String(res.headers["content-type"]).includes("json") ? JSON.parse(res.body) : {}) as Json,
      text: res.body,
      headers: res.headers,
    };
  };
  const kpi = (r: Json, key: string) => (r.kpis as Json[]).find((k) => k.key === key)!;

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    for (const key of ["qm", "qe", "pm", "sultan", "gm", "insA", "gs"]) tokens[key] = await loginAs(http, email(key));
  }, 240_000);

  afterAll(async () => {
    await http?.close();
  });

  describe("analytics", () => {
    it("is computed from the issued reports, visits, observations and actions", async () => {
      const r = (await call("qm", "/raqib/analytics?period=year")).body;
      expect(r.range.to).toBe("2026-10-04");
      expect(kpi(r, "inspections").value).toBe(3);
      expect(kpi(r, "compliance").value).toBeGreaterThan(0);
      expect(kpi(r, "compliance").contributors).toHaveLength(3);
      expect(kpi(r, "overdueActions").value).toBe(1);
      expect(r.sites.length).toBeGreaterThanOrEqual(3);
      expect(r.sections.length).toBeGreaterThan(0);
      const stage = (s: string) => r.actionStages.find((x: Json) => x.stage === s).n;
      expect(stage("closed")).toBe(1);
      expect(stage("overdue")).toBe(1);
      expect(r.guardBuckets.reduce((s: number, b: Json) => s + b.n, 0)).toBeGreaterThan(0);
    });

    it("respects the date range", async () => {
      const r = (await call("qm", "/raqib/analytics?period=custom&from=2026-09-01&to=2026-09-02")).body;
      expect(kpi(r, "inspections").value).toBe(0);
      expect(kpi(r, "compliance").value).toBeNull();
      expect((await call("qm", "/raqib/analytics?period=custom&from=2026-09-05&to=2026-09-01")).status).toBe(400);
      expect((await call("qm", "/raqib/analytics?period=custom&from=2020-01-01&to=2026-09-01")).status).toBe(400);
      expect((await call("qm", "/raqib/analytics?period=decade")).status).toBe(400);
    });

    it("applies project scope before computing anything", async () => {
      const all = (await call("qm", "/raqib/analytics?period=year")).body;
      const pm = (await call("pm", "/raqib/analytics?period=year")).body;
      const sultan = (await call("sultan", "/raqib/analytics?period=year")).body;
      expect(kpi(pm, "inspections").value).toBeLessThan(kpi(all, "inspections").value);
      expect(pm.sites.every((s: Json) => s.project.en === "Al-Waha Business Park")).toBe(true);
      expect(sultan.sites.every((s: Json) => s.project.en === "Jeddah Logistics Hub")).toBe(true);
      expect(kpi(pm, "inspections").value + kpi(sultan, "inspections").value).toBeLessThanOrEqual(kpi(all, "inspections").value);
      // a project outside the scope is refused, not silently empty
      const projects = (await call("qm", "/raqib/projects")).body.items as Json[];
      const jed = projects.find((p) => p.code === "PRJ-JED-007")!;
      expect((await call("pm", `/raqib/analytics?period=year&projectId=${jed.id}`)).status).toBe(403);
      expect((await call("insA", "/raqib/analytics")).status).toBe(403);
    });

    it("offers the same figures as a real Excel workbook, behind the same export right", async () => {
      const ok = await call("qm", "/raqib/analytics/export.xlsx?period=year");
      expect(ok.status).toBe(200);
      expect(String(ok.headers["content-type"])).toContain("spreadsheetml.sheet");
      expect(ok.text.slice(0, 2)).toBe("PK");
      expect(ok.text).toContain("compliance");
      expect((await call("qe", "/raqib/analytics/export.xlsx?period=year")).status).toBe(403);
    });

    it("exports CSV only with the export right, and neutralizes formulas", async () => {
      const ok = await call("qm", "/raqib/analytics/export?period=year");
      expect(ok.status).toBe(200);
      expect(String(ok.headers["content-type"])).toContain("text/csv");
      expect(ok.text.startsWith("﻿")).toBe(true);
      expect(ok.text).toContain("compliance");
      expect((await call("qe", "/raqib/analytics/export?period=year")).status).toBe(403); // view only
      const { csvField } = await import("@raqib/raqib/analytics/application/analytics-service.js");
      expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
      expect(csvField("a,b")).toBe('"a,b"');
    });
  });

  describe("search", () => {
    it("finds records the caller can read, across kinds", async () => {
      const r = (await call("qm", "/raqib/search?q=Truck")).body.items as Json[];
      const kinds = new Set(r.map((x) => x.kind));
      expect(kinds.has("visit") || kinds.has("report") || kinds.has("action")).toBe(true);
      expect(r.every((x) => Array.isArray(x.go) && x.go.length === 2)).toBe(true);
      expect(((await call("qm", "/raqib/search?q=G-10251")).body.items as Json[]).some((x) => x.kind === "guard")).toBe(true);
      expect((await call("qm", "/raqib/search?q=a")).body.items).toEqual([]); // too short
    });

    it("never shows what the caller's scope or permissions exclude", async () => {
      const all = (await call("qm", "/raqib/search?q=Truck")).body.items as Json[];
      expect(all.length).toBeGreaterThan(0);
      const pm = (await call("pm", "/raqib/search?q=Truck")).body.items as Json[];
      expect(pm).toEqual([]); // Jeddah is outside this manager's scope
      const sultan = (await call("sultan", "/raqib/search?q=Truck")).body.items as Json[];
      expect(sultan.length).toBeGreaterThan(0);
      // an inspector sees visits, not users, actions or reports
      const ins = (await call("insA", "/raqib/search?q=Tower")).body.items as Json[];
      expect(ins.every((x) => ["visit", "project"].includes(x.kind))).toBe(true);
    });
  });
});
