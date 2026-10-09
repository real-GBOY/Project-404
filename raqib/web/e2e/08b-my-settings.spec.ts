import { expect, test } from "@playwright/test";
import { ACCOUNTS, inEnglish, signIn } from "./helpers";

/**
 * "My settings" exists for every role: it is in the sidebar, shows who is signed in, switches the language, and carries the
 * person's own security (two-step verification, password, sessions) and sign-out. Nothing here changes shared demo data.
 */
test.describe("my settings", () => {
  test.beforeEach(async ({ page }) => inEnglish(page));

  for (const [role, email] of Object.entries(ACCOUNTS)) {
    test(`${role} has it in the sidebar and sees their own account`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await signIn(page, email);
      await page.locator("aside button", { hasText: "My settings" }).click();
      await expect(page).toHaveURL(/\/account$/);
      await expect(page.getByRole("heading", { name: "My settings", level: 1 })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
      await expect(page.getByText(email, { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Two-step verification" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Change password" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out everywhere" })).toBeVisible();
      await expect(page.getByText("Couldn’t load data")).toHaveCount(0);
    });
  }

  test("there is no bar above the app; language, demo accounts and sign-out live on the page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, ACCOUNTS.qm);
    await expect(page.getByText("RAQIB · PRESENTER")).toHaveCount(0);
    await page.locator("aside button", { hasText: "My settings" }).click();
    await expect(page.getByRole("heading", { name: "My settings", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "العربية" }).click();
    await expect(page.getByRole("heading", { name: "إعداداتي", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { name: "My settings", level: 1 })).toBeVisible();

    // the demo account switcher: a real sign-in as another role
    await page.getByLabel("Signed in as").selectOption(ACCOUNTS.gs);
    await expect(page.getByText("Security Supervisor").first()).toBeVisible();
    await page.locator("aside button", { hasText: "My settings" }).click();
    await expect(page.getByText(ACCOUNTS.gs, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  });

  test("it is reachable on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, ACCOUNTS.guard);
    await page.getByRole("button", { name: "My settings" }).last().click();
    await expect(page.getByRole("heading", { name: "My settings", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Change password" })).toBeVisible();
  });
});
