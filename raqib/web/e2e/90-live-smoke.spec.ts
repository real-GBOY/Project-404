import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, api, apiLogin, asUser } from "./helpers";

/**
 * READ-ONLY smoke test of a live deployment: it signs in as each demo role and looks, and never writes (unlike the rest of the
 * suite, which creates data and so must not be run against a showcase server). Skipped unless pointed at one:
 *   E2E_WEB=https://raqib-web.vercel.app E2E_API=https://raqib.162-35-28-116.sslip.io npx playwright test e2e/90-live-smoke.spec.ts
 */
test.skip(!process.env.E2E_WEB, "live-deployment smoke test: set E2E_WEB and E2E_API");

type J = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function watch(page: Page, bag: string[]) {
  page.on("pageerror", (e) => bag.push(`pageerror: ${String(e).slice(0, 160)}`));
  page.on("response", (r) => {
    const u = r.url();
    if (r.status() >= 400 && /\/api\//.test(u) && !/\/auth\/(refresh|login)/.test(u))
      bag.push(`${r.status()} ${u.replace(/^https?:\/\/[^/]+/, "")}`);
  });
}
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText);

test("API: health, scoring, analytics, surveys, training", async ({ request }) => {
  const qm = await apiLogin(request, ACCOUNTS.qm);
  const gm = await apiLogin(request, ACCOUNTS.gm);
  const get = (t: string, p: string) => api<J>(request, t, "GET", p);
  const settings = await get(qm.token, "/raqib/settings");
  console.log(
    "SETTINGS",
    JSON.stringify({
      shifts: settings.schedule.shifts.map((s: J) => `${s.key} ${s.start}-${s.end}`),
      maxDays: settings.schedule.maxConsecutiveDays,
      early: settings.insp.allowEarlyStart,
      rank: settings.ranking.weights,
      chain: settings.training.guardReviewBySupervisor,
    }),
  );
  const sc = await get(qm.token, "/raqib/scoring");
  console.log(
    "SCORING",
    sc.current?.version,
    JSON.stringify(sc.current?.bySeverity),
    "canPublish",
    sc.canPublish,
  );
  expect(sc.current?.version).toBeGreaterThanOrEqual(1);
  const an = await get(qm.token, "/raqib/analytics?period=year&sort=contract");
  console.log(
    "RANK(contract)",
    JSON.stringify(
      an.ranking.map((r: J) => [
        r.project.en,
        r.daysToContractEnd,
        r.employeesAssigned,
        r.complaints,
      ]),
    ),
  );
  const anG = await get(gm.token, "/raqib/analytics?period=year");
  expect(anG.ranking.every((r: J) => r.complaints === null)).toBe(true); // GM holds no confidential grant: no figure at all
  const surveys = await get(gm.token, "/raqib/surveys");
  console.log(
    "SURVEYS(gm)",
    JSON.stringify(surveys.items.map((s: J) => [s.title.en, s.status])),
    "managers",
    surveys.managers?.length,
  );
  const tr = await get(qm.token, "/raqib/training?limit=100");
  const tc: Record<string, number> = {};
  for (const t of tr.items) tc[t.status] = (tc[t.status] ?? 0) + 1;
  console.log("TRAINING", JSON.stringify(tc));
  const visits = await get(qm.token, "/raqib/visits");
  console.log(
    "VISITS",
    visits.items.length,
    "with counts",
    visits.items.filter((v: J) => v.nonCompliant != null).length,
  );
  // a person without a grant gets nothing from the confidential area
  const pm = await apiLogin(request, ACCOUNTS.pm);
  const res = await request.get(`${process.env.E2E_API}/api/raqib/confidential/reports`, {
    headers: { authorization: `Bearer ${pm.token}` },
  });
  console.log("PM -> confidential reports status", res.status());
  expect([401, 403]).toContain(res.status());
});

