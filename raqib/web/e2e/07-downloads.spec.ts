import { expect, test } from "@playwright/test";
import { ACCOUNTS, signIn, useEnglish } from "./helpers";

/** The files a manager takes away: figures and the audit trail as CSV or Excel, and an issued report as a PDF. */
test.describe("downloads", () => {
  test.beforeEach(async ({ page }) => {
    await useEnglish(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, ACCOUNTS.qm);
  });

  for (const [screen, base] of [
    ["analytics", "raqib-analytics"],
    ["audit", "raqib-audit"],
  ] as const) {
    test(`${screen} exports as CSV and as an Excel workbook`, async ({ page }) => {
      await page.goto(`/${screen}`);
      for (const [label, ext] of [
        ["Export CSV", "csv"],
        ["Export Excel", "xlsx"],
      ] as const) {
        const [file] = await Promise.all([
          page.waitForEvent("download"),
          page.getByRole("button", { name: label }).click(),
        ]);
        expect(file.suggestedFilename()).toBe(`${base}.${ext}`);
      }
    });
  }

  test("an issued report downloads as a PDF", async ({ page }) => {
    await page.goto("/reports");
    const pdf = page.getByRole("button", { name: "PDF" }).first();
    await expect(pdf).toBeVisible();
    const download = page.waitForEvent("download", { timeout: 20_000 }).catch(() => null);
    await pdf.click();
    const file = await download;
    // Without a Chromium on the server (RAQIB_CHROMIUM_PATH) the product says so instead of downloading
    test.skip(!file, "PDF rendering needs RAQIB_CHROMIUM_PATH on the server");
    expect(file!.suggestedFilename()).toMatch(/\.pdf$/);
  });
});
