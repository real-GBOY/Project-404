import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, api, apiLogin, asUser, inEnglish, signIn } from "./helpers";

/**
 * Client feedback round 1, in a real browser against the real backend: the people authorised to configure scoring do so
 * from Settings; a visit with several forms shows a form switcher and blank forms to print; the inspector never sees a
 * score; the schedule has a month view with export and print; Arabic works on a phone.
 */
const dialog = (page: Page) => page.getByRole("dialog");

type Visit = {
  id: string;
  ref: string;
  inspector?: { id: string; name: { en: string } };
  project: { id: string };
  site: { id: string };
};

test.describe("client feedback round 1", () => {
  test.beforeEach(async ({ page }) => {
    await inEnglish(page);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("the General Manager names the scoring manager, who publishes the approved deduction values from Settings", async ({
    page,
    browser,
  }) => {
    await signIn(page, ACCOUNTS.gm);
    await page.goto("/settings");
    await page.getByRole("button", { name: "Scoring rules", exact: true }).click();
    await expect(page.getByText(/Not set: the earlier scoring applies/)).toBeVisible();
    await page.getByRole("button", { name: "Name", exact: true }).click();
    await expect(
      dialog(page).getByRole("heading", { name: "Name a scoring manager" }),
    ).toBeVisible();
    const option = dialog(page).locator("option", { hasText: "Saud Al-Otaibi" });
    await dialog(page)
      .locator("select")
      .selectOption((await option.getAttribute("value"))!);
    await dialog(page).getByRole("button", { name: "Name", exact: true }).click();
    await expect(page.getByText("Scoring manager named").first()).toBeVisible();

    const qm = await asUser(browser, ACCOUNTS.qm);
    await qm.goto("/settings");
    await qm.getByRole("button", { name: "Scoring rules", exact: true }).click();
    await qm.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(
      dialog(qm).getByRole("heading", { name: "Publish deduction values" }),
    ).toBeVisible();
    // the three severity amounts are required, and the reason too
    await dialog(qm).getByRole("button", { name: "Publish", exact: true }).click();
    await expect(dialog(qm)).toBeVisible();
    const boxes = dialog(qm).locator("input[type='text']");
    await boxes.nth(0).fill("10");
    await boxes.nth(1).fill("5");
    await boxes.nth(2).fill("2");
    await dialog(qm).locator("textarea").first().fill("q9 = 12");
    await dialog(qm).getByLabel("Reason (required)").fill("Approved deduction table (e2e)");
    await dialog(qm).getByRole("button", { name: "Publish", exact: true }).click();
    await expect(qm.getByText("New deduction values published").first()).toBeVisible();
    await expect(qm.getByText(/Version 1 · base 100/)).toBeVisible();
    await qm.context().close();
  });

  test("settings offer shifts and escalation, with the starting values clearly marked", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.qm);
    await page.goto("/settings");
    await page.getByRole("button", { name: "Shifts & scheduling", exact: true }).click();
    await expect(page.getByText("1. Shift name (English) · morning")).toBeVisible();
    await expect(page.getByText("Minimum rest between two shifts")).toBeVisible();
    await page.getByRole("button", { name: "Escalation", exact: true }).click();
    await expect(page.getByText("Level 1: after how many days")).toBeVisible();
    await expect(page.getByText("Level 3: who is told")).toBeVisible();
    await expect(page.getByText(/assumptions until the client confirms/)).toBeVisible();
    await page.screenshot({
      path: "test-results/feedback1-settings-escalation.png",
      fullPage: true,
    });
  });

  test("the schedule has a month view and exports and prints the period", async ({ page }) => {
    await signIn(page, ACCOUNTS.qm);
    await page.goto("/visits");
    await page.getByRole("button", { name: "Month", exact: true }).click();
    await expect(page.locator("[data-day]")).not.toHaveCount(0);
    expect(await page.locator("[data-day]").count()).toBeGreaterThanOrEqual(28);
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
    await page.screenshot({ path: "test-results/feedback1-schedule-month.png", fullPage: true });
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^raqib-schedule-.*\.csv$/);
    await expect(page.getByRole("button", { name: "Print schedule" })).toBeVisible();

    // the inspector has neither
    const ins = await asUser(page.context().browser()!, ACCOUNTS.insA);
    await ins.goto("/visits");
    await expect(ins.getByRole("button", { name: "Export CSV" })).toHaveCount(0);
    await expect(ins.getByRole("button", { name: "Print schedule" })).toHaveCount(0);
    await ins.context().close();
  });

  test("a visit with two forms: blank forms to print, a form switcher for the inspector, and no score for them", async ({
    page,
    request,
    browser,
  }) => {
    const qmToken = (await apiLogin(request, ACCOUNTS.qm)).token;
    const visits = (
      await api<{ items: Visit[] }>(request, qmToken, "GET", "/raqib/visits")
    ).items.filter((v) => v.inspector?.name.en === "Khalid Al-Shehri");
    const base = visits[0]!;
    const forms = (
      await api<{ items: Array<{ id: string; code: string }> }>(
        request,
        qmToken,
        "GET",
        "/raqib/visits/forms/available",
      )
    ).items;
    const made = await api<Visit>(request, qmToken, "POST", "/raqib/visits", {
      projectId: base.project.id,
      siteId: base.site.id,
      inspectorId: base.inspector!.id,
      type: "routine",
      shift: "morning",
      date: "2027-03-15",
      time: "14:30",
      guardIds: [],
      // the security form leads, the health-and-safety form follows
      formIds: ["FRM-SEC-01", "FRM-HSP-01"].map((code) => forms.find((f) => f.code === code)!.id),
      reason: "two forms (e2e)",
    });

    // the schedule dialog offers the forms
    await signIn(page, ACCOUNTS.qm);
    await page.goto("/visits");
    await page
      .getByRole("button", { name: /Schedule visit|New visit/ })
      .first()
      .click();
    await expect(dialog(page).getByText("Required forms")).toBeVisible();
    expect(await dialog(page).locator("input[type='checkbox']").count()).toBeGreaterThanOrEqual(2);
    await dialog(page)
      .getByRole("button", { name: /Cancel|Close/ })
      .first()
      .click();

    const ins = await asUser(browser, ACCOUNTS.insA);
    await ins.goto(`/visit/${made.id}`);
    await expect(ins.getByRole("button", { name: /Print blank FRM-SEC-01/ })).toBeVisible();
    await expect(ins.getByRole("button", { name: /Print blank FRM-HSP-01/ })).toBeVisible();
    await expect(ins.getByText(/2:30 PM/i).first()).toBeVisible(); // 12-hour time
    await ins.getByRole("button", { name: /Start inspection/ }).click();
    await expect(ins.getByText("FRM-SEC-01 · INS-").first()).toBeVisible();
    await expect(ins.getByText("Not started").first()).toBeVisible(); // the second form waits to be opened
    await expect(ins.getByText("Current score")).toHaveCount(0); // an inspector never sees a score
    await ins.screenshot({ path: "test-results/feedback1-workspace-forms.png", fullPage: true });
    await ins.context().close();
  });

  test("Arabic on a phone: right-to-left, no sideways scrolling, the inspector's home and visit list", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      locale: "ar-SA",
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await inEnglish(page);
    await signIn(page, ACCOUNTS.insA);
    // switch the interface to Arabic, as the person would from My settings
    // (the English init script of inEnglish runs on every load, so Arabic is set by a later one)
    await page.addInitScript(() => localStorage.setItem("raqib.lang", "ar"));
    await page.reload();
    await expect(page.getByRole("button", { name: /^الإشعارات/ }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
    expect(await overflow()).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-results/feedback1-mobile-ar-home.png", fullPage: true });
    await page.goto("/visits");
    await expect(page.locator("body")).toContainText(/[؀-ۿ]/);
    expect(await overflow()).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-results/feedback1-mobile-ar-visits.png", fullPage: true });
    await context.close();
  });
});
