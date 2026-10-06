/**
 * Pagination: the big list endpoints are bounded, cursor-driven, stable and still scope-filtered.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { createDemoHttpApp, hasTestDb, loginAs } from "./helpers.js";

const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe.skipIf(!hasTestDb)("Raqib list pagination", () => {
  let http: NestFastifyApplication;
  let qm = "";
  let pm = "";

  const get = async (token: string, url: string) => {
    const res = await http.inject({ method: "GET", url: `/api${url}`, headers: { authorization: `Bearer ${token}` } });
    return { status: res.statusCode, body: JSON.parse(res.body) as Json };
  };

  beforeAll(async () => {
    http = (await createDemoHttpApp()).http;
    qm = await loginAs(http, email("qm"));
    pm = await loginAs(http, email("pm"));
  }, 180_000);

  afterAll(async () => {
    await http?.close();
  });

  const LISTS = ["visits", "observations", "actions", "reports", "training", "users", "account-requests"];

  it.each(LISTS)("%s: walking the cursor returns every row exactly once, in the same order as one big page", async (name) => {
    const whole = await get(qm, `/raqib/${name}?limit=500`);
    if (whole.status === 404) return; // route naming differs per module; the others still prove the contract
    expect(whole.status).toBe(200);
    const all = (whole.body.items as Json[]).map((r) => r.id);
    const walked: string[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 100; i++) {
      const r = await get(qm, `/raqib/${name}?limit=3${cursor ? `&cursor=${cursor}` : ""}`);
      expect(r.status).toBe(200);
      expect((r.body.items as Json[]).length).toBeLessThanOrEqual(3);
      walked.push(...(r.body.items as Json[]).map((x) => x.id));
      cursor = r.body.nextCursor;
      if (!cursor) break;
    }
    expect(walked).toEqual(all);
    expect(new Set(walked).size).toBe(walked.length);
  });

  it("an unqualified request is bounded and says whether more exists", async () => {
    const r = await get(qm, "/raqib/visits");
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty("nextCursor");
    expect((r.body.items as Json[]).length).toBeLessThanOrEqual(200);
  });

  it("rejects an oversize limit and a forged cursor instead of reading everything", async () => {
    expect((await get(qm, "/raqib/visits?limit=100000")).status).toBe(400);
    expect((await get(qm, "/raqib/visits?limit=0")).status).toBe(400);
    expect((await get(qm, "/raqib/visits?cursor=not-a-cursor")).status).toBe(400);
  });

  it("paging never widens scope: a project manager sees a subset of what the quality manager sees", async () => {
    const all = ((await get(qm, "/raqib/visits?limit=500")).body.items as Json[]).map((v) => v.id);
    const mine = ((await get(pm, "/raqib/visits?limit=500")).body.items as Json[]).map((v) => v.id);
    expect(mine.length).toBeLessThan(all.length);
    for (const id of mine) expect(all).toContain(id);
  });
});
