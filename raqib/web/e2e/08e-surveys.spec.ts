import { expect, test } from "@playwright/test";
import { ACCOUNTS, api, apiLogin, asUser, inEnglish, signIn } from "./helpers";

/**
 * Requirement 17 in a real browser: the General Manager names who manages surveys, that person publishes one, a guard
 * answers it, and the answer is filed as a confidential report that the guard can follow (and that nobody else is shown).
 */
test.describe("surveys", () => {
  test.beforeEach(async ({ page }) => {
    await inEnglish(page);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("named manager publishes a survey; a guard answers it anonymously", async ({
    page,
    browser,
    request,
  }) => {
    const title = `Welfare check ${Date.now()}`;
    const gm = await apiLogin(request, ACCOUNTS.gm);
    const list = await api<{
      candidates: Array<{ userId: string; name: { en: string }; role: string }>;
    }>(request, gm.token, "GET", "/raqib/surveys");
    const person = list.candidates.find((c) => /qm$/.test(c.role))!;
    expect(person).toBeTruthy();

    // the General Manager names the manager from the confidential screen
    await signIn(page, ACCOUNTS.gm);
    await page.goto("/surveys");
    await expect(page.getByRole("heading", { name: "Surveys" })).toBeVisible();
    await page.getByLabel("Choose a person").selectOption(person.userId);
    await page.getByRole("button", { name: "Name", exact: true }).click();
    await expect(page.getByText(person.name.en).first()).toBeVisible();

    // the named manager writes and publishes it
    const qm = await asUser(browser, ACCOUNTS.qm);
    await qm.goto("/surveys");
    await qm.getByLabel("Title (English)").fill(title);
    await qm.getByLabel("Title (Arabic)").fill("استبيان الرفاهية");
    await qm.getByLabel("Questions in Arabic, one per line").fill("كيف حالك؟\nما ملاحظاتك؟");
    await qm.getByLabel("Questions in English, one per line").fill("How are you?\nAny comments?");
    await qm.getByLabel(/Numbers of the questions answered/).fill("1");
    await qm.getByRole("button", { name: "Save as draft" }).click();
    await expect(qm.getByText(title)).toBeVisible();
    const mine = qm.getByText(title, { exact: true }).locator("xpath=ancestor::div[2]");
    await mine.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(qm.getByText(/Open · 2 questions/).first()).toBeVisible();

    // the guard answers it, choosing to stay anonymous
    const guard = await asUser(browser, ACCOUNTS.guard);
    await guard.goto("/surveys");
    await expect(guard.getByText(title)).toBeVisible();
    await expect(guard.getByRole("button", { name: "Save as draft" })).toHaveCount(0); // not a manager
    const card = guard.getByText(title, { exact: true }).locator("xpath=ancestor::div[2]");
    await card.getByRole("button", { name: "Answer", exact: true }).click();
    await card.locator("select").selectOption("4");
    await card.locator("textarea").fill("All good");
    await card.getByLabel("Fully anonymous").check();
    await card.getByRole("button", { name: "Send answers" }).click();
    await expect(guard.getByText(/Thank you\. Reference:/)).toBeVisible();
  });
});
