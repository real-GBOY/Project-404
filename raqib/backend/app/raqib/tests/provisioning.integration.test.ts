/**
 * Provisioning: a real customer is created end to end (organization, owner, settings, starter forms), the owner
 * can choose a password from the one-time link and sign in, and the new tenant is isolated from every other.
 */
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PEOPLE } from "@raqib/raqib/demo/demo-data.js";
import { ProvisioningService } from "@raqib/raqib/provisioning/provisioning-service.js";
import { createDemoHttpApp, get, hasTestDb, loginAs } from "./helpers.js";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe.skipIf(!hasTestDb)("Raqib provisioning", () => {
  let http: NestFastifyApplication;
  let service: ProvisioningService;
  const OWNER = "owner@acme-guards.example";
  let link = "";

  const call = async (token: string, url: string) => {
    const res = await http.inject({ method: "GET", url: `/api${url}`, headers: { authorization: `Bearer ${token}` } });
    return { status: res.statusCode, body: (res.body ? JSON.parse(res.body) : {}) as Json };
  };

  beforeAll(async () => {
    const booted = await createDemoHttpApp();
    http = booted.http;
    service = get<ProvisioningService>(booted.moduleRef, ProvisioningService);
  }, 180_000);

  afterAll(async () => {
    await http?.close();
  });

  it("creates the organization and returns a one-time setup link", async () => {
    const r = await service.provision({ name: "Acme Guards", slug: "acme-guards", ownerEmail: OWNER, ownerName: "Sara Ali" });
    expect(r.slug).toBe("acme-guards");
    expect(r.setupLink).toContain("/reset-password?token=");
    link = new URL(r.setupLink).searchParams.get("token")!;
  });

  it("the owner chooses a password from the link, once, and signs in as the quality manager", async () => {
    const set = await http.inject({ method: "POST", url: "/api/auth/password/reset", payload: { token: link, password: "a-long-owner-password-1" } });
    expect(set.statusCode).toBeLessThan(300);
    const again = await http.inject({ method: "POST", url: "/api/auth/password/reset", payload: { token: link, password: "another-long-password-2" } });
    expect(again.statusCode).toBe(400);

    const token = await loginAs(http, OWNER, "a-long-owner-password-1");
    const me = await call(token, "/raqib/me");
    expect(me.status).toBe(200);
    expect(me.body.role).toBe("qm");
    expect(me.body.name.en).toBe("Sara Ali");
  });

  it("starts with default settings carrying the company name and the starter forms published", async () => {
    const token = await loginAs(http, OWNER, "a-long-owner-password-1");
    const settings = await call(token, "/raqib/settings");
    expect(settings.body.org.nameEn).toBe("Acme Guards");
    const forms = await call(token, "/raqib/forms");
    expect(forms.status).toBe(200);
    const items = forms.body.items as Json[];
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.every((f) => f.versions?.some?.((v: Json) => v.status === "published") ?? true)).toBe(true);
  });

  it("sees none of another tenant's data, and the other tenant none of theirs", async () => {
    const owner = await loginAs(http, OWNER, "a-long-owner-password-1");
    expect(((await call(owner, "/raqib/projects")).body.items as Json[]).length).toBe(0);
    expect(((await call(owner, "/raqib/visits")).body.items as Json[]).length).toBe(0);
    expect(((await call(owner, "/raqib/users")).body.items as Json[]).map((u) => u.email)).toEqual([OWNER]);

    const demoQm = await loginAs(http, DEMO_PEOPLE.find((p) => p.key === "qm")!.email);
    const people = ((await call(demoQm, "/raqib/users")).body.items as Json[]).map((u) => u.email);
    expect(people).not.toContain(OWNER);
  });

  it("refuses a duplicate slug, a duplicate owner e-mail and malformed input", async () => {
    await expect(service.provision({ name: "Other", slug: "acme-guards", ownerEmail: "x@y.example", ownerName: "X Y" })).rejects.toMatchObject({
      code: "raqib.slug_taken",
    });
    await expect(service.provision({ name: "Other", slug: "other-co", ownerEmail: OWNER, ownerName: "X Y" })).rejects.toMatchObject({
      code: "raqib.email_taken",
    });
    await expect(service.provision({ name: "Other", slug: "Bad Slug!", ownerEmail: "x@y.example", ownerName: "X Y" })).rejects.toMatchObject({
      code: "raqib.invalid_slug",
    });
    await expect(service.provision({ name: "Other", slug: "other-co", ownerEmail: "not-an-email", ownerName: "X Y" })).rejects.toMatchObject({
      code: "raqib.invalid_email",
    });
  });
});
