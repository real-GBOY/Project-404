import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  PASSWORD,
  api,
  apiLogin,
  attemptSignIn,
  signedIn,
  signIn,
  totp,
  inEnglish,
} from "./helpers";

test.describe("sign-in and account security", () => {
  test.beforeEach(async ({ page }) => inEnglish(page));

  test("a person signs in and sees their workspace, and a wrong password is refused", async ({
    page,
  }) => {
    await attemptSignIn(page, ACCOUNTS.gs, "wrong-password-1");
    await expect(page.getByRole("alert")).toContainText("Email or password is incorrect");
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("Guards Supervisor").first()).toBeVisible();
    await signedIn(page);
  });

  test("five wrong passwords lock the account and say for how long", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill(ACCOUNTS.guard);
    for (let i = 0; i < 5; i++) {
      await page.getByLabel("Password").fill(`wrong-password-${i}`);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page.getByRole("alert")).toBeVisible();
    }
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(/temporarily locked/i);
    await expect(page.getByRole("alert")).toContainText(/\d+ minute/);
  });

  test("password recovery never reveals whether an address is registered", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Forgot your password?" }).click();
    await page.getByLabel("Email").fill("nobody-at-all@example.com");
    await page.getByRole("button", { name: "Send the link" }).click();
    await expect(page.getByRole("status")).toContainText("If that email is registered");
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(ACCOUNTS.qe);
    await page.getByRole("button", { name: "Send the link" }).click();
    await expect(page.getByRole("status")).toContainText("If that email is registered");
  });

  test("two-step verification: enrol in the browser, then sign-in asks for the code and refuses a wrong one", async ({
    page,
  }) => {
    await signIn(page, ACCOUNTS.insB);
    await signedIn(page);
    await page.goto("/account/security");
    await page.getByRole("button", { name: "Turn on two-step verification" }).click();
    const secret = ((await page.locator("code").first().textContent()) ?? "").replace(/\s/g, "");
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    await page.getByLabel("Verification code").fill(totp(secret));
    await page.getByRole("button", { name: "Confirm and turn on" }).click();
    await expect(page.getByText("Recovery codes", { exact: true })).toBeVisible();
    const recovery = (await page.locator("code").last().textContent()) ?? "";
    expect(recovery).toMatch(/[a-z2-7]{4}-[a-z2-7]{4}/);
    await page.getByRole("button", { name: "I have saved them" }).click();
    await expect(page.getByText("On", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).first().click();
    await page.getByLabel("Email").fill(ACCOUNTS.insB);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByLabel("Verification code")).toBeVisible(); // password right: now the code
    await page.getByLabel("Verification code").fill("000000");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("not valid");
    await page.getByLabel("Verification code").fill(totp(secret, Date.now(), 1)); // the code the phone shows next
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("button", { name: "Sign out" }).first()).toBeVisible(); // back on the account page the person left
  });

  test("a changed password signs the person out everywhere and the new one works", async ({
    page,
    request,
  }) => {
    const email = ACCOUNTS.qe;
    await signIn(page, email);
    await page.goto("/account/security");
    await page.getByLabel("Current password").fill(PASSWORD);
    await page.getByLabel("New password").fill("a-much-longer-password-2026");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed")).toBeVisible();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("a-much-longer-password-2026");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("button", { name: "Sign out" }).first()).toBeVisible(); // back on the account page the person left
    const t = await apiLogin(request, email, "a-much-longer-password-2026");
    expect(await api(request, t.token, "GET", "/raqib/account/security")).toMatchObject({
      password: { expired: false },
    });
  });
});