for (const [who, email, paths] of [
  [
    "quality manager",
    ACCOUNTS.qm,
    [
      "/overview",
      "/visits",
      "/projects",
      "/analytics",
      "/reviews",
      "/observations",
      "/actions",
      "/training",
      "/reports",
      "/settings",
      "/surveys",
      "/guards",
      "/forms",
    ],
  ],
  ["inspector", ACCOUNTS.insA, ["/overview", "/visits", "/inspections", "/surveys"]],
  ["project manager", ACCOUNTS.pm, ["/overview", "/projects", "/actions", "/training", "/surveys"]],
  ["guard", ACCOUNTS.guard, ["/overview", "/training", "/confidential", "/surveys"]],
  [
    "general manager",
    ACCOUNTS.gm,
    ["/overview", "/analytics", "/settings", "/surveys", "/confidential"],
  ],
] as const) {
  test(`pages open without errors: ${who}`, async ({ browser }) => {
    test.setTimeout(180_000);
    const issues: string[] = [];
    const page = await asUser(browser, email);
    watch(page, issues);
    for (const path of paths) {
      await page.goto(path);
      await page.waitForTimeout(1800);
      const t = await bodyText(page);
      if (
        /You don.t have access|This module is not available yet|Something went wrong|waitReview|waitResp/i.test(
          t,
        )
      )
        issues.push(`${path}: shows an error or placeholder text`);
      if (/\b(ca_|sf_|sv_|tr_|ax_)[a-zA-Z_]+\b/.test(t))
        issues.push(`${path}: raw string key on screen`);
    }
    console.log(`PAGES ${who}:`, issues.length ? JSON.stringify(issues) : "all clean");
    expect(issues).toEqual([]);
  });
}

test("the client's journeys render on production: report with forms, project contract, ranking, settings", async ({
  browser,
  request,
}) => {
  test.setTimeout(180_000);
  const issues: string[] = [];
  const t = await apiLogin(request, ACCOUNTS.qm);
  const reports = await api<J>(request, t.token, "GET", "/raqib/reports");
  const multi = reports.items.find((r: J) => r.snapshot.extraForms?.length) ?? reports.items[0];
  const projects = await api<J>(request, t.token, "GET", "/raqib/projects");
  const page = await asUser(browser, ACCOUNTS.qm);
  watch(page, issues);
  await page.goto(`/report/${multi.visitId}`);
  await page.waitForTimeout(2500);
  let text = await bodyText(page);
  console.log(
    "REPORT forms switcher:",
    /FRM-[A-Z]+-\d+ · INS-/.test(text),
    "| deduction pts:",
    /−\d+/.test(text),
    "| excel button gone:",
    !/Export Excel/.test(text),
  );
  await page.goto(`/project/${projects.items.find((p: J) => p.contractEnd)?.id}`);
  await page.waitForTimeout(2000);
  text = await bodyText(page);
  console.log(
    "PROJECT contract line:",
    /Contract: .* → .*/.test(text),
    "| employees:",
    /employees assigned/.test(text),
  );
  await page.goto("/analytics");
  await page.waitForTimeout(2500);
  text = await bodyText(page);
  console.log(
    "ANALYTICS ranking indicators:",
    /Contract ends in/.test(text) && /Observations \d+/.test(text),
    "| rank selector:",
    /Rank: needs attention first/.test(text),
  );
  await page.goto("/settings");
  await page.getByRole("button", { name: "Project ranking", exact: true }).click();
  await page.waitForTimeout(800);
  text = await bodyText(page);
  console.log("SETTINGS ranking tab:", /Weight: complaints/.test(text));
  await page.getByRole("button", { name: "Training requests", exact: true }).last().click();
  await page.waitForTimeout(800);
  console.log("SETTINGS training tab:", /supervisor reviews guards/i.test(await bodyText(page)));
  console.log("JOURNEY issues:", issues.length ? JSON.stringify(issues) : "none");
  expect(issues).toEqual([]);
});

test("Arabic on a phone: guard home and surveys", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-SA" });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(ACCOUNTS.guard);
  await page.getByLabel("كلمة المرور").fill("demo-password-2026");
  await page.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();
  await page.waitForTimeout(3000);
  await page.goto("/surveys");
  await page.waitForTimeout(2000);
  const t = await bodyText(page);
  const dir = await page.evaluate(() => document.documentElement.dir);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  console.log(
    "ARABIC dir:",
    dir,
    "| no sideways scroll:",
    !overflow,
    "| survey shown:",
    /استبيان/.test(t),
  );
  expect(dir).toBe("rtl");
  expect(overflow).toBe(false);
});
