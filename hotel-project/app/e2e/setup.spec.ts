import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/** Demo staff seeded by hotel-project/backend/app/hotel/demo/demo-data.ts. */
const MANAGER = "mona.farid@hoteltransylvania.com";
const HOUSEKEEPING = "hassan.ali@hoteltransylvania.com";

async function openNav(page: Page, isMobile: boolean, label: string) {
  if (isMobile) await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("complementary", { name: "Main navigation" })
    .getByRole("link", { name: label })
    .click();
}

test.describe("property setup (Slice 1)", () => {
  test("a manager sees the whole room board and the Transylvania room types", async ({
    page,
    isMobile,
  }) => {
    await signIn(page, MANAGER);
    // The name/role label is desktop-only; phones show just the avatar.
    if (!isMobile) await expect(page.getByText("Manager", { exact: true })).toBeVisible();
    await openNav(page, isMobile, "Rooms");

    const tabs = page.getByRole("tablist", { name: "Filter rooms by status" });
    await expect(tabs.getByRole("tab", { name: /All\s*40/ })).toBeVisible();
    await expect(page.getByText("Serenity Suite", { exact: true })).toBeVisible();
    await expect(page.getByText("9,800 EGP")).toBeVisible();
  });

  test("a manager registers a guest, lands on the profile and leaves a note", async ({
    page,
    isMobile,
  }) => {
    const name = `Salma Guest ${isMobile ? "M" : "D"}${Date.now() % 100000}`;
    await signIn(page, MANAGER);
    await openNav(page, isMobile, "Guests");
    await page.getByRole("button", { name: "+ New guest" }).click();
    const dialog = page.getByRole("dialog", { name: "New guest" });
    await dialog.getByLabel("Full name").fill(name);
    await dialog.getByLabel("Phone").fill("+20 100 777 1234");
    await dialog.getByRole("button", { name: "Save guest" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
    await page.getByLabel("Add a note").fill("Asked for a quiet room.");
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("Asked for a quiet room.")).toBeVisible();
    await expect(page.getByText(/Mona Farid · /)).toBeVisible();

    await page.getByRole("link", { name: "← Back to Guests" }).click();
    await page.getByRole("searchbox", { name: "Search guests" }).fill(name);
    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  });

  test("the staff directory and read-only role matrix", async ({ page, isMobile }) => {
    await signIn(page, MANAGER);
    await openNav(page, isMobile, "Staff & Permissions");
    await expect(page.getByText("Hassan Ali")).toBeVisible();
    await page.getByRole("tab", { name: "Roles & Permissions" }).click();
    await page
      .getByRole("tablist", { name: "Roles" })
      .getByRole("tab", { name: "Housekeeping" })
      .click();
    await expect(page.getByLabel("Not allowed").first()).toBeVisible();
  });

  test("housekeeping only sees what their role allows", async ({ page, isMobile }) => {
    await signIn(page, HOUSEKEEPING);
    if (isMobile) await page.getByRole("button", { name: "Open navigation" }).click();
    const nav = page.getByRole("complementary", { name: "Main navigation" });
    await expect(nav.getByRole("link", { name: "Rooms" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Guests" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Staff & Permissions" })).toHaveCount(0);

    // Typing the URL does not get around it: the API refuses and the page says so.
    await page.goto("/guests");
    await expect(page.getByRole("alert")).toContainText("don't have access");
  });
});
