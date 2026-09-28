import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const MANAGER = "mona.farid@hoteltransylvania.com";
const RECEPTIONIST = "rania.kamal@hoteltransylvania.com";
const HOUSEKEEPER = "hassan.ali@hoteltransylvania.com";

test.describe("workspace (Slice 7)", () => {
  test("⌘K finds a guest and opens their profile", async ({ page }) => {
    await signIn(page, RECEPTIONIST);
    await page.keyboard.press("Control+k");
    const box = page.getByRole("combobox");
    await box.fill("Ahmed");
    const guests = page.getByRole("group", { name: "Guests" });
    await expect(guests.getByRole("option").first()).toBeVisible();
    await guests.getByRole("option").first().click();
    await expect(page).toHaveURL(/\/guests\/gst_/);
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
  });

  test("assigning a room notifies the housekeeper, who goes straight to the board", async ({
    page,
  }) => {
    await signIn(page, MANAGER);
    await page.goto("/housekeeping");
    const needs = page.getByRole("region", { name: "Needs Cleaning" });
    const card = needs
      .getByRole("article")
      .filter({ has: page.getByRole("button", { name: /^(Assign|Reassign)$/ }) })
      .first();
    const room = (await card.getAttribute("aria-label"))!;
    await card.getByRole("button", { name: /^(Assign|Reassign)$/ }).click();
    await page.getByRole("dialog").getByLabel("Housekeeper").selectOption({ label: "Hassan Ali" });
    await page.getByRole("dialog").getByRole("button", { name: "Assign", exact: true }).click();
    await expect(page.getByText(`${room} assigned`)).toBeVisible();

    await signIn(page, HOUSEKEEPER);
    await page.getByRole("button", { name: /Notifications, \d+ unread/ }).click();
    await page
      .getByRole("dialog", { name: "Notifications" })
      .getByRole("button", { name: new RegExp(`${room} is yours to clean`) })
      .first()
      .click();
    await expect(page).toHaveURL(/\/housekeeping$/);
  });

  test("a manager reads the audit log as plain sentences", async ({ page }) => {
    await signIn(page, MANAGER);
    await page.goto("/staff");
    await page.getByRole("tab", { name: "Audit Log" }).click();
    // Newest first: the manager's own sign-in, then the demo's real activity with links.
    await expect(page.getByRole("listitem").first()).toContainText("Mona Farid signed in");
    await expect(
      page.getByRole("link", { name: /^(#BK-\d+|Room \d+|MT-\d+ · .+|INV-\d+)$/ }).first(),
    ).toBeVisible();
  });

  test("the front desk attaches an ID scan to a guest and removes it", async ({ page }) => {
    await signIn(page, RECEPTIONIST);
    await page.goto("/guests");
    await page.locator('a[href^="/guests/gst_"]').first().click();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await page.getByLabel("Choose a file to attach").setInputFiles({
      name: "passport-scan.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 test passport scan"),
    });
    await expect(page.getByText("passport-scan.pdf attached")).toBeVisible();
    const row = page.getByRole("listitem").filter({ hasText: "passport-scan.pdf" });
    await expect(row).toContainText("ID document");
    await row.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Document removed")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "passport-scan.pdf" })).toHaveCount(
      0,
    );
  });
});
