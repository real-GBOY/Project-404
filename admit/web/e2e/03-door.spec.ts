import { expect, test } from "@playwright/test";

/**
 * The door flow on a phone-sized screen: door staff who sign in at the normal organizer login land in the scanner (they have no
 * dashboard to work in), the first start explains the camera prompt, a ticket ID is checked against the server, and a booking reference
 * that has no tickets yet answers "Not paid yet". The camera itself needs a device, so manual entry drives the verdicts here.
 */
const API = process.env.ADMIT_E2E_API ?? "http://localhost:3499";
const ORG = "nile-sessions";
const PASSWORD = "demo-password-2026";

test.use({ viewport: { width: 390, height: 800 } });

test("door staff are taken to the scanner, and an unpaid booking reference is refused as not paid yet", async ({
  page,
  request,
}) => {
  // an unpaid booking to type at the door
  const event = await (
    await request.get(`${API}/api/admit/public/${ORG}/events/cairo-jazz-nights`)
  ).json();
  const booked = await request.post(
    `${API}/api/admit/public/${ORG}/events/cairo-jazz-nights/bookings`,
    {
      headers: { "idempotency-key": `e2e-door-${Date.now()}-abcdefgh` },
      data: {
        items: [
          { ticketTypeId: event.ticketTypes[0].id, quantity: 1, holderNames: ["Door Test Guest"] },
        ],
        customer: {
          name: "Door Test Guest",
          email: "door.test@example.com",
          phone: "010 1234 5678",
        },
        policyAck: true,
      },
    },
  );
  expect(booked.status(), await booked.text()).toBe(201);
  const ref = (await booked.json()).ref as string;

  // the organizer sign-in page sends a door person to the scanner, not to a dashboard
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("ali@nilesessions.example");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/scan$/);

  await page.getByRole("button", { name: /Cairo Jazz Nights/ }).click();

  // first use on this device: the camera prompt is explained before the browser shows it
  await page.getByRole("button", { name: /Start scanning/ }).click();
  await expect(page.getByRole("heading", { name: "Allow camera to scan tickets" })).toBeVisible();
  await page.getByRole("button", { name: "Use manual entry instead" }).click();

  await expect(page.getByRole("heading", { name: "Enter ticket ID" })).toBeVisible();
  await page.getByPlaceholder("TKT-XXXX-XXXX").fill(ref.toLowerCase());
  await page.getByRole("button", { name: "Check ticket" }).click();

  // the verdict is the server's answer: red, named, and it points at the booking
  await expect(page.getByRole("heading", { name: "Not paid yet" })).toBeVisible();
  await expect(page.getByText(ref)).toBeVisible();
  await expect(page.getByRole("button", { name: "Call supervisor" })).toBeVisible();
});

test("the owner's dashboard links to the scanner", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("salma@nilesessions.example");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("link", { name: /Door scanner/ })).toBeVisible();
  await expect(page).toHaveURL(/\/admin$/); // an owner stays on the dashboard
});
