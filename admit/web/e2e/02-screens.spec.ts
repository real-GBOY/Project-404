import { test } from "@playwright/test";

/** Captures the main screens to e2e/screens/ for visual review against the design (run with SCREENS=1). */
test.skip(!process.env.SCREENS, "set SCREENS=1 to capture screenshots");

const shot = (name: string) => `e2e/screens/${name}.png`;

test("capture the main screens", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/e/nile-sessions");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: shot("customer-home") });
  await page.goto("/e/nile-sessions/events/cairo-jazz-nights");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: shot("customer-event") });

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("karim@nilesessions.example");
  await page.getByLabel("Password").fill("demo-password-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.endsWith("/login"));
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: shot("admin-overview") });
  await page.goto("/admin/review");
  await page.getByRole("button", { name: /Nour Hassan/ }).click();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: shot("admin-review") });

  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/scan/login");
  await page.getByLabel("Email").fill("ali@nilesessions.example");
  await page.getByLabel("Password").fill("demo-password-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.endsWith("/login"));
  await page.getByRole("button", { name: /Gallery Night/ }).click();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: shot("scanner-home") });
});
