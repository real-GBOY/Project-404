import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, signIn, inEnglish } from "./helpers";

/**
 * The visit schedule's week grid: a visit is dragged onto another day, which opens the usual reschedule form already set to that
 * day (so the reason is still asked for and recorded); and the search palette is driven by the keyboard (↑ ↓ Enter).
 */
const dialog = (page: Page) => page.getByRole("dialog");

test.describe("visit schedule", () => {
  test.beforeEach(async ({ page }) => {
    await inEnglish(page);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("a visit dragged onto another day opens the reschedule form for that day, and saving moves it", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.qm);
    await page.goto("/visits");
    await page.getByRole("button", { name: "Week", exact: true }).click();

    // a movable visit: one the grid marks draggable, on a day that is not the last
    const card = page.locator('[data-visit][draggable="true"]').first();
    await expect(card).toBeVisible();
    const from = await card.locator("xpath=ancestor::*[@data-day]").getAttribute("data-day");
    const days = await page
      .locator("[data-day]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-day")!));
    const to = days.find((d) => d !== from)!;
    const ref = (await card.innerText()).split("\n")[0];

    await card.dragTo(page.locator(`[data-day="${to}"]`));

    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByRole("heading", { name: /^Reschedule / })).toBeVisible();
    await expect(dialog(page).locator(`input[type="date"]`)).toHaveValue(to);

    // the reason is still required; the visit has not moved yet
    await dialog(page).getByRole("button", { name: "Save change" }).click();
    await expect(dialog(page)).toBeVisible();
    await dialog(page).getByLabel("Reason (required)").fill("Moved by drag and drop (e2e)");
    await dialog(page).getByRole("button", { name: "Save change" }).click();
    await expect(page.getByText(/rescheduled/i).first()).toBeVisible();
    await expect(
      page.locator(`[data-day="${to}"] [data-visit]`).filter({ hasText: ref! }).first(),
    ).toBeVisible();
  });

  test("dropping a visit on its own day does nothing", async ({ page }) => {
    await signIn(page, ACCOUNTS.qm);
    await page.goto("/visits");
    await page.getByRole("button", { name: "Week", exact: true }).click();
    const card = page.locator('[data-visit][draggable="true"]').first();
    await expect(card).toBeVisible();
    const from = await card.locator("xpath=ancestor::*[@data-day]").getAttribute("data-day");
    await card.dragTo(page.locator(`[data-day="${from}"]`));
    await expect(dialog(page)).toHaveCount(0);
  });

  test("an inspector cannot drag visits (no right to schedule)", async ({ page }) => {
    await signIn(page, ACCOUNTS.insA);
    await page.goto("/visits");
    await page.getByRole("button", { name: "Week", exact: true }).click();
    await expect(page.locator('[data-visit][draggable="true"]')).toHaveCount(0);
  });

  test("the search palette works from the keyboard: arrows move the highlight, Enter opens the result", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.qm);
    await page
      .getByRole("button", { name: /^Search/ })
      .first()
      .click();
    const box = page.getByRole("combobox");
    await expect(box).toBeFocused();
    await box.fill("a");
    await box.fill("al"); // two letters trigger the search
    const options = page.getByRole("option");
    await expect(options.first()).toBeVisible();
    const n = await options.count();
    test.skip(n < 2, "the demo data returns fewer than two hits");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await box.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await box.press("ArrowUp");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await box.press("ArrowUp"); // wraps to the last
    await expect(options.nth(n - 1)).toHaveAttribute("aria-selected", "true");
    await box.press("ArrowDown");
    await box.press("Enter");
    await expect(page.getByRole("combobox")).toHaveCount(0); // the palette closed
  });
});
