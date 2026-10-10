import { expect, test } from "@playwright/test";

/**
 * What an organizer relies on day to day beyond the booking journey: changing their own password, and taking the booking list and the
 * attendee list out as spreadsheets. Real browser, real backend.
 */
const PASSWORD = "demo-password-2026";

test("a person changes their own password and has to sign in again with the new one", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("mona@nilesessions.example");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Change password" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Current password").fill("not-my-password");
  await dialog.getByLabel("New password", { exact: true }).fill("a-better-password-1");
  await dialog.getByLabel("New password again").fill("a-better-password-1");
  await dialog.getByRole("button", { name: "Change password" }).click();
  await expect(dialog.getByRole("alert")).toContainText(/current password is not correct/i); // wrong current password: refused

  await dialog.getByLabel("Current password").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Change password" }).click();
  await expect(
    page.getByText("Your password was changed. Sign in with the new one."),
  ).toBeVisible();

  // the old password no longer works, the new one does
  await page.getByLabel("Email").fill("mona@nilesessions.example");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/do not match an account/i)).toBeVisible();
  await page.getByLabel("Password").fill("a-better-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("link", { name: "Bookings" }).first()).toBeVisible();
});

test("the owner downloads the bookings and the attendee list as CSV", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("salma@nilesessions.example");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin$/); // the session is stored once the dashboard is up

  await page.goto("/admin/bookings");
  const [bookings] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export CSV" }).click(),
  ]);
  expect(bookings.suggestedFilename()).toMatch(/^admit-bookings-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = await (await import("node:fs/promises")).readFile((await bookings.path())!, "utf8");
  expect(text.charCodeAt(0)).toBe(0xfeff); // a BOM, so Excel reads Arabic names correctly
  expect(text).toContain("Reference,Status,Event,Customer,Email,Phone,Tickets,Total,Currency");
  expect(text.split(/\r?\n/).length).toBeGreaterThan(5); // the demo organizer's bookings are in it

  await page.goto("/admin/tickets");
  const [tickets] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export attendee list" }).click(),
  ]);
  expect(tickets.suggestedFilename()).toMatch(/^admit-tickets-\d{4}-\d{2}-\d{2}\.csv$/);
});

test("the owner sees the audit log, and it records their export", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("salma@nilesessions.example");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin$/); // the session is stored once the dashboard is up
  await page.getByRole("link", { name: "Audit log" }).first().click();
  await expect(page.locator("td").filter({ hasText: "Password changed" }).first()).toBeVisible(); // the earlier test changed a password
  await expect(page.locator("td").filter({ hasText: "Bookings exported" }).first()).toBeVisible();
});
