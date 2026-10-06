import { expect, test } from "@playwright/test";
import { useEnglish } from "./helpers";

test.describe("pages an anonymous person can reach", () => {
  test.beforeEach(async ({ page }) => useEnglish(page));

  test("the account-request page loads the organization's options from the API", async ({
    page,
  }) => {
    await page.goto("/request-account/raqib-demo");
    await expect(
      page.getByText("This organization does not accept account requests."),
    ).toBeHidden();
    // the form is built from the organization's projects, which come from the API
    await expect(page.getByText("Al-Waha Business Park")).toBeVisible();
    await expect(page.getByText("1. Details")).toBeVisible();
  });

  test("an unknown organization says it does not accept requests", async ({ page }) => {
    await page.goto("/request-account/no-such-company");
    await expect(
      page.getByText("This organization does not accept account requests."),
    ).toBeVisible();
  });

  test("a password link with a bad token is refused, a missing token is invalid", async ({
    page,
  }) => {
    await page.goto("/reset-password");
    await expect(page.getByText(/invalid|expired/i).first()).toBeVisible();
    await page.goto("/reset-password?token=not-a-real-token");
    await page.locator('input[type="password"]').first().fill("a-sufficiently-long-pass-1");
    await page.locator('input[type="password"]').nth(1).fill("a-sufficiently-long-pass-1");
    await page
      .getByRole("button", { name: /set|save|continue|activate/i })
      .first()
      .click();
    await expect(page.getByText(/invalid|expired/i).first()).toBeVisible();
  });
});
