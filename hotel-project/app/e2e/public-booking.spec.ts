import { expect, test } from "@playwright/test";
import { WEB_PORT } from "../playwright.config";
import { signIn } from "./helpers";

const WEBSITE = `http://localhost:${WEB_PORT}`;

test.describe("public booking (Slice 8)", () => {
  test("a guest books on the Hotel Transylvania website and the front desk sees it", async ({
    page,
  }, info) => {
    const email = `guest.${info.project.name}.${Date.now()}@example.com`;

    // ── The guest, on the public website ──
    await page.goto(WEBSITE);
    const form = page.getByRole("form", { name: "Check Availability" });
    await form.getByRole("button", { name: "Check Availability" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Choose your room" })).toBeVisible();
    const rooms = dialog.getByRole("list", { name: "Available rooms" });
    await expect(rooms.getByRole("listitem").first()).toContainText("EGP");
    const roomName = (await rooms.getByRole("heading").first().textContent())!.trim();
    await rooms.getByRole("button", { name: "Select" }).first().click();

    await expect(dialog.getByRole("heading", { name: "Your details" })).toBeVisible();
    await dialog.getByLabel("Full name").fill("Salma Youssef");
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Phone (optional)").fill("+20 122 333 4444");
    await dialog.getByRole("button", { name: "Confirm booking" }).click();

    await expect(dialog.getByRole("heading", { name: "You're booked" })).toBeVisible();
    const code = (await dialog.getByTestId("booking-code").textContent())!.trim();
    expect(code).toMatch(/^BK-\d+$/);
    await expect(dialog).toContainText(roomName);

    // ── The front desk, in HotelOS ──
    await signIn(page, "rania.kamal@hoteltransylvania.com");
    await page.getByRole("button", { name: /Notifications, \d+ unread/ }).click();
    await page
      .getByRole("dialog", { name: "Notifications" })
      .getByRole("button", { name: new RegExp(`New website booking #${code}`) })
      .click();
    await expect(page.getByRole("heading", { name: `#${code}` })).toBeVisible();
    await expect(page.getByText("Salma Youssef").first()).toBeVisible();
    await expect(page.getByText("Direct Website").first()).toBeVisible();
  });

  test("the booking API refuses a request without an Idempotency-Key", async ({ request }) => {
    const res = await request.post(`${WEBSITE}/api/public/hotels/hotel-transylvania/bookings`, {
      data: {
        roomTypeId: "x",
        arrival: "2030-01-01",
        departure: "2030-01-02",
        adults: 1,
        guest: { fullName: "No Key", email: "nokey@example.com" },
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe("booking.idempotency_key_required");
  });
});
