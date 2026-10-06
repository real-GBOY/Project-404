import { expect, test } from "@playwright/test";
import { ACCOUNTS, signIn, inEnglish } from "./helpers";

/** The files a manager takes away: figures and the audit trail as CSV or Excel, and an issued report printed to PDF by the browser. */
test.describe("downloads", () => {
  test.beforeEach(async ({ page }) => {
    await inEnglish(page);
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

  test("an issued report prints to PDF from the browser, with no server rendering", async ({
    page,
  }) => {
    // a real print dialog cannot be driven: intercept print() on the report frame and record what would have been printed
    const printed: Array<{ title: string; dir: string; text: string }> = [];
    await page.exposeFunction("__printed", (p: { title: string; dir: string; text: string }) =>
      printed.push(p),
    );
    await page.addInitScript(() => {
      const desc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentWindow")!;
      Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
        get() {
          const w = desc.get!.call(this) as (Window & { __patched?: boolean }) | null;
          if (w && !w.__patched) {
            w.__patched = true;
            const frame = this as HTMLIFrameElement;
            w.print = () => {
              (window as unknown as { __printed: (p: unknown) => void }).__printed({
                title: frame.contentDocument!.title,
                dir: frame.contentDocument!.documentElement.dir,
                text: frame.contentDocument!.body.innerText.slice(0, 600),
              });
              w.dispatchEvent(new Event("afterprint")); // as the browser does when the dialog closes
            };
          }
          return w;
        },
      });
    });
    await page.goto("/reports");
    const first = page.getByRole("button", { name: "PDF" }).first();
    await expect(first).toBeVisible();
    await first.click();
    await expect.poll(() => printed.length, { timeout: 20_000 }).toBe(1);
    expect(printed[0]!.title).toMatch(/^RPT-[\d-]+-en$/); // the suggested file name
    expect(printed[0]!.dir).toBe("ltr");
    expect(printed[0]!.text).toContain("RPT-");
    await expect(page.getByText("Save as PDF")).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0); // the frame cleans itself up
  });
});
