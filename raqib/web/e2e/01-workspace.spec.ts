import { expect, test } from "@playwright/test";
import { ACCOUNTS, signIn, inEnglish } from "./helpers";

/**
 * A smoke test across the whole product: every role signs in and every screen in its sidebar opens against the real
 * backend without an error screen or a crash. It catches the breakage that unit tests cannot (a renamed field, a route the
 * role should see that the backend refuses, a presenter that throws on real data).
 */
test.describe("every role can open every screen it is offered", () => {
  test.beforeEach(async ({ page }) => inEnglish(page));

  for (const [role, email] of Object.entries(ACCOUNTS)) {
    test(`${role}`, async ({ page }) => {
      const problems: string[] = [];
      let where = "sign-in";
      page.on("pageerror", (e) => problems.push(`[${where}] page error: ${e.message}`));
      page.on(
        "console",
        (m) =>
          m.type() === "error" &&
          !/Failed to load resource/.test(m.text()) &&
          problems.push(`[${where}] console: ${m.text()}`),
      );

      await signIn(page, email);

      // the desktop sidebar lists the role's screens; the mobile layout does not, so use a desktop-sized window
      await page.setViewportSize({ width: 1440, height: 900 });
      const nav = page.locator("aside button");
      const count = await nav.count();
      expect(count, `${role} has no navigation`).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const label = ((await nav.nth(i).textContent()) ?? "").trim();
        where = label;
        await nav.nth(i).click();
        await page.waitForLoadState("networkidle");
        await expect(page.getByText("Couldn’t load data"), `${role} → ${label}`).toHaveCount(0);
        await expect(
          page.getByText("This module is not available yet."),
          `${role} → ${label}`,
        ).toHaveCount(0);
      }
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
});
