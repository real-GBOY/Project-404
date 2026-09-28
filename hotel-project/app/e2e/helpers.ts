import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "demo-password-2026";

/**
 * Sign in as a demo staff member. If someone is already signed in (a test switching users), sign
 * them out through the app first — clearing storage behind the app's back can race with an
 * in-flight token refresh that writes the old session straight back.
 */
export async function signIn(page: Page, email: string, password = DEMO_PASSWORD) {
  // A protected page settles on exactly one of: the sign-in form (nobody signed in) or the app
  // (someone is). The login page itself shows its form while auth is still loading.
  await page.goto("/");
  const email$ = page.getByLabel("Email");
  const signOut = page.getByRole("button", { name: "Sign out" });
  await expect(email$.or(signOut).first()).toBeVisible();
  if (await signOut.isVisible()) {
    await signOut.click();
    await expect(email$).toBeVisible();
  }
  await email$.fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(",");
}

/** The hotel's calendar date (Cairo), `offsetDays` from today, as YYYY-MM-DD. */
export function hotelDate(offsetDays = 0): string {
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
