import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, signIn, inEnglish } from "./helpers";

/**
 * The client-demo variant (VITE_DEMO_SCOPE=client): only the inspection story is offered. Runs only against a build made with it:
 *   E2E_DEMO_SCOPE=client npx playwright test e2e/10-client-demo-scope.spec.ts
 */
test.skip(
  process.env.E2E_DEMO_SCOPE !== "client",
  "needs a build made with VITE_DEMO_SCOPE=client",
);

const side = (page: Page, name: string) => page.locator("aside button", { hasText: name });

test("the client demo offers the inspection story and nothing administrative", async ({ page }) => {
  await inEnglish(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, ACCOUNTS.qm);

  for (const shown of [
    "Overview",
    "Projects",
    "Visit schedule",
    "Review & approval",
    "Observations & violations",
    "Corrective actions",
    "Reports",
    "Analytics",
    "Inspection forms",
    "My settings",
  ])
    await expect(side(page, shown).first(), shown).toBeVisible();

  for (const hidden of [
    "Users",
    "Permission templates",
    "Audit log",
    "Confidential reports",
    "Training requests",
    "Guards",
  ])
    await expect(side(page, hidden), hidden).toHaveCount(0);
  await expect(side(page, "Settings").filter({ hasNotText: "My settings" })).toHaveCount(0);

  // the demo-account switcher stays, so roles can be changed live
  await side(page, "My settings").click();
  await page.getByLabel("Signed in as").selectOption(ACCOUNTS.insA);
  await expect(side(page, "Visit schedule")).toBeVisible();
  await expect(side(page, "Users")).toHaveCount(0);

  // typing a hidden address shows the refusal, not the screen
  await page.goto("/users");
  await expect(page.getByText(/have access/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Users", level: 1 })).toHaveCount(0);
});
