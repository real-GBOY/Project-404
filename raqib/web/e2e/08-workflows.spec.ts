import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, API_ORIGIN, PNG, api, apiLogin, asUser, nextIp } from "./helpers";

/**
 * The work that passes between roles, driven through the screens: an inspection is reviewed and approved, a finding becomes a
 * corrective action that is worked, returned and closed, and a training request is raised, approved, scheduled and completed.
 * Every step is a real button on a real screen against the real backend.
 */
const today = new Date().toLocaleDateString("en-CA"); // a training cannot be recorded as done in the future
const run = Math.random().toString(36).slice(2, 7).toUpperCase();
const dialog = (page: Page) => page.getByRole("dialog");
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

test.describe("work passing between roles", () => {
  test.describe.configure({ timeout: 180_000 });

  test("an inspection waiting for review is forwarded by quality staff and approved by the manager, which issues its report", async ({
    browser,
    request,
  }) => {
    const qe = await apiLogin(request, ACCOUNTS.qe);
    const visits = (
      await api<{ items: Json[] }>(request, qe.token, "GET", "/raqib/visits?limit=500")
    ).items;
    const waiting = visits.find((v) => v.status === "pending_review");
    test.skip(!waiting, "no inspection is waiting for review in this data");

    const review = await asUser(browser, ACCOUNTS.qe);
    await review.goto(`/review/${waiting!.id}`);
    await review.getByRole("button", { name: "Forward for approval" }).click();
    await dialog(review).getByRole("button", { name: "Forward", exact: true }).click();
    await expect(review.getByText(/forwarded for approval/).first()).toBeVisible();

    const manager = await asUser(browser, ACCOUNTS.qm);
    await manager.goto(`/review/${waiting!.id}`);
    await manager.getByRole("button", { name: "Approve & issue report" }).click();
    await dialog(manager).getByRole("button", { name: "Approve", exact: true }).click();
    await expect(manager.getByText(/approved and report issued/).first()).toBeVisible();

    const qm = await apiLogin(request, ACCOUNTS.qm);
    const reports = (
      await api<{ items: Json[] }>(request, qm.token, "GET", "/raqib/reports?limit=500")
    ).items;
    expect(reports.some((r) => r.visitId === waiting!.id)).toBe(true);
    await manager.goto("/reports");
    await expect(manager.getByText(waiting!.ref).first()).toBeVisible();
  });

  test("a finding becomes a corrective action that is worked, returned for better proof and closed", async ({
    browser,
    request,
  }) => {
    const pm = await apiLogin(request, ACCOUNTS.pm);
    const open = (
      await api<{ items: Json[] }>(request, pm.token, "GET", "/raqib/observations?limit=500")
    ).items.find((o) => !o.action);
    test.skip(!open, "every observation already has an action in this data");

    // quality management hands the finding to the project manager
    const manager = await asUser(browser, ACCOUNTS.qm);
    await manager.goto("/observations");
    await manager.getByText(open!.ref).first().click();
    await dialog(manager).getByLabel("Required action").fill(`Fix it properly ${run}`);
    await dialog(manager).locator("select").first().selectOption({ label: "Fahad Al-Dosari" });
    await dialog(manager).getByRole("button", { name: "Create & assign" }).click();
    await expect(manager.getByText(/created and assigned/)).toBeVisible();
    const action = (
      await api<{ items: Json[] }>(request, pm.token, "GET", "/raqib/actions?limit=500")
    ).items.find((a) => a.observation?.id === open!.id)!;

    const upload = async (page: Page, name: string) => {
      const [chooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.getByRole("button", { name: "Upload photo, video or document" }).click(),
      ]);
      await chooser.setFiles({ name, mimeType: "image/png", buffer: PNG });
      // the file shows, and nothing is still in flight: it is attached to the action, so submitting can use it
      await expect(page.getByText(name)).toBeVisible();
      await expect(page.getByText(/Uploading/i)).toHaveCount(0);
    };

    // the project manager works it, with closure evidence
    const owner = await asUser(browser, ACCOUNTS.pm);
    await owner.goto(`/action/${action.id}`);
    await owner.getByRole("button", { name: "Start work" }).click();
    await upload(owner, "first-proof.png");
    await owner.getByRole("button", { name: "Submit for quality review" }).click();
    await expect
      .poll(
        async () =>
          (await api<Json>(request, pm.token, "GET", `/raqib/actions/${action.id}`)).status,
      )
      .toBe("quality_review");

    // quality sends it back with a reason; the owner must show new proof
    const reviewer = await asUser(browser, ACCOUNTS.qe);
    await reviewer.goto(`/action/${action.id}`);
    await reviewer.getByRole("button", { name: "Return to responsible" }).click();
    await dialog(reviewer).locator("textarea").fill("The photo does not show the repaired item.");
    await dialog(reviewer).getByRole("button", { name: "Return", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await api<Json>(request, pm.token, "GET", `/raqib/actions/${action.id}`)).status,
      )
      .toBe("returned");
    await owner.goto(`/action/${action.id}`);
    await owner.getByRole("button", { name: "Start work" }).click();
    await upload(owner, "better-proof.png");
    await owner.getByRole("button", { name: "Submit for quality review" }).click();
    await expect
      .poll(
        async () =>
          (await api<Json>(request, pm.token, "GET", `/raqib/actions/${action.id}`)).status,
      )
      .toBe("quality_review");

    // the manager, who holds the approve right, closes it
    await manager.goto(`/action/${action.id}`);
    await manager.getByRole("button", { name: "Approve closure" }).click();
    await dialog(manager).getByRole("button", { name: "Close action", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await api<Json>(request, pm.token, "GET", `/raqib/actions/${action.id}`)).status,
      )
      .toBe("closed");
    expect((await api<Json>(request, pm.token, "GET", `/raqib/actions/${action.id}`)).round).toBe(
      2,
    );
  });

  test("a training request is raised, approved, scheduled and recorded as completed", async ({
    browser,
    request,
  }) => {
    const course = `Radio discipline ${run}`;
    const supervisor = await asUser(browser, ACCOUNTS.gs);
    await supervisor.goto("/training");
    await supervisor.getByRole("button", { name: "New training request" }).click();
    await dialog(supervisor).locator("select").first().selectOption({ index: 1 });
    await dialog(supervisor).locator("input").first().fill(course);
    await dialog(supervisor).getByRole("button", { name: "Send request" }).click();
    await expect(supervisor.getByText(course).first()).toBeVisible();

    const gs = await apiLogin(request, ACCOUNTS.gs);
    const mine = (
      await api<{ items: Json[] }>(request, gs.token, "GET", "/raqib/training?limit=500")
    ).items.find((t) => t.course === course)!;

    const manager = await asUser(browser, ACCOUNTS.pm);
    await manager.goto(`/trainingD/${mine.id}`);
    await manager.getByRole("button", { name: "Approve", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await api<Json>(request, gs.token, "GET", `/raqib/training/${mine.id}`)).status,
      )
      .toBe("approved");

    const quality = await asUser(browser, ACCOUNTS.qm);
    await quality.goto(`/trainingD/${mine.id}`);
    await quality.getByRole("button", { name: "Schedule training" }).click();
    await dialog(quality).locator('input[type="date"]').first().fill(today);
    await dialog(quality).getByRole("button", { name: "Schedule", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await api<Json>(request, gs.token, "GET", `/raqib/training/${mine.id}`)).status,
      )
      .toBe("scheduled");
    await quality.getByRole("button", { name: "Record completion" }).click();
    await dialog(quality).locator('input[type="date"]').first().fill(today);
    await dialog(quality).getByRole("button", { name: "Record", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await api<Json>(request, gs.token, "GET", `/raqib/training/${mine.id}`)).status,
      )
      .toBe("completed");
  });

  test("someone asks for an account; the manager approves one request with a role and rejects another with a reason", async ({
    browser,
    request,
  }) => {
    const ask = async (name: string) => {
      const res = await request.post(
        `${API_ORIGIN}/api/raqib/public/onboarding/raqib-demo/requests`,
        {
          data: {
            name,
            email: `${name.toLowerCase().replace(/\W+/g, ".")}.${run.toLowerCase()}@example.com`,
            phone: "+966500000099",
            nationalId: "1000000000",
            employeeNo: `E-${run}`,
            department: "Operations",
            role: "ins",
            projects: "Al-Waha Business Park",
            justification: "Needs to run site inspections.",
            signature: name,
            agree: true,
          },
          headers: { "x-forwarded-for": nextIp() },
        },
      );
      expect(res.ok(), await res.text()).toBeTruthy();
      return ((await res.json()) as { ref: string }).ref;
    };
    const toApprove = await ask(`Approve Me ${run}`);
    const toReject = await ask(`Reject Me ${run}`);

    const manager = await asUser(browser, ACCOUNTS.qm);
    await manager.goto("/users");
    await manager.getByRole("button", { name: /Account requests/i }).click();
    await manager.getByText(toApprove).first().click();
    await manager.getByRole("button", { name: "Approve & assign role/projects" }).click();
    await dialog(manager).getByText("Al-Waha Business Park").click(); // an inspector needs a project scope
    await dialog(manager).getByRole("button", { name: "Approve and create account" }).click();
    await expect(manager.getByText(/approved/i).first()).toBeVisible();

    await manager.goto("/users");
    await manager.getByRole("button", { name: /Account requests/i }).click();
    await manager.getByText(toReject).first().click();
    await manager.getByRole("button", { name: "Reject", exact: true }).click();
    await dialog(manager).locator("textarea").fill("No inspection role is open for this person.");
    await dialog(manager).getByRole("button", { name: "Reject request" }).click();

    const qm = await apiLogin(request, ACCOUNTS.qm);
    const all = (
      await api<{ items: Json[] }>(request, qm.token, "GET", "/raqib/account-requests?limit=500")
    ).items;
    expect(all.find((r) => r.ref === toApprove)?.status).toBe("approved");
    expect(all.find((r) => r.ref === toReject)?.status).toBe("rejected");
    // approval created the person; they cannot sign in until the emailed link sets a password
    const people = (
      await api<{ items: Json[] }>(request, qm.token, "GET", "/raqib/users?limit=500")
    ).items;
    const person = people.find((u) =>
      String(u.email).startsWith(`approve.me.${run.toLowerCase()}`),
    );
    expect(person, `no person for the approved request among ${people.length}`).toBeTruthy();
    expect(person!.role).toBe("ins");
    expect(person!.scope).toHaveLength(1); // scoped to the project the manager ticked
  });

  test("a guard files a confidential report, the General Manager grants access, and the manager enters with a logged reason", async ({
    browser,
  }) => {
    const subject = `Quiet concern ${run}`;
    const guard = await asUser(browser, ACCOUNTS.guard);
    await guard.goto("/confidential");
    await guard.getByLabel("Subject").fill(subject);
    await guard
      .getByLabel("Details")
      .fill("A supervisor asked the night shift to skip the patrol round.");
    await guard.getByRole("button", { name: "Send report" }).click();
    await expect(guard.getByText("Your report was received")).toBeVisible();

    // everyone enters the area the same way: a reason from the list, an acknowledgement, and the entry is logged
    const enter = async (page: Page) => {
      await page.goto("/confidential");
      // not the first dropdown on the page: that is the demo bar's account switcher
      await page.getByLabel(/Reason for access/).selectOption({ index: 1 });
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Enter and log" }).click();
    };

    // the General Manager issues the grant (and reads nothing without one)
    const gm = await asUser(browser, ACCOUNTS.gm);
    await enter(gm);
    await gm.getByRole("button", { name: "Issue grant" }).click();
    // whoever does not hold a grant yet is offered (the manager already has one, so nobody gets two)
    const person = dialog(gm).locator("select").first();
    await person.selectOption({ index: 1 });
    // a grant always expires: the date is required
    await dialog(gm)
      .locator('input[type="date"]')
      .fill(new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
    await dialog(gm)
      .locator("textarea")
      .fill("Covering the quality team while a colleague is away.");
    await dialog(gm).getByRole("button", { name: "Grant", exact: true }).click();
    await expect(gm.getByText(/Grant issued/).first()).toBeVisible();

    // the manager, who holds a standing grant, enters and sees the new report
    const manager = await asUser(browser, ACCOUNTS.qm);
    await enter(manager);
    await expect(manager.getByText(subject).first()).toBeVisible();
    await manager.getByRole("button", { name: "Exit area" }).click();
    await expect(manager.getByText(subject)).toHaveCount(0); // nothing stays on screen once they leave
  });
});
