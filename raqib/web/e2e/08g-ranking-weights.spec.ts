import { expect, test } from "@playwright/test";
import { ACCOUNTS, api, apiLogin, inEnglish, signIn } from "./helpers";

/** Requirement 15: the ranking weights are edited from Settings and saved with the other organization settings. */
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

test("the quality manager changes a ranking weight from Settings", async ({ page, request }) => {
  await inEnglish(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, ACCOUNTS.qm);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Project ranking", exact: true }).click();
  const box = page
    .getByText("Weight: complaints", { exact: true })
    .locator("xpath=following::input[1]");
  await expect(box).toHaveValue("1");
  await box.fill("3");
  await page.getByRole("button", { name: "Save changes" }).click();
  const dlg = page.getByRole("dialog");
  if (await dlg.isVisible().catch(() => false)) {
    await dlg.locator("textarea, input").first().fill("Complaints matter most (e2e)");
    await dlg.getByRole("button", { name: /Save|Confirm|Apply/ }).click();
  }
  const qm = await apiLogin(request, ACCOUNTS.qm);
  await expect
    .poll(
      async () =>
        ((await api<Json>(request, qm.token, "GET", "/raqib/settings")).ranking as Json).weights
          .complaints,
    )
    .toBe(3);
});
