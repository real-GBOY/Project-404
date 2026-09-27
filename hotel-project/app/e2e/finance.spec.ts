import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const PASSWORD = "demo-password-2026";
const MANAGER = "mona.farid@hotelnayel.com";
const ACCOUNTANT = "dina.samir@hotelnayel.com";
const RECEPTIONIST = "rania.kamal@hotelnayel.com";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(",");
}

function hotelDate(offsetDays: number): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * A cancelled booking with a 1,500 EGP deposit on it — made through the real API as the manager,
 * so each run (desktop, mobile) has its own credit to refund.
 */
async function cancelledWithDeposit(request: APIRequestContext): Promise<string> {
  const login = await request.post("/api/auth/login", {
    data: { email: MANAGER, password: PASSWORD },
  });
  const token = ((await login.json()) as { tokens: { accessToken: string } }).tokens.accessToken;
  const headers = { authorization: `Bearer ${token}` };
  const guests = (await (await request.get("/api/hotel/guests", { headers })).json()) as {
    items: Array<{ id: string }>;
  };
  const types = (await (await request.get("/api/hotel/room-types", { headers })).json()) as {
    items: Array<{ id: string }>;
  };
  const offset = 30 + Math.floor(Math.random() * 120);
  const created = await request.post("/api/hotel/reservations", {
    headers,
    data: {
      guestId: guests.items[0]!.id,
      roomTypeId: types.items[0]!.id,
      arrival: hotelDate(offset),
      // Three nights satisfies every demo minimum-stay rule (New Year's Eve needs 3).
      departure: hotelDate(offset + 3),
      adults: 2,
      source: "phone",
      confirm: true,
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const r = (await created.json()) as { id: string; code: string };
  const paid = await request.post(`/api/hotel/reservations/${r.id}/payments`, {
    headers: { ...headers, "idempotency-key": `e2e-deposit-${r.id}` },
    data: { method: "card", amount: 1500 },
  });
  expect(paid.ok()).toBeTruthy();
  const cancelled = await request.post(`/api/hotel/reservations/${r.id}/cancel`, {
    headers,
    data: { reason: "Plans changed" },
  });
  expect(cancelled.ok()).toBeTruthy();
  return r.code;
}

test.describe("finance (Slice 5)", () => {
  test("an accountant refunds a cancelled booking's deposit from Balances", async ({
    page,
    request,
  }) => {
    const code = await cancelledWithDeposit(request);
    await signIn(page, ACCOUNTANT);
    await page.goto("/balances");
    await page.getByRole("tab", { name: /Owed to guests/ }).click();
    await page.getByRole("link", { name: new RegExp(code) }).click();

    await page.getByRole("button", { name: "Refund 1,500 EGP" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Reason").fill("Booking cancelled — deposit returned");
    await dialog.getByRole("button", { name: "Refund", exact: true }).click();
    await expect(page.getByText("1,500 EGP refunded")).toBeVisible();
    await expect(page.getByText("Refunded", { exact: true })).toBeVisible();

    await page.goto("/payments");
    await page.getByRole("tab", { name: "Refunds" }).click();
    await expect(page.getByRole("link", { name: new RegExp(code) }).first()).toContainText(
      "−1,500 EGP",
    );
  });

  test("an accountant voids an invoice and issues a fresh one", async ({ page }) => {
    await signIn(page, ACCOUNTANT);
    await page.goto("/invoices");
    await page.getByRole("tab", { name: "Issued" }).click();
    const first = page.getByRole("list").getByRole("link").first();
    const number = (await first.locator(".font-mono").first().textContent())!.trim();
    await first.click();

    await page.getByRole("button", { name: "Void invoice" }).click();
    await page.getByRole("dialog").getByLabel("Reason").fill("Billed to the wrong company");
    await page.getByRole("dialog").getByRole("button", { name: "Void Invoice" }).click();
    await expect(page.getByText(`${number} voided`)).toBeVisible();

    // Back on the booking: the folio is square, so a new invoice can be issued.
    await page.getByRole("button", { name: "Issue invoice" }).click();
    await expect(page.getByText("New invoice issued")).toBeVisible();
    await expect(page.getByRole("link", { name: "View invoice →" })).toBeVisible();
    await expect(page.getByText(/^Voided:/)).toContainText(number);
  });

  test("finance screens are for finance staff; reservations show payment state", async ({
    page,
  }) => {
    await signIn(page, RECEPTIONIST);
    await expect(page.getByRole("link", { name: "Payments" })).toHaveCount(0);
    await page.goto("/reservations");
    await expect(page.getByText(/Paid in full|EGP \/ .* EGP/).first()).toBeVisible();

    await signIn(page, ACCOUNTANT);
    await page.goto("/payments");
    await expect(page.getByLabel("Today's Payments")).toContainText("EGP");
    await expect(page.getByLabel("Outstanding")).toContainText("EGP");
  });
});
