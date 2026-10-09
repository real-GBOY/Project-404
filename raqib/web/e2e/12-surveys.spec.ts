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
    const person = list.candidates.find((c) => /qe$/.test(c.role))!;
    expect(person).toBeTruthy();

    // the General Manager names the manager from the confidential screen
    await signIn(page, ACCOUNTS.gm);
    await page.goto("/surveys");
    await expect(page.getByRole("heading", { name: "Surveys" })).toBeVisible();
    await page.getByLabel("Choose a person").selectOption(person.userId);
    await page.getByRole("button", { name: "Name", exact: true }).click();
    await expect(page.getByText(person.name.en).first()).toBeVisible();

    // the named manager writes and publishes it
    const qe = await asUser(browser, ACCOUNTS.qe);
    await qe.goto("/surveys");
    await qe.getByLabel("Title (English)").fill(title);
    await qe.getByLabel("Title (Arabic)").fill("استبيان الرفاهية");
    await qe.getByLabel("Questions in Arabic, one per line").fill("كيف حالك؟\nما ملاحظاتك؟");
    await qe.getByLabel("Questions in English, one per line").fill("How are you?\nAny comments?");
    await qe.getByLabel(/Numbers of the questions answered/).fill("1");
    await qe.getByRole("button", { name: "Save as draft" }).click();
    await expect(qe.getByText(title)).toBeVisible();
    await qe.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(qe.getByText(/Open · 2 questions/).first()).toBeVisible();

    // the guard answers it, choosing to stay anonymous
    const guard = await asUser(browser, ACCOUNTS.guard);
    await guard.goto("/surveys");
    await expect(guard.getByText(title)).toBeVisible();
    await expect(guard.getByRole("button", { name: "Save as draft" })).toHaveCount(0); // not a manager
    await guard.getByRole("button", { name: "Answer", exact: true }).last().click();
    await guard.locator("select").last().selectOption("4");
    await guard.locator("textarea").last().fill("All good");
    await guard.getByLabel("Fully anonymous").check();
    await guard.getByRole("button", { name: "Send answers" }).click();
    await expect(guard.getByText(/Thank you\. Reference:/)).toBeVisible();
  });
});
