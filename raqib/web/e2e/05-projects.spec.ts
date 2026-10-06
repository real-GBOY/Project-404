import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, signIn, inEnglish } from "./helpers";

/**
 * The set-up flow a new customer goes through, entirely in the browser: create a project, give it a site and an area, add a
 * guard to its roster, then take the guard off it again. Every step is validated and stored by the real backend.
 */
const run = Math.random().toString(36).slice(2, 7).toUpperCase();
const CODE = `PRJ-E2E-${run}`;

const dialog = (page: Page) => page.getByRole("dialog");
const fill = (page: Page, label: string, value: string) =>
  dialog(page).getByLabel(label, { exact: true }).fill(value);

test.describe("setting up a project and its guards", () => {
  test.beforeEach(async ({ page }) => {
    await inEnglish(page);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("a quality manager creates a project, a site, an area and a guard", async ({ page }) => {
    await signIn(page, ACCOUNTS.qm);

    // a project, with a code that is checked before it is sent
    await page.goto("/projects");
    await page.getByRole("button", { name: "New project" }).click();
    await fill(page, "Project code", "bad code");
    await fill(page, "Name (Arabic)", "مشروع الاختبار");
    await fill(page, "Name (English)", `E2E Project ${run}`);
    await dialog(page).getByRole("button", { name: "Create" }).click();
    await expect(dialog(page)).toBeVisible(); // refused locally: the code has spaces
    await fill(page, "Project code", CODE);
    await dialog(page).getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Project created")).toBeVisible();
    await expect(page.getByText(`E2E Project ${run}`).first()).toBeVisible();

    // the same code again is refused by the server, with its message shown
    await page.getByRole("button", { name: "New project" }).click();
    await fill(page, "Project code", CODE);
    await fill(page, "Name (Arabic)", "مكرر");
    await fill(page, "Name (English)", "Duplicate");
    await dialog(page).getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(/already|taken|exists/i).first()).toBeVisible();
    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    // a site and an area on it
    await page.getByText(`E2E Project ${run}`).first().click();
    await page.getByRole("button", { name: "Sites & areas" }).click();
    await expect(page.getByText("No sites yet")).toBeVisible();
    await page.getByRole("button", { name: "Add site" }).click();
    await fill(page, "Name (Arabic)", "البوابة الشمالية");
    await fill(page, "Name (English)", "North Gate");
    await dialog(page).getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Site added")).toBeVisible();
    await expect(page.getByText("North Gate")).toBeVisible();
    await page.getByRole("button", { name: "Add area" }).click();
    await fill(page, "Name (Arabic)", "غرفة التحكم");
    await fill(page, "Name (English)", "Control Room");
    await dialog(page).getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Area added")).toBeVisible();
    await expect(page.getByText("Control Room")).toBeVisible();

    // a guard on that project
    await page.goto("/guards");
    await page.getByRole("button", { name: "Add guard" }).click();
    await dialog(page)
      .getByLabel("Project", { exact: true })
      .selectOption({ label: `E2E Project ${run}` });
    await fill(page, "Employee number", `E2E-${run}`);
    await fill(page, "National ID", "12345");
    await fill(page, "Name (Arabic)", "حارس الاختبار");
    await fill(page, "Name (English)", `E2E Guard ${run}`);
    await dialog(page).getByRole("button", { name: "Add" }).click();
    await expect(dialog(page)).toBeVisible(); // a national ID is ten digits
    await fill(page, "National ID", "1234567890");
    await dialog(page).getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Guard added")).toBeVisible();
    const row = page
      .locator("div")
      .filter({ hasText: `E2E Guard ${run}` })
      .last();
    await expect(row).toBeVisible();

    // and off the roster again
    await page
      .getByText(`E2E Guard ${run}`)
      .locator("xpath=ancestor::div[button][1]")
      .getByRole("button", { name: "Deactivate" })
      .click();
    await dialog(page).getByRole("button", { name: "Deactivate" }).click();
    await expect(page.getByText("Guard deactivated")).toBeVisible();
  });

  test("a role without the edit right is not offered the buttons", async ({ page }) => {
    await signIn(page, ACCOUNTS.pm);
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New project" })).toHaveCount(0);
  });
});
