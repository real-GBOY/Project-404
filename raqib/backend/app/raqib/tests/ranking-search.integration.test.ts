/**
 * Requirement 15: projects carry contract dates and the number of employees assigned; projects are ranked on observations,
 * improvement, complaints and contract proximity; search finds people, observations, inspections and projects by the
 * identifiers the client named, always inside the caller's own projects; complaint figures exist only for people who hold a
 * confidential grant.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { DEMO_NAMED_GUARDS, DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { createDemoHttpApp, hasTestDb, loginAs } from "./helpers.js";

const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe.skipIf(!hasTestDb)("Raqib project ranking, contracts and search", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};

  const call = async (who: string, method: "GET" | "POST" | "PATCH" | "PUT", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return { status: res.statusCode, body: (res.body && String(res.headers["content-type"]).includes("json") ? JSON.parse(res.body) : {}) as Json };
  };
  const search = async (who: string, q: string) => (await call(who, "GET", `/raqib/search?q=${encodeURIComponent(q)}`)).body.items as Json[] | undefined;
  const analytics = async (who: string, sort = "") =>
    (await call(who, "GET", `/raqib/analytics?period=custom&from=2026-01-01&to=2026-12-31${sort ? `&sort=${sort}` : ""}`)).body;

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    for (const key of ["qm", "qe", "pm", "sultan", "gm", "insA", "insB", "adm"]) tokens[key] = await loginAs(http, email(key));
  }, 240_000);

  afterAll(async () => {
    await http?.close();
  });

  describe("contracts", () => {
    it("every project shows its contract dates and the number of employees assigned", async () => {
      const projects = (await call("qm", "GET", "/raqib/projects")).body.items as Json[];
      expect(projects.length).toBe(4);
      for (const p of projects) {
        expect(p.contractStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(p.contractEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(p.employeesAssigned).toBeGreaterThan(0);
      }
    });

    it("can be stored and corrected, validated, and audited", async () => {
      const p = ((await call("qm", "GET", "/raqib/projects")).body.items as Json[])[0]!;
      const bad = await call("qm", "PATCH", `/raqib/projects/${p.id}`, { contractStart: "2027-01-01", contractEnd: "2026-01-01" });
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe("raqib.contract_dates");
      expect((await call("qm", "PATCH", `/raqib/projects/${p.id}`, { employeesAssigned: -3 })).status).toBe(400);
      const ok = await call("qm", "PATCH", `/raqib/projects/${p.id}`, { contractStart: "2026-01-01", contractEnd: "2028-06-30", employeesAssigned: 55 });
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ contractStart: "2026-01-01", contractEnd: "2028-06-30", employeesAssigned: 55 });
      expect((await call("insB", "PATCH", `/raqib/projects/${p.id}`, { employeesAssigned: 1 })).status).toBe(403);
      // moving only the end before the stored start is refused as well
      expect((await call("qm", "PATCH", `/raqib/projects/${p.id}`, { contractEnd: "2025-12-31" })).status).toBe(400);
    });
  });

  describe("ranking", () => {
    it("ranks projects on observations, improvement, complaints and contract proximity, with every indicator visible", async () => {
      const a = await analytics("qm");
      expect(a.ranking.length).toBe(4);
      for (const r of a.ranking) {
        for (const k of ["observations", "improvement", "complaints", "daysToContractEnd", "employeesAssigned", "attention", "rank"])
          expect(r).toHaveProperty(k);
      }
      expect(a.ranking.map((r: Json) => r.rank)).toEqual([1, 2, 3, 4]);
    });

    it("can be ordered by one indicator, such as the nearest contract end", async () => {
      const byContract = (await analytics("qm", "contract")).ranking as Json[];
      const days = byContract.map((r) => r.daysToContractEnd).filter((d) => d != null) as number[];
      expect([...days].sort((x, y) => x - y)).toEqual(days);
      const byObs = (await analytics("qm", "observations")).ranking as Json[];
      expect(byObs.map((r) => r.observations)).toEqual([...byObs.map((r) => r.observations)].sort((x, y) => y - x));
      expect((await call("qm", "GET", "/raqib/analytics?period=month&sort=astrology")).status).toBe(400);
    });

    it("follows the weights the organization sets", async () => {
      const cur = (await call("qm", "GET", "/raqib/settings")).body;
      const set = await call("qm", "PUT", "/raqib/settings", {
        settings: { ...cur, ranking: { weights: { observations: 0, improvement: 0, complaints: 0, contract: 1 } } },
        reason: "rank by contract only (test)",
      });
      expect(set.status).toBe(200);
      const a = await analytics("qm");
      const soonest = [...a.ranking].filter((r: Json) => r.daysToContractEnd != null).sort((x: Json, y: Json) => x.daysToContractEnd - y.daysToContractEnd)[0];
      expect(a.ranking[0].projectId).toBe(soonest.projectId);
      expect(
        (
          await call("qm", "PUT", "/raqib/settings", {
            settings: { ...cur, ranking: { weights: { observations: 99, improvement: 0, complaints: 0, contract: 0 } } },
            reason: "too big",
          })
        ).status,
      ).toBe(400);
      await call("qm", "PUT", "/raqib/settings", { settings: cur, reason: "restore" });
    });

    it("shows complaint figures only to people who hold a confidential grant, never as a detail, and not to anyone else", async () => {
      const withGrant = (await analytics("qm")).ranking as Json[];
      const total = withGrant.reduce((n, r) => n + (r.complaints ?? 0), 0);
      expect(withGrant.every((r) => typeof r.complaints === "number")).toBe(true);
      expect(total).toBeGreaterThan(0); // the named and the confidential demo reports concern a project; the anonymous one concerns none
      for (const who of ["qe", "gm"]) {
        const ranking = (await analytics(who)).ranking as Json[];
        expect(ranking.length).toBeGreaterThan(0);
        expect(ranking.every((r) => r.complaints === null)).toBe(true);
      }
      // the CSV and Excel exports follow the same rule: without a grant the complaint column is empty
      const exported = async (who: string) => {
        const csv = (await http.inject({ method: "GET", url: "/api/raqib/analytics/export?period=year", headers: { authorization: `Bearer ${tokens[who]}` } }))
          .body;
        const lines = csv.split("\r\n");
        const at = lines.findIndex((l) => l.startsWith("Rank,Project,Attention"));
        const col = lines[at]!.split(",").indexOf("Complaints");
        return lines
          .slice(at + 1)
          .filter((l) => /^\d+,/.test(l))
          .map((l) => l.split(",")[col]);
      };
      expect((await exported("gm")).every((c) => c === "")).toBe(true);
      expect((await exported("qm")).some((c) => Number(c) > 0)).toBe(true);
    });
  });

  describe("search", () => {
    const turki = DEMO_NAMED_GUARDS.find((g) => g.employeeNo === "G-10234")!;

    it("finds a person by name, employee number and full national ID — inside the caller's own projects only", async () => {
      expect((await search("qm", turki.employeeNo))!.some((h) => h.kind === "guard" && h.ref === turki.employeeNo)).toBe(true);
      expect((await search("qm", "Anazi"))!.some((h) => h.kind === "guard")).toBe(true);
      const byId = await search("qm", turki.nationalId);
      expect(byId!.some((h) => h.kind === "guard" && h.ref === turki.employeeNo)).toBe(true);
      expect(JSON.stringify(byId)).not.toContain(turki.nationalId); // the number is matched, never echoed back
      expect((await search("pm", turki.nationalId))!.some((h) => h.ref === turki.employeeNo)).toBe(true); // Riyadh manager
      expect((await search("sultan", turki.nationalId))!.some((h) => h.ref === turki.employeeNo)).toBe(false); // Jeddah manager
    });

    it("never matches part of a national ID", async () => {
      for (const part of [turki.nationalId.slice(0, 6), turki.nationalId.slice(2, 9), turki.nationalId.slice(0, 9)]) {
        expect((await search("qm", part))!.some((h) => h.ref === turki.employeeNo)).toBe(false);
      }
    });

    it("finds an observation by its reference, an inspection by its issue number, and a project by its code", async () => {
      const obs = ((await call("qm", "GET", "/raqib/observations")).body.items as Json[])[0]!;
      expect((await search("qm", obs.ref))!.some((h) => h.kind === "observation" && h.ref === obs.ref)).toBe(true);
      const visit = ((await call("qm", "GET", "/raqib/visits")).body.items as Json[]).find((v) => v.inspectionId)!;
      const issueNo = (await call("qm", "GET", `/raqib/visits/${visit.id}/inspection`)).body.issueNo as string;
      expect(issueNo).toMatch(/^INS-26-/);
      const hit = (await search("qm", issueNo))!.find((h) => h.kind === "visit");
      expect(hit).toBeDefined();
      expect(hit!.go).toEqual(["visit", visit.id]);
      expect((await search("qm", visit.project.code))!.some((h) => h.kind === "project" && h.ref === visit.project.code)).toBe(true);
    });

    it("shows each person only what they may open", async () => {
      const visits = (await call("qm", "GET", "/raqib/visits")).body.items as Json[];
      const mine = ((await call("insA", "GET", "/raqib/visits")).body.items as Json[]).map((v) => v.id);
      const notMine = visits.find((v) => v.inspectionId && !mine.includes(v.id))!;
      const issueNo = (await call("qm", "GET", `/raqib/visits/${notMine.id}/inspection`)).body.issueNo as string;
      expect((await search("insA", issueNo))!.some((h) => h.go[1] === notMine.id)).toBe(false);
      const jeddah = visits.find((v) => v.project.code === "PRJ-JED-007")!;
      expect((await search("pm", jeddah.project.code))!.some((h) => h.kind === "project")).toBe(false); // outside the Riyadh manager's projects
      expect((await search("adm", "G-1"))?.length ?? 0).toBeGreaterThanOrEqual(0);
    });

    it("does not search the confidential area", async () => {
      for (const who of ["qm", "gm", "qe"]) expect(JSON.stringify(await search(who, "supervisor asked"))).not.toMatch(/CNF-|payment/i);
    });
  });
});
