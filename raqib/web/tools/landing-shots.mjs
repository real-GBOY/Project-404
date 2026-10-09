// Captures the product-tour screenshots used by the landing page (public/landing/shots/<name>-<lang>.png).
//   node tools/landing-shots.mjs [outDir]
// Needs the throw-away stack from video/README.md: backend :3399 seeded with the demo company (bash video/reset-stack.sh) and
// the demo build served on :4599 (VITE_DEMO=true vite build, then vite preview --port 4599 with RAQIB_API_PROXY_TARGET=http://localhost:3399).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = process.argv[2] ?? "public/landing/shots";
const WEB = "http://localhost:4599";
const API = "http://localhost:3399/api";
const PW = "demo-password-2026";
mkdirSync(OUT, { recursive: true });

const H = { "content-type": "application/json", "x-forwarded-for": "10.88.4.4" };
async function api(email) {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ email, password: PW }),
  });
  const A = { ...H, authorization: `Bearer ${(await r.json()).tokens.accessToken}` };
  return async (path) => (await fetch(API + path, { headers: A })).json();
}

// [file name, who signs in, viewport (CSS px; shots are 2x), route builder]
const PHONE = { width: 834, height: 849 };
const DESK = { width: 1644, height: 849 };
const qm = await api("s.alotaibi@raqib.sa");
const visits = (await qm("/raqib/visits?limit=500")).items;
const inProgress =
  visits.find((v) => v.status === "in_progress") ??
  visits.find((v) => v.status === "assigned") ??
  visits[0];
const pending =
  visits.find((v) => v.status === "pending_review" || v.status === "submitted") ?? visits[0];
const reports = (await qm("/raqib/reports?limit=500")).items;
const allForms = (await qm("/raqib/forms?limit=50")).items ?? [];
const forms = [...allForms.filter((f) => /SEC-01/.test(JSON.stringify(f))), ...allForms];
console.log({
  inProgress: inProgress?.ref,
  pending: pending?.ref,
  report: reports[0]?.id,
  form: forms[0]?.id,
});

const SHOTS = [
  ["inspect-tab", "k.alshehri@raqib.sa", PHONE, `/inspect/${inProgress.id}`],
  ["review", "n.alqahtani@raqib.sa", DESK, `/review/${pending.id}`],
  ["form", "s.alotaibi@raqib.sa", DESK, forms[0] ? `/form/${forms[0].id}` : "/forms"],
  ["analytics", "s.alotaibi@raqib.sa", DESK, "/analytics"],
  [
    "report",
    "s.alotaibi@raqib.sa",
    DESK,
    reports[0] ? `/report/${reports[0].visitId}` : "/reports",
  ],
];

const browser = await chromium.launch({ channel: "chrome" });
for (const lang of ["ar", "en"]) {
  for (const [name, email, vp, route] of SHOTS) {
    const ctx = await browser.newContext({
      viewport: vp,
      deviceScaleFactor: 2,
      locale: lang === "ar" ? "ar-SA" : "en-US",
    });
    await ctx.addInitScript((l) => localStorage.setItem("raqib.lang", l), lang);
    const page = await ctx.newPage();
    await page.route("**/api/**", (r) =>
      r.continue({ headers: { ...r.request().headers(), "x-forwarded-for": "10.88.4.4" } }),
    );
    await page.goto(WEB + "/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(PW);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => u.pathname === "/" || !u.pathname.startsWith("/login"), {
      timeout: 15000,
    });
    await page.waitForTimeout(1500);
    await page.goto(WEB + route);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${name}-${lang}.png` });
    console.log("shot", name, lang, page.url());
    await ctx.close();
  }
}
await browser.close();
