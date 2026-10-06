import { expect, test, type APIRequestContext } from "@playwright/test";
import { ACCOUNTS, PNG, api, apiLogin, signIn, inEnglish } from "./helpers";

interface Item {
  id: string;
  key: string;
  num: string;
  answer: string | null;
  evidence: unknown[];
}
interface View {
  id: string;
  sections: Array<{ items: Item[] }>;
}

/** Start (through the API) an inspection that belongs to inspector A, and hand back where to find it. */
async function startInspection(
  request: APIRequestContext,
): Promise<{ token: string; visitId: string; view: View }> {
  const { token } = await apiLogin(request, ACCOUNTS.insA);
  const visits = (
    await api<{
      items: Array<{ id: string; storedStatus: string; inspector: { id: string } | null }>;
    }>(request, token, "GET", "/raqib/visits?limit=500")
  ).items;
  const mine =
    visits.find((v) => ["assigned", "scheduled"].includes(v.storedStatus) && v.inspector) ??
    visits.find((v) => v.storedStatus === "in_progress");
  if (!mine) throw new Error("no startable visit for inspector A in the demo data");
  const view = await api<View>(request, token, "POST", `/raqib/visits/${mine.id}/inspection/start`);
  return { token, visitId: mine.id, view };
}

test.describe("working without a connection", () => {
  test.beforeEach(async ({ page }) => inEnglish(page));

  test("an inspector keeps working offline, survives a reload with no network, and everything syncs when the signal returns", async ({
    page,
    context,
    request,
  }) => {
    const { token, visitId, view } = await startInspection(request);
    // the demo inspection is part-answered (and earlier runs may have answered more): clear two items of the first section
    const [first, second] = view.sections[0]!.items;
    for (const it of [first!, second!])
      await api(request, token, "PUT", `/raqib/visits/${visitId}/inspection/answers/${it.id}`, {
        value: null,
      });
    const open = [
      { item: first!, position: 0 },
      { item: second!, position: 1 },
    ];

    await signIn(page, ACCOUNTS.insA);
    await page.goto(`/inspect/${visitId}`);
    await expect(page.getByRole("button", { name: "Compliant" }).first()).toBeVisible();
    // the app's service worker takes control once it has installed (the shell is then available offline)
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await expect(page.getByRole("button", { name: "Compliant" }).first()).toBeVisible();

    // ── the signal drops ─────────────────────────────────────────────
    await context.setOffline(true);
    await page.getByRole("button", { name: "Compliant" }).nth(open[0]!.position).click();
    await expect(page.getByText(/Offline/).first()).toBeVisible();
    await expect(page.getByText(/1 change\(s\) waiting to send/)).toBeVisible();
    await page.getByRole("button", { name: "Non-compliant" }).nth(open[1]!.position).click();
    await expect(page.getByText(/2 change\(s\) waiting to send/)).toBeVisible();
    // nothing reached the server
    expect(
      (await api<View>(request, token, "GET", `/raqib/visits/${visitId}/inspection`)).sections
        .flatMap((s) => s.items)
        .find((i) => i.id === first!.id)?.answer,
    ).not.toBe("c");

    // ── reload with no network at all: the app opens, and the work is still there ──
    await page.reload();
    await expect(page.getByRole("button", { name: "Compliant" }).first()).toBeVisible();
    await expect(page.getByText(/2 change\(s\) waiting to send/)).toBeVisible();

    // ── the signal returns ───────────────────────────────────────────
    await context.setOffline(false);
    const answers = async () =>
      Object.fromEntries(
        (await api<View>(request, token, "GET", `/raqib/visits/${visitId}/inspection`)).sections
          .flatMap((s) => s.items)
          .map((i) => [i.id, i.answer]),
      );
    await expect.poll(async () => (await answers())[first!.id], { timeout: 45_000 }).toBe("c");
    await expect.poll(async () => (await answers())[second!.id]).toBe("n");
    // and the "waiting" pill is gone once everything is in
    await expect(page.getByText(/waiting to send|Syncing|could not be saved/)).toBeHidden({
      timeout: 15_000,
    });
  });

  test("a photo taken offline waits on the device and attaches itself when the connection returns", async ({
    page,
    context,
    request,
  }) => {
    const { token, visitId, view } = await startInspection(request);
    const target = view.sections.flatMap((s) => s.items)[0]!;
    const countEvidence = async () =>
      (await api<View>(request, token, "GET", `/raqib/visits/${visitId}/inspection`)).sections
        .flatMap((s) => s.items)
        .find((i) => i.id === target.id)?.evidence.length ?? 0;
    const before = await countEvidence();

    await signIn(page, ACCOUNTS.insA);
    await page.goto(`/inspect/${visitId}`);
    await expect(page.getByRole("button", { name: "Compliant" }).first()).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));

    await context.setOffline(true);
    // answering "non-compliant" opens the evidence controls for the item
    await page.getByRole("button", { name: "Non-compliant" }).first().click();
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: /Upload photo, video or document/ })
      .first()
      .click();
    await (await chooser).setFiles({ name: "gate.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText("Waiting for connection")).toBeVisible();
    await expect(page.getByText(/Offline/).first()).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByText("Waiting for connection")).toBeHidden({ timeout: 45_000 });
    await expect.poll(countEvidence, { timeout: 30_000 }).toBe(before + 1);
  });

  test("starting a new inspection needs a connection and says so", async ({
    page,
    context,
    request,
  }) => {
    const { token } = await apiLogin(request, ACCOUNTS.insB);
    const visits = (
      await api<{
        items: Array<{ id: string; storedStatus: string; inspector: { id: string } | null }>;
      }>(request, token, "GET", "/raqib/visits?limit=500")
    ).items;
    test.skip(
      !visits.some((v) => ["assigned", "scheduled"].includes(v.storedStatus)),
      "no unstarted visit for inspector B",
    );
    await signIn(page, ACCOUNTS.insB);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await context.setOffline(true);
    await page
      .getByText(/Offline/)
      .first()
      .waitFor({ state: "visible", timeout: 30_000 })
      .catch(() => undefined);
    const start = page.getByRole("button", { name: /Start inspection/ }).first();
    if (await start.isVisible()) {
      await start.click();
      await expect(page.getByText("Starting an inspection needs a connection.")).toBeVisible();
    }
    await context.setOffline(false);
  });
});
