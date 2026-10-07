import { expect, test } from "@playwright/test";
import { ACCOUNTS, inEnglish, signIn } from "./helpers";

/**
 * Choosing "Custom" on Analytics used to ask the server for a range nobody had typed yet; the refusal then stayed cached
 * and put an error screen on every other screen too. A custom range is only asked for once it is complete and valid, and
 * a failed query never leaks onto another screen.
 */
test.describe("analytics custom range", () => {
  test.beforeEach(async ({ page }) => inEnglish(page));

  test("Custom starts from a valid range, and a half-typed or reversed range never breaks the app", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, ACCOUNTS.qm);
    await page.locator("aside button", { hasText: "Analytics" }).click();
    await expect(page.getByText("Couldn’t load data")).toHaveCount(0);

    await page.getByRole("button", { name: "Custom", exact: true }).click();
    const [from, to] = [
      page.locator('input[type="date"]').nth(0),
      page.locator('input[type="date"]').nth(1),
    ];
    await expect(from).not.toHaveValue("");
    await expect(to).not.toHaveValue("");
    await expect(page.getByText("Choose a valid date range")).toHaveCount(0);
    await expect(page.getByText("Couldn’t load data")).toHaveCount(0);

    await from.fill(""); // half typed
    await expect(page.getByText("Couldn’t load data")).toHaveCount(0);
    await from.fill("2026-12-31"); // later than the end
    await expect(page.getByText("Couldn’t load data")).toHaveCount(0);

    // and every other screen still opens
    for (const name of ["Overview", "Reports", "Audit log", "My settings"]) {
      await page.locator("aside button", { hasText: name }).first().click();
      await expect(page.getByText("Couldn’t load data"), name).toHaveCount(0);
    }
  });
});
