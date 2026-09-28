import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const MANAGER = "mona.farid@hotelnayel.com";
const RECEPTIONIST = "youssef.adly@hotelnayel.com";

test.describe("reservation engine (Slice 2)", () => {
  test("a receptionist books and confirms a stay end to end, without a cancel option", async ({
    page,
    isMobile,
  }) => {
    await signIn(page, RECEPTIONIST);
    await page.goto("/reservations/new");

    // Stay: 2 nights starting in 25 days (clear of the seeded bookings).
    const arrival = await page.getByLabel("Check-in").inputValue();
    const start = new Date(`${arrival}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() + (isMobile ? 26 : 25));
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 2);
    await page.getByLabel("Check-in").fill(iso(start));
    await page.getByLabel("Check-out").fill(iso(end));

    await page.getByRole("button", { name: /Serenity Suite/ }).click();
    await expect(page.getByText("Total (before VAT)")).toBeVisible();

    await page.getByRole("searchbox", { name: "Find guest" }).fill("Tarek");
    await page.getByRole("button", { name: /Tarek Abdel Rahman/ }).click();
    await page.getByRole("button", { name: "Book & confirm" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText("#BK-");
    await expect(page.getByText("Confirmed", { exact: true }).first()).toBeVisible();
    // Receptionists book and confirm, but cancelling is a manager's call.
    await expect(page.getByRole("button", { name: "Cancel booking" })).toHaveCount(0);
  });

  test("today's arrivals show on the calendar, and the board derives who is in house", async ({
    page,
  }) => {
    await signIn(page, MANAGER);
    await page.goto("/calendar");
    // A regular guest: the demo history may show several of his stays in the window.
    await expect(page.getByRole("link", { name: /Ahmed Mohamed · BK-/ }).first()).toBeVisible();

    // The demo history leaves guests in house tonight; the board derives Occupied from them.
    await page.goto("/rooms");
    await page.getByRole("tab", { name: /Occupied/ }).click();
    await expect(page.getByRole("button", { name: /occupied/ }).first()).toBeVisible();
  });

  test("a manager cancels a booking with a reason and the timeline records it", async ({
    page,
    isMobile,
  }) => {
    await signIn(page, MANAGER);
    await page.goto("/reservations");
    await page.getByRole("tab", { name: "Pending" }).click();
    // Pending demo bookings: a different one per viewport so the runs don't collide.
    const rows = page.getByRole("link", { name: /BK-/ });
    await rows.nth(isMobile ? 1 : 0).click();

    await page.getByRole("button", { name: "Cancel booking" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Reason (optional)").fill("Guest asked to cancel by phone.");
    await dialog.getByRole("button", { name: "Cancel booking" }).click();

    await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Cancelled — Guest asked to cancel by phone.")).toBeVisible();
  });
});
