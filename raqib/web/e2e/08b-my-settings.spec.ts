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

  test("the language switch applies at once, and the top bar reaches the page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, ACCOUNTS.qm);
    await page.getByRole("button", { name: "Settings", exact: true }).first().click(); // the bar above the app comes first; the sidebar's organization Settings is another screen
    await expect(page.getByRole("heading", { name: "My settings", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "العربية" }).last().click();
    await expect(page.getByRole("heading", { name: "إعداداتي", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "English" }).last().click();
    await expect(page.getByRole("heading", { name: "My settings", level: 1 })).toBeVisible();
  });

  test("it is reachable on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, ACCOUNTS.guard);
    await page.getByRole("button", { name: "My settings" }).last().click();
    await expect(page.getByRole("heading", { name: "My settings", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Change password" })).toBeVisible();
  });
});
