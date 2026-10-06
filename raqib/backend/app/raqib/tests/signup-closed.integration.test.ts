/**
 * Raqib's accounts are issued (account requests, provisioning), never self-served. Core can offer open sign-up and organization
 * creation; a deployment turns that off with AURIC_SELF_SIGNUP=false, and these doors then answer 403 while normal sign-in is untouched.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@core/kernel/clock.js";
import { setConfigForTests } from "@core/kernel/config.js";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { createDemoHttpApp, hasTestDb, loginAs } from "./helpers.js";

const email = (key: string) => DEMO_PEOPLE.find((p) => p.key === key)!.email;

describe.skipIf(!hasTestDb)("closed sign-up", () => {
  let http: NestFastifyApplication;
  let qm = "";
  const post = (url: string, payload: unknown, token?: string) =>
    http.inject({ method: "POST", url: `/api${url}`, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: payload as never });

  beforeAll(async () => {
    http = (await createDemoHttpApp({ clock: fixedClock("2026-10-04T08:00:00.000Z") })).http;
    qm = await loginAs(http, email("qm"));
  }, 180_000);
  afterAll(async () => {
    setConfigForTests({ selfSignup: true });
    await http?.close();
  });

  it("is open by default (Core's behaviour, for products that want self-service)", async () => {
    setConfigForTests({ selfSignup: true });
    expect((await post("/auth/register", { email: "someone.new@example.com", password: "a-long-password-1" })).statusCode).toBe(201);
  });

  it("answers 403 for registration and organization creation when closed, and leaves sign-in alone", async () => {
    setConfigForTests({ selfSignup: false });
    const reg = await post("/auth/register", { email: "stranger@example.com", password: "a-long-password-1" });
    expect(reg.statusCode).toBe(403);
    expect(reg.json().error.code).toBe("identity.signup_closed");
    const org = await post("/organizations", { name: "Not Welcome Co." }, qm);
    expect(org.statusCode).toBe(403);
    expect(org.json().error.code).toBe("organizations.signup_closed");
    expect(await loginAs(http, email("qm"))).toBeTruthy();
  });
});
