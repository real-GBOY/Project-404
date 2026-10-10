import { expect, test, type Page } from "@playwright/test";

/**
 * The whole product through a real browser against the real backend: a guest books and uploads proof, a reviewer approves it,
 * the guest opens real QR tickets, and door staff admit one of them exactly once. Nothing is mocked.
 */
const ORG = "nile-sessions";
const PASSWORD = "demo-password-2026";
// a 1x1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function signIn(page: Page, email: string, to: string) {
  await page.goto(to);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.endsWith("/login"));
}

test.describe.serial("booking to door", () => {
  let status = "";
  let tickets = "";
  let ref = "";
  let ticketId = "";

  test("a guest reserves two tickets and gets exact payment instructions", async ({ page }) => {
    await page.goto(`/e/${ORG}/events/cairo-jazz-nights`);
    await expect(page.getByRole("heading", { level: 1, name: /Cairo Jazz Nights/i })).toBeVisible();
    await page.getByRole("button", { name: "Add one General admission" }).click({ clickCount: 2 });
    await expect(page.getByTestId("cart-total")).toHaveText("EGP 900.00");
    await page.getByRole("button", { name: /Continue/ }).click();

    // the form validates on blur and on submit, with actionable messages
    await page.getByLabel("Mobile number").fill("010 12");
    await page.getByLabel("Mobile number").blur();
    await expect(page.getByText("Enter all 11 digits, e.g. 010 1234 5678.").first()).toBeVisible();
    await page.getByRole("button", { name: /Reserve/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Please fix" })).toBeVisible();

    await page.getByLabel("Full name", { exact: true }).fill("Test Guest");
    await page.getByLabel("Email").fill("guest@example.com");
    await page.getByLabel("Mobile number").fill("010 1234 5678");
    await page.getByLabel(/Ticket 1/).fill("Test Guest");
    await page.getByLabel(/Ticket 2/).fill("Guest Friend");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /Reserve/ }).click();

    await expect(page.getByTestId("amount")).toHaveText("EGP 900.00");
    ref = (await page.getByTestId("ref").textContent())!.trim();
    expect(ref).toMatch(/^ADM-[A-HJ-NP-Z0-9]{4}-[A-HJ-NP-Z0-9]{4}$/);
    status = page.url();
    await expect(page.getByText("nilesessions@instapay")).toBeVisible();
  });

  test("the guest uploads proof, which waits for review (never a ticket)", async ({ page }) => {
    await page.goto(status.replace("/pay", "/upload"));
    await page
      .getByTestId("proof-input")
      .setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText(/Uploaded · receipt.png/)).toBeVisible();
    await page.getByRole("button", { name: "Submit for verification" }).click();
    await expect(page.getByRole("heading", { name: /Proof received/i })).toBeVisible();
    await expect(page.getByText("not a ticket", { exact: false }).first()).toBeVisible();
    status = page.url().replace("/submitted", "");
    tickets = status.replace("/b/", "/t/");
    // the ticket page must refuse to show tickets that do not exist
    await page.goto(tickets);
    await expect(page.getByRole("heading", { name: "No tickets yet" })).toBeVisible();
  });

  test("a reviewer approves it and the server reports the issued tickets", async ({ page }) => {
    await signIn(page, "karim@nilesessions.example", "/admin/login");
    await page.goto("/admin/review");
    await page.getByRole("button", { name: new RegExp(ref) }).click();
    const approve = page.getByRole("button", { name: "Approve payment" });
    await expect(approve).toBeDisabled(); // four checks first
    for (const box of await page.getByRole("checkbox").all()) await box.check();
    await expect(page.getByTestId("expected")).toHaveText("EGP 900.00");
    await approve.click();
    await page.getByRole("button", { name: "Approve & issue tickets" }).click();
    await expect(page.getByText("2 tickets issued")).toBeVisible();
    await expect(page.getByText(/Email queued|Accepted by provider|Email retrying/)).toBeVisible();
  });

  test("the guest sees verified status and real QR codes", async ({ page }) => {
    await page.goto(status);
    await expect(page.getByRole("heading", { name: "Your tickets are ready" })).toBeVisible();
    await page.goto(tickets);
    const qr = page.getByRole("img", { name: /QR code for ticket/ });
    await expect(qr).toBeVisible();
    await expect
      .poll(() => qr.evaluate((i: HTMLImageElement) => i.naturalWidth))
      .toBeGreaterThan(100);
    ticketId = (await page.getByTestId("ticket-id").textContent())!.trim();
    expect(ticketId).toMatch(/^TKT-/);
  });

  test("door staff admit the ticket once; the second try says when it was first used", async ({
    page,
  }) => {
    await signIn(page, "ali@nilesessions.example", "/scan/login");
    await page.getByRole("button", { name: /Cairo Jazz Nights/ }).click();
    for (const [n, expected] of [
      [1, "Entry approved"],
      [2, "Already used"],
    ] as const) {
      await page.getByRole("button", { name: "Enter ticket ID manually" }).click();
      await page.getByPlaceholder("TKT-XXXX-XXXX").fill(ticketId.toLowerCase());
      await page.getByRole("button", { name: "Check ticket" }).click();
      await expect(page.getByRole("heading", { name: expected })).toBeVisible();
      if (n === 2) await expect(page.getByText("First check-in")).toBeVisible();
      await page.getByRole("button", { name: "Scan next" }).click();
    }
  });
});

test("a person without approve permission cannot reach the review queue", async ({ page }) => {
  await signIn(page, "ali@nilesessions.example", "/admin/login");
  await page.goto("/admin/review");
  await expect(page.getByRole("heading", { name: "You do not have access" })).toBeVisible();
});

test("an unknown organizer or booking reveals nothing", async ({ page }) => {
  await page.goto("/b/nile-sessions/ADM-AAAA-BBBB?k=" + "a".repeat(32));
  await expect(page.getByRole("heading", { name: "We could not find that booking" })).toBeVisible();
});
