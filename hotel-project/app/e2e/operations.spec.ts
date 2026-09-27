import { expect, test, type APIRequestContext } from "@playwright/test";
import { signIn, hotelDate, DEMO_PASSWORD } from "./helpers";

const PASSWORD = DEMO_PASSWORD;
const MANAGER = "mona.farid@hotelnayel.com";
const HOUSEKEEPER = "hassan.ali@hotelnayel.com";
const TECHNICIAN = "omar.tarek@hotelnayel.com";

/** A room with nothing on it tonight or tomorrow — asked of the real availability API. */
async function freeRoomNumber(request: APIRequestContext): Promise<string> {
  const login = await request.post("/api/auth/login", {
    data: { email: MANAGER, password: PASSWORD },
  });
  const token = ((await login.json()) as { tokens: { accessToken: string } }).tokens.accessToken;
  const headers = { authorization: `Bearer ${token}` };
  const types = (await (await request.get("/api/hotel/room-types", { headers })).json()) as {
    items: Array<{ id: string }>;
  };
  for (const type of types.items) {
    const res = await request.get("/api/hotel/availability/rooms", {
      headers,
      params: { roomTypeId: type.id, arrival: hotelDate(0), departure: hotelDate(2) },
    });
    const rooms = ((await res.json()) as { items: Array<{ number: string }> }).items;
    if (rooms.length > 0) return rooms[rooms.length - 1]!.number;
  }
  throw new Error("No free room in the demo hotel for the next two nights");
}

test.describe("operations (Slice 4)", () => {
  test("a housekeeper cleans a room from the board", async ({ page }) => {
    await signIn(page, HOUSEKEEPER);
    // Housekeeping staff get their own queue, not the hotel's figures.
    await expect(page.getByText("Your rooms today")).toBeVisible();
    await page.goto("/housekeeping");

    const needs = page.getByRole("region", { name: "Needs Cleaning" });
    const card = needs
      .getByRole("article")
      .filter({ has: page.getByRole("button", { name: "Start Cleaning" }) })
      .first();
    const room = (await card.getAttribute("aria-label"))!;
    await card.getByRole("button", { name: "Start Cleaning" }).click();
    await expect(page.getByText(`${room} — cleaning started`)).toBeVisible();

    const cleaning = page.getByRole("region", { name: "Cleaning" });
    await cleaning
      .getByRole("article", { name: room })
      .getByRole("button", { name: "Complete" })
      .click();
    await page.getByRole("dialog").getByRole("button", { name: "Mark Complete" }).click();
    await expect(page.getByText(`${room} ready`)).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Ready" }).getByRole("article", { name: room }),
    ).toBeVisible();
  });

  test("a manager takes a room out of sale, and it's back only once the repair is verified", async ({
    page,
    request,
  }) => {
    const roomNumber = await freeRoomNumber(request);
    await signIn(page, MANAGER);
    await page.goto("/maintenance");
    await page.getByRole("button", { name: "+ Report Issue" }).click();
    const report = page.getByRole("dialog");
    const roomSelect = report.getByLabel("Room", { exact: true });
    const option = roomSelect.locator("option", { hasText: `Room ${roomNumber} ·` });
    await roomSelect.selectOption((await option.getAttribute("value"))!);
    await report.getByLabel("Issue").fill("Shower mixer leaking");
    await report.getByLabel("Priority").selectOption("high");
    await report.getByLabel("Room impact").selectOption("out_of_service");
    await report.getByRole("button", { name: "Report Issue" }).click();

    await expect(page.getByRole("heading", { name: "Shower mixer leaking" })).toBeVisible();
    await page.getByRole("button", { name: "Assign", exact: true }).click();
    await page.getByRole("dialog").getByLabel("Technician").selectOption({ label: "Omar Tarek" });
    await page.getByRole("dialog").getByRole("button", { name: "Assign", exact: true }).click();
    await expect(page.getByRole("button", { name: "Reassign" })).toBeVisible();
    const ticketUrl = page.url();

    // The room is off sale: the room board says so.
    await page.goto("/rooms");
    await expect(
      page.getByRole("button", { name: `Room ${roomNumber}, out of service` }),
    ).toBeVisible();

    // The technician does the work…
    await signIn(page, TECHNICIAN);
    await page.goto(ticketUrl);
    await page.getByRole("button", { name: "Start Work" }).click();
    await expect(page.getByText(/in progress$/)).toBeVisible();
    await page.getByRole("button", { name: "Resolve", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByLabel(/What was done/)
      .fill("Replaced the cartridge");
    await page.getByRole("dialog").getByRole("button", { name: "Resolve", exact: true }).click();
    await expect(page.getByText("Replaced the cartridge").first()).toBeVisible();
    // …but can't put the room back on sale.
    await expect(page.getByRole("button", { name: /Verify/ })).toHaveCount(0);

    await signIn(page, MANAGER);
    await page.goto(ticketUrl);
    await page.getByRole("button", { name: "Verify & Return to Service" }).click();
    await expect(page.getByText(/verified$/)).toBeVisible();
    await expect(page.getByText("Verified — back in service")).toBeVisible();
  });

  test("the dashboard shows today's figures from the ledgers", async ({ page }) => {
    await signIn(page, MANAGER);
    await expect(page.getByLabel("Occupancy", { exact: true })).toContainText("%");
    await expect(page.getByLabel("Available Rooms", { exact: true })).toContainText("of 40 total");
    await expect(page.getByRole("heading", { name: "Operational Alerts" })).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Revenue — last 7 days" }).getByRole("listitem"),
    ).toHaveCount(7);
    await expect(page.getByRole("heading", { name: "Recent Reservations" })).toBeVisible();
  });
});
