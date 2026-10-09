/**
 * Shifts are configuration and scheduling rules are the organization's to set: with no rule configured nothing is
 * enforced (the client's values are not built in); once set, the backend rejects violating assignments.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { createDemoHttpApp, hasTestDb, loginAs } from "./helpers.js";

const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe.skipIf(!hasTestDb)("Raqib scheduling rules and shifts", () => {
  let http: NestFastifyApplication;
  const tokens: Record<string, string> = {};
  let base: { projectId: string; siteId: string; inspectorId: string };

  const call = async (who: string, method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: unknown) => {
    const res = await http.inject({ method, url: `/api${url}`, headers: { authorization: `Bearer ${tokens[who]}` }, payload: payload as never });
    return {
      status: res.statusCode,
      body: (res.body && res.headers["content-type"]?.toString().includes("json") ? JSON.parse(res.body) : {}) as Json,
      text: res.body,
    };
  };
  const visit = (date: string, time: string, shift: string) => ({ ...base, type: "routine", shift, date, time, guardIds: [], reason: "scheduling test" });
  const setSchedule = async (patch: Json) => {
    const cur = (await call("qm", "GET", "/raqib/settings")).body;
    return call("qm", "PUT", "/raqib/settings", { settings: { ...cur, schedule: { ...cur.schedule, ...patch } }, reason: "scheduling test" });
  };

  beforeAll(async () => {
    const booted = await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") });
    http = booted.http;
    for (const key of ["qm", "qe", "insA", "adm"]) tokens[key] = await loginAs(http, email(key));
    const mine = ((await call("qm", "GET", "/raqib/visits")).body.items as Json[]).find((v) => v.inspector?.name.en === "Khalid Al-Shehri")!;
    base = { projectId: mine.project.id, siteId: mine.site.id, inspectorId: mine.inspector.id };
  }, 180_000);

  afterAll(async () => {
    await http?.close();
  });

  it("starts with the three shifts visits already use, without invented hours, and no rule", async () => {
    const s = (await call("qm", "GET", "/raqib/settings")).body.schedule;
    expect(s.shifts.map((x: Json) => x.key)).toEqual(["morning", "evening", "night"]);
    expect(s.shifts.every((x: Json) => x.start === "" && x.end === "")).toBe(true);
    expect(s).toMatchObject({ minRestHours: 0, maxConsecutiveDays: 0 });
    // two assignments a minute apart are fine while no rule exists
    expect((await call("qm", "POST", "/raqib/visits", visit("2026-12-01", "08:00", "morning"))).status).toBe(201);
    expect((await call("qm", "POST", "/raqib/visits", visit("2026-12-01", "09:00", "morning"))).status).toBe(201);
  });

  it("rejects a shift the organization has not configured", async () => {
    const r = await call("qm", "POST", "/raqib/visits", visit("2026-12-02", "08:00", "afternoon"));
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("raqib.unknown_shift");
  });

  it("validates the schedule settings", async () => {
    const dup = await setSchedule({
      shifts: [
        { key: "a1", nameAr: "أ", nameEn: "A", start: "", end: "" },
        { key: "a1", nameAr: "ب", nameEn: "B", start: "", end: "" },
      ],
    });
    expect(dup.status).toBe(400);
    const half = await setSchedule({ shifts: [{ key: "a1", nameAr: "أ", nameEn: "A", start: "06:00", end: "" }] });
    expect(half.status).toBe(400);
    expect((await setSchedule({ minRestHours: 99 })).status).toBe(400);
  });

  it("keeps schedule settings away from roles without the settings right", async () => {
    expect((await call("adm", "PUT", "/raqib/settings", { settings: {}, reason: "nope" })).status).toBe(403);
    expect((await call("insA", "GET", "/raqib/settings")).status).toBe(403);
  });

  it("enforces a configured rest period between shifts of the same inspector", async () => {
    const set = await setSchedule({
      shifts: [
        { key: "day", nameAr: "نهارية", nameEn: "Day", start: "06:00", end: "14:00" },
        { key: "night", nameAr: "ليلية", nameEn: "Night", start: "22:00", end: "06:00" },
        { key: "morning", nameAr: "صباحية", nameEn: "Morning", start: "", end: "" },
        { key: "evening", nameAr: "مسائية", nameEn: "Evening", start: "", end: "" },
      ],
      minRestHours: 11,
    });
    expect(set.status).toBe(200);
    expect((await call("qm", "POST", "/raqib/visits", visit("2026-12-10", "23:00", "night"))).status).toBe(201);
    const tooSoon = await call("qm", "POST", "/raqib/visits", visit("2026-12-11", "07:00", "day"));
    expect(tooSoon.status).toBe(409);
    expect(tooSoon.body.error.code).toBe("raqib.rest_rule");
    expect((await call("qm", "POST", "/raqib/visits", visit("2026-12-12", "07:00", "day"))).status).toBe(201);
  });

  it("never removes a shift that visits already use, but lets it be renamed", async () => {
    const cur = (await call("qm", "GET", "/raqib/settings")).body;
    const without = cur.schedule.shifts.filter((x: Json) => x.key !== "evening");
    const refused = await call("qm", "PUT", "/raqib/settings", {
      settings: { ...cur, schedule: { ...cur.schedule, shifts: without } },
      reason: "drop evening",
    });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("raqib.shift_in_use");
    const renamed = cur.schedule.shifts.map((x: Json) => (x.key === "evening" ? { ...x, nameEn: "Late shift" } : x));
    expect(
      (await call("qm", "PUT", "/raqib/settings", { settings: { ...cur, schedule: { ...cur.schedule, shifts: renamed } }, reason: "rename evening" })).status,
    ).toBe(200);
    // a shift nobody uses can go
    const extra = [...renamed, { key: "spare", nameAr: "احتياطية", nameEn: "Spare", start: "", end: "" }];
    expect(
      (await call("qm", "PUT", "/raqib/settings", { settings: { ...cur, schedule: { ...cur.schedule, shifts: extra } }, reason: "add spare" })).status,
    ).toBe(200);
    expect(
      (await call("qm", "PUT", "/raqib/settings", { settings: { ...cur, schedule: { ...cur.schedule, shifts: renamed } }, reason: "drop spare" })).status,
    ).toBe(200);
  });

  it("enforces a cap on consecutive days and applies the rules when rescheduling", async () => {
    expect((await setSchedule({ minRestHours: 0, maxConsecutiveDays: 3 })).status).toBe(200);
    const ids: string[] = [];
    for (const d of ["2027-01-10", "2027-01-11", "2027-01-12"]) {
      const r = await call("qm", "POST", "/raqib/visits", visit(d, "07:00", "morning"));
      expect(r.status).toBe(201);
      ids.push(r.body.id);
    }
    const fourth = await call("qm", "POST", "/raqib/visits", visit("2027-01-13", "07:00", "morning"));
    expect(fourth.status).toBe(409);
    expect(fourth.body.error.code).toBe("raqib.consecutive_rule");
    // moving a visit next to the run is refused, a gap day is fine
    const lone = (await call("qm", "POST", "/raqib/visits", visit("2027-02-20", "07:00", "morning"))).body;
    const moveNext = await call("qm", "POST", `/raqib/visits/${lone.id}/reschedule`, { date: "2027-01-13", time: "07:00", reason: "test" });
    expect(moveNext.status).toBe(409);
    expect((await call("qm", "POST", `/raqib/visits/${lone.id}/reschedule`, { date: "2027-01-14", time: "07:00", reason: "test" })).status).toBe(200);
  });

  describe("schedule documents", () => {
    const range = "from=2026-06-01&to=2027-05-31";
    const rows = (csv: string) => csv.split("\r\n").filter(Boolean).length - 1;

    it("exports the period as CSV and prints it as an A4 page, in 12-hour time, for people with the right", async () => {
      const csv = await call("qm", "GET", `/raqib/visits/export?${range}&lang=en`);
      expect(csv.status).toBe(200);
      expect(csv.text.charCodeAt(0)).toBe(0xfeff);
      expect(csv.text.slice(1).split("\r\n")[0]).toBe("Visit,Date,Time,Project,Site,Area,Inspector,Shift,Type,Status,Forms");
      expect(csv.text).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
      const html = await call("qm", "GET", `/raqib/visits/print?${range}&lang=ar`);
      expect(html.status).toBe(200);
      expect(html.text).toContain('dir="rtl"');
      expect(html.text).toContain("A4 landscape");
      expect(html.text).toMatch(/\d{1,2}:\d{2} (ص|م)/);
      expect(html.text).toContain("<thead>");
    });

    it("can be narrowed to one inspector, so each inspector's own schedule can be printed", async () => {
      const all = rows((await call("qm", "GET", `/raqib/visits/export?${range}`)).text);
      const mine = rows((await call("qm", "GET", `/raqib/visits/export?${range}&inspectorId=${base.inspectorId}`)).text);
      expect(mine).toBeGreaterThan(0);
      expect(mine).toBeLessThan(all);
    });

    it("keeps to the caller's own projects and rights", async () => {
      const everyone = rows((await call("qm", "GET", `/raqib/visits/export?${range}`)).text);
      const admin = rows((await call("adm", "GET", `/raqib/visits/export?${range}`)).text);
      expect(admin).toBeLessThan(everyone);
      expect((await call("qe", "GET", `/raqib/visits/export?${range}`)).status).toBe(403); // can print, not export
      expect((await call("qe", "GET", `/raqib/visits/print?${range}`)).status).toBe(200);
      expect((await call("insA", "GET", `/raqib/visits/print?${range}`)).status).toBe(403);
      expect((await call("insA", "GET", `/raqib/visits/export?${range}`)).status).toBe(403);
    });

    it("refuses a missing, reversed or over-long period", async () => {
      expect((await call("qm", "GET", "/raqib/visits/export?from=2026-01-01")).status).toBe(400);
      expect((await call("qm", "GET", "/raqib/visits/export?from=2026-02-01&to=2026-01-01")).status).toBe(400);
      expect((await call("qm", "GET", "/raqib/visits/export?from=2020-01-01&to=2026-01-01")).status).toBe(400);
    });
  });
});
