import { expect, test } from "@playwright/test";
import { ACCOUNTS, api, apiLogin, asUser } from "./helpers";

/**
 * Requirement 16 in a real browser: a guard asks for training for themselves (no guard to pick), the supervisor reviews it
 * first, and only then does it reach the project manager, who approves it.
 */
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const dialog = (page: import("@playwright/test").Page) => page.getByRole("dialog");

test("a guard's request is reviewed by the supervisor before the project manager approves it", async ({
  browser,
  request,
}) => {
  const course = `Night patrol safety ${Date.now()}`;
  const guard = await asUser(browser, ACCOUNTS.guard);
  await guard.goto("/training");
  await guard.getByRole("button", { name: "New training request" }).click();
  await expect(dialog(guard).getByText("Guard", { exact: true })).toHaveCount(0); // nobody to pick: it is for themselves
  await dialog(guard).locator("input").first().fill(course);
  await dialog(guard).getByRole("button", { name: "Send request" }).click();
  await expect(guard.getByText(course).first()).toBeVisible();

  const gs = await apiLogin(request, ACCOUNTS.gs);
  const mine = (
    await api<{ items: Json[] }>(request, gs.token, "GET", "/raqib/training?limit=500")
  ).items.find((t) => t.course === course)!;
  expect(mine.status).toBe("pending_supervisor");
  expect(mine.requesterKind).toBe("guard");

  // the project manager has nothing to decide yet
  const pm = await asUser(browser, ACCOUNTS.pm);
  await pm.goto(`/trainingD/${mine.id}`);
  await expect(pm.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);

  const supervisor = await asUser(browser, ACCOUNTS.gs);
  await supervisor.goto(`/trainingD/${mine.id}`);
  await supervisor.getByRole("button", { name: "Approve", exact: true }).click();
  await expect
    .poll(
      async () => (await api<Json>(request, gs.token, "GET", `/raqib/training/${mine.id}`)).status,
    )
    .toBe("pending_pm");

  await pm.goto(`/trainingD/${mine.id}`);
  await pm.getByRole("button", { name: "Approve", exact: true }).click();
  await expect
    .poll(
      async () => (await api<Json>(request, gs.token, "GET", `/raqib/training/${mine.id}`)).status,
    )
    .toBe("approved");
});
