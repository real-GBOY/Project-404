import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "demo-password-2026";
const RECEPTIONIST = "rania.kamal@hotelnayel.com";
const MANAGER = "mona.farid@hotelnayel.com";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(",");
}

test.describe("front desk (Slice 3)", () => {
  test("a receptionist checks an arriving guest in", async ({ page, isMobile }) => {
    await signIn(page, RECEPTIONIST);
    await page.goto("/front-desk");
    await expect(page.getByRole("heading", { name: /Today's Arrivals/ })).toBeVisible();
    await page
      .getByRole("button", { name: "Check In" })
      .nth(isMobile ? 1 : 0)
      .click();

    const dialog = page.getByRole("dialog");
    // If the booked room isn't ready (a guest still in it, or not yet cleaned), move to a ready one.
    const move = dialog.getByLabel("Move to a ready room");
    if (await move.isVisible()) {
      await move.selectOption({ index: 1 });
    }
    await dialog.getByRole("button", { name: "Check in" }).click();
    await expect(page.getByText(/Guest checked in — Room \d+ marked Occupied/)).toBeVisible();
  });

  test("a departure settles the folio, checks out and gets an invoice", async ({ page }) => {
    await signIn(page, RECEPTIONIST);
    await page.goto("/front-desk");
    await expect(page.getByRole("heading", { name: /Today's Departures/ })).toBeVisible();
    // The desktop run's guest has already left, so the first departure is always a fresh one.
    await page.getByRole("button", { name: "Check Out" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Balance due").or(dialog.getByText("Overpaid"))).toBeVisible();
    await dialog.getByRole("button", { name: /check out/i }).click();
    await dialog.getByRole("link", { name: "View invoice" }).click();
    await expect(page.getByText("TOTAL", { exact: true })).toBeVisible();
    await expect(page.getByText(/^INV-\d+$/)).toBeVisible();
  });

  test("a manager posts a minibar charge and takes a payment for an in-house guest", async ({
    page,
    isMobile,
  }) => {
    await signIn(page, MANAGER);
    await page.goto("/front-desk");
    const inHouse = page.getByRole("heading", { name: /In House/ }).locator("..");
    await inHouse
      .getByRole("link")
      .nth(isMobile ? 3 : 2)
      .click();

    await page.getByRole("button", { name: "Add charge" }).click();
    const charge = page.getByRole("dialog");
    await charge.getByLabel("Type").selectOption("minibar");
    await charge.getByLabel("Unit price (EGP)").fill("220");
    await charge.getByRole("button", { name: "Add charge" }).click();
    await expect(page.getByText("Minibar added to the folio")).toBeVisible();

    await page.getByRole("button", { name: "Collect Payment" }).click();
    const pay = page.getByRole("dialog");
    // The amount is prefilled with the outstanding balance; the server re-checks it.
    await pay.getByRole("button", { name: "Take payment" }).click();
    await expect(page.getByText(/EGP received by card/)).toBeVisible();
    await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
  });
});
