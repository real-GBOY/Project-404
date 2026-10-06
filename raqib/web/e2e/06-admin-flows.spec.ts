import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, api, apiLogin, signIn, inEnglish } from "./helpers";

/**
 * The upkeep flows that keep a running system workable: naming a new inspection form, raising a field observation,
 * correcting a person's record, and handing a stuck corrective action to someone else. Each goes through the real backend.
 */
const run = Math.random().toString(36).slice(2, 7).toUpperCase();
const dialog = (page: Page) => page.getByRole("dialog");
const fill = (page: Page, label: string, value: string) =>
  dialog(page).getByLabel(label, { exact: true }).fill(value);

test.describe("keeping the system workable", () => {
  test.beforeEach(async ({ page }) => {
    await inEnglish(page);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("a new inspection form gets a real code and name, and can be renamed", async ({ page }) => {
    await signIn(page, ACCOUNTS.qm);
    await page.goto("/forms");
    await page.getByRole("button", { name: "New form" }).click();
    await fill(page, "Form code", `FRM-${run}`);
    await fill(page, "Name (Arabic)", "نموذج اختبار");
    await fill(page, "Name (English)", `E2E Form ${run}`);
    await dialog(page).getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Form created")).toBeVisible();
    await expect(page.locator(`input[value="E2E Form ${run}"]`)).toBeVisible();
    await page.getByRole("button", { name: "Rename" }).click();
    await fill(page, "Name (English)", `E2E Form ${run} v2`);
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Form renamed")).toBeVisible();
    await expect(page.locator(`input[value="E2E Form ${run} v2"]`)).toBeVisible();
  });

  test("an observation is raised from the field and shows with no action yet", async ({ page }) => {
    await signIn(page, ACCOUNTS.qm);
    await page.goto("/observations");
    await page.getByRole("button", { name: "Raise observation" }).click();
    await dialog(page).getByLabel("Project", { exact: true }).selectOption({ index: 1 });
    await dialog(page).getByLabel("Site", { exact: true }).selectOption({ index: 1 });
    await dialog(page).getByRole("button", { name: "Record" }).click();
    await expect(dialog(page)).toBeVisible(); // what was observed is required
    await dialog(page).getByLabel("What was observed").fill(`E2E finding ${run}`);
    await dialog(page).getByRole("button", { name: "Record" }).click();
    await expect(page.getByText("Observation recorded")).toBeVisible();
    await expect(page.getByText(`E2E finding ${run}`).first()).toBeVisible();
  });

  test("a person's record is corrected from their page", async ({ page, request }) => {
    const { token } = await apiLogin(request, ACCOUNTS.qm);
    const users = (
      await api<{ items: Array<{ id: string; email: string }> }>(
        request,
        token,
        "GET",
        "/raqib/users",
      )
    ).items;
    const ins = users.find((u) => u.email === ACCOUNTS.insB)!;
    await signIn(page, ACCOUNTS.qm);
    await page.goto(`/user/${ins.id}`);
    await page.getByRole("button", { name: "Edit details" }).click();
    await fill(page, "Title (English)", `Senior Inspector ${run}`);
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Details saved")).toBeVisible();
    await expect(page.getByText(`Senior Inspector ${run}`).first()).toBeVisible();
  });

  test("a stuck corrective action is moved to a new date with a reason", async ({
    page,
    request,
  }) => {
    const { token } = await apiLogin(request, ACCOUNTS.qm);
    const open = (
      await api<{ items: Array<{ id: string; storedStatus: string }> }>(
        request,
        token,
        "GET",
        "/raqib/actions",
      )
    ).items.find((a) => a.storedStatus === "assigned")!;
    await signIn(page, ACCOUNTS.qm);
    await page.goto(`/action/${open.id}`);
    await page.getByRole("button", { name: "Reassign / change due date" }).click();
    // the people who can take the action are listed (the current owner at least), so it can be handed to someone else
    await expect(
      dialog(page).getByLabel("Responsible", { exact: true }).locator("option").first(),
    ).toBeAttached();
    expect(await dialog(page).getByLabel("Responsible", { exact: true }).inputValue()).not.toBe("");
    // a date that differs from whatever earlier runs left, so the change is always a real one
    const due = new Date(Date.now() + (40 + (Date.now() % 300)) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    await dialog(page).getByLabel("Due date", { exact: false }).first().fill(due);
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(dialog(page)).toBeVisible(); // a reason is required
    await dialog(page).locator("textarea").fill("Waiting for the supplier.");
    await dialog(page).getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Assignment updated")).toBeVisible();
    await expect(page.getByText("Waiting for the supplier.").first()).toBeVisible();
  });
});
