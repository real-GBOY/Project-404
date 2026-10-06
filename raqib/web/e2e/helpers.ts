import { createHmac } from "node:crypto";
import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";

/** The API the specs set up and check state through (a local throw-away backend unless E2E_API says otherwise). */
export const API_ORIGIN = process.env.E2E_API ?? "http://localhost:3399";
export const PASSWORD = "demo-password-2026";
export const ACCOUNTS = {
  qm: "s.alotaibi@raqib.sa",
  qe: "n.alqahtani@raqib.sa",
  pm: "f.aldosari@raqib.sa",
  insA: "k.alshehri@raqib.sa",
  insB: "r.alzahrani@raqib.sa",
  gs: "m.alharbi@raqib.sa",
  guard: "g-10302@raqib.sa",
  gm: "m.alsudairi@raqib.sa",
} as const;

/** Each browser test gets its own client address, so the (per address) sign-in rate limit never affects another test. */
let seq = 10;
export const nextIp = (): string => `10.77.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

/** A real sign-in through the API (for set-up and for checking what the server holds). */
export async function apiLogin(
  request: APIRequestContext,
  email: string,
  password = PASSWORD,
  otp?: string,
): Promise<{ token: string; refresh: string }> {
  const res = await request.post(`${API_ORIGIN}/api/auth/login`, {
    data: { email, password, ...(otp ? { otp } : {}) },
    headers: { "x-forwarded-for": nextIp() },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = (await res.json()) as { tokens: { accessToken: string; refreshToken: string } };
  return { token: body.tokens.accessToken, refresh: body.tokens.refreshToken };
}

export async function api<T = unknown>(
  request: APIRequestContext,
  token: string,
  method: "GET" | "POST" | "PUT",
  path: string,
  data?: unknown,
): Promise<T> {
  const res = await request.fetch(`${API_ORIGIN}/api${path}`, {
    method,
    data,
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `${method} ${path}: ${await res.text()}`).toBeTruthy();
  return (res.status() === 204 ? undefined : await res.json()) as T;
}

/**
 * Interface in English for stable text selectors, and a client address of its own for this test's API calls (the backend
 * trusts one proxy hop here), so the per-address sign-in rate limit never couples one test to another.
 */
export async function inEnglish(page: Page): Promise<void> {
  const ip = nextIp();
  await page.route("**/api/**", (route) =>
    route.continue({ headers: { ...route.request().headers(), "x-forwarded-for": ip } }),
  );
  // E2E_CSP: send this Content-Security-Policy with every page, to prove the app works under a policy before it is shipped
  const csp = process.env.E2E_CSP;
  if (csp)
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() !== "document") return route.fallback();
      const res = await route.fetch();
      await route.fulfill({
        response: res,
        headers: { ...res.headers(), "content-security-policy": csp },
      });
    });
  await page.addInitScript(() => {
    for (const k of Object.keys(localStorage)) if (/lang/i.test(k)) localStorage.removeItem(k);
    localStorage.setItem("raqib.lang", "en");
  });
}

/** A second (or third) person in their own browser, signed in: for flows that pass work from one role to another. */
export async function asUser(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await inEnglish(page);
  await signIn(page, email);
  return page;
}

/** Fill and submit the sign-in form without waiting for the outcome (for the cases that are meant to fail or ask for more). */
export async function attemptSignIn(
  page: Page,
  email: string,
  password = PASSWORD,
  otp?: string,
): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  if (otp) await page.getByLabel("Verification code").fill(otp);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

/** Sign in through the real sign-in form and wait until the workspace is showing (the session is then saved). */
export async function signIn(
  page: Page,
  email: string,
  password = PASSWORD,
  otp?: string,
): Promise<void> {
  await attemptSignIn(page, email, password, otp);
  await signedIn(page);
}

/** The workspace is showing: its top bar (with the notifications button) is the one thing every signed-in screen has. */
export const signedIn = (page: Page) =>
  expect(page.getByRole("button", { name: /^Notifications/ }).first()).toBeVisible();

// ── a tiny TOTP (RFC 6238) so a test can act as the person's phone ────────────────────────────────────────────────────
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function b32decode(s: string): Buffer {
  let bits = 0;
  let val = 0;
  const out: number[] = [];
  for (const ch of s.replace(/[\s=]/g, "").toUpperCase()) {
    val = (val << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((val >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
export function totp(secret: string, atMs = Date.now(), stepOffset = 0): string {
  const counter = Math.floor(atMs / 30_000) + stepOffset;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", b32decode(secret)).update(msg).digest();
  const o = h[h.length - 1]! & 15;
  const bin = ((h[o]! & 127) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(bin % 1_000_000).padStart(6, "0");
}

/** A valid 1×1 PNG for upload tests. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
