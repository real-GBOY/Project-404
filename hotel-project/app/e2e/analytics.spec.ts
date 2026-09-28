import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("analytics (Slice 6)", () => {
  test("a manager reads performance over 7, 30 and 90 nights", async ({ page }) => {
    await signIn(page, "mona.farid@hoteltransylvania.com");
    await page.goto("/analytics");
    // The demo played weeks of real stays: every KPI has a value from the ledgers.
    await expect(page.getByLabel("ADR")).toContainText(/\d EGP/);
    await expect(page.getByLabel("RevPAR")).toContainText(/\d EGP/);
    await expect(page.getByLabel("Avg. Stay")).toContainText("nights");
    await expect(page.getByLabel("Cancellation Rate")).toContainText("%");
    const revenue = page.getByRole("list", { name: "Revenue Over Time" });
    await expect(revenue.getByRole("listitem")).toHaveCount(30);
    await expect(page.getByRole("heading", { name: "Booking Sources" })).toBeVisible();

    await page.getByRole("tab", { name: "7d" }).click();
    await expect(revenue.getByRole("listitem")).toHaveCount(7);
    await page.getByRole("tab", { name: "90d" }).click();
    await expect(revenue.getByRole("listitem")).toHaveCount(90);
  });

  test("the front desk doesn't see analytics", async ({ page }) => {
    await signIn(page, "rania.kamal@hoteltransylvania.com");
    await expect(page.getByRole("link", { name: "Analytics" })).toHaveCount(0);
  });
});
