import { expect, test } from "@playwright/test";

/** Seeded by the backend's demo seeder (hotel-project/backend/app/hotel/demo/demo-data.ts). */
const OWNER = { email: "ahmed.nabil@hotelnayel.com", password: "demo-password-2026" };

test.describe("staff sign-in", () => {
  test("a signed-out visitor is sent to sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("a wrong password is rejected by the real API with a friendly message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toContainText("don't match");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("the demo owner signs in, survives a reload, and signs out", async ({ page, isMobile }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill(OWNER.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("heading", { name: /, Ahmed$/ })).toBeVisible();

    // Navigation: the sidebar on desktop, a drawer on phones.
    if (isMobile) {
      await page.getByRole("button", { name: "Open navigation" }).click();
    }
    const nav = page.getByRole("complementary", { name: "Main navigation" });
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();

    // The persisted refresh token restores the session after a hard reload.
    await page.reload();
    await expect(page.getByRole("heading", { name: /, Ahmed$/ })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });
});
