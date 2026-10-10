import { test, type Page } from "@playwright/test";

/** Captures the main screens to e2e/screens/ for the docs and for visual review against the design (run with SCREENS=1). */
test.skip(!process.env.SCREENS, "set SCREENS=1 to capture screenshots");

const shot = (name: string) => `e2e/screens/${name}.png`;

async function signIn(page: Page, path: string, email: string) {
  await page.goto(path);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("demo-password-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForLoadState("networkidle");
}

async function capture(page: Page, path: string, name: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  await page.screenshot({ path: shot(name) });
}

test("capture the main screens", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 860 });

  await capture(page, "/e/nile-sessions", "customer-home");
  await capture(page, "/e/nile-sessions/events/cairo-jazz-nights", "customer-event");

  // the organizer owner sees every admin screen
  await signIn(page, "/admin/login", "salma@nilesessions.example");
  await page.screenshot({ path: shot("admin-overview") });
  for (const [path, name] of [
    ["/admin/bookings", "admin-bookings"],
    ["/admin/events", "admin-events"],
    ["/admin/tickets", "admin-tickets"],
    ["/admin/checkin", "admin-checkin"],
    ["/admin/customers", "admin-customers"],
    ["/admin/reports", "admin-reports"],
    ["/admin/email", "admin-email"],
    ["/admin/settings", "admin-settings"],
  ] as const) {
    await capture(page, path, name);
  }
  await page.goto("/admin/review");
  await page.getByRole("button", { name: /Nour Hassan/ }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  await page.screenshot({ path: shot("admin-review") });

  // door staff on a phone-sized screen
  await page.evaluate(() => localStorage.clear());
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/scan");
  if (await page.getByLabel("Email").waitFor({ timeout: 8000 }).then(() => true, () => false)) {
    await page.getByLabel("Email").fill("ali@nilesessions.example");
    await page.getByLabel("Password").fill("demo-password-2026");
    await page.getByRole("button", { name: "Sign in" }).click();
  }
  await page.getByRole("heading", { name: /which event/i }).waitFor();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  await page.screenshot({ path: shot("scanner-events") });
});
