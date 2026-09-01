import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AuricCore } from "../index.js";
import type { EmailChannel, EmailMessage } from "../notifications/infrastructure/email-channel.js";
import { fixedClock } from "../kernel/clock.js";
import { applyTestConfig, asSystem, asUser, hasTestDb, resetSchema } from "./helpers.js";

/**
 * End-to-end exercise of AURIC Core through its public surface: migrations, RBAC
 * seed, the full auth lifecycle, RBAC enforcement, the in-process event bus, and
 * the transactional outbox + worker delivering an email side effect, including
 * the dead-letter path.
 *
 * The Core runs as `auric_app` here (see helpers), so every RLS policy is live;
 * direct service calls are wrapped in `asUser` / `asSystem` to stand in for the
 * request context (§ docs/tenancy.md).
 */
const suite = hasTestDb ? describe : describe.skip;

suite("AURIC Core — integration", () => {
  let core: AuricCore;
  const clock = fixedClock("2026-08-29T09:00:00.000Z");
  const sent: EmailMessage[] = [];
  const captureEmail: EmailChannel = {
    async send(message) {
      sent.push(message);
    },
  };

  beforeAll(async () => {
    applyTestConfig();
    await resetSchema();
    const { createAuricCore } = await import("../index.js");
    core = createAuricCore({
      startWorker: false,
      emailChannel: captureEmail,
      clock,
      config: { appUrl: "https://app.test" },
    });
    await core.migrate();
    await core.seed();
  }, 60_000);

  afterAll(async () => {
    await core?.stop();
  });

  it("seeds the admin role with a wildcard permission", async () => {
    const roles = await core.modules.rbac.service.listRoles();
    expect(roles.map((r) => r.key)).toContain("admin");
  });

  it("register writes a welcome notification in the same transaction", async () => {
    const email = `welcome+${Date.now()}@example.com`;
    const user = await core.modules.identity.service.register({
      email,
      password: "correct horse battery",
      locale: "ar",
    });
    expect(user.status).toBe("pending");

    // Account-level (NULL-org) notification, visible to the owner in any context.
    const notes = await asUser(user.id, null, () =>
      core.modules.notifications.service.listForUser(user.id, {}),
    );
    expect(notes.some((n) => n.type === "welcome")).toBe(true);
  });

  it("delivers the verification email through the outbox, then login works", async () => {
    const email = `owner+${Date.now()}@example.com`;
    const password = "correct horse battery";
    await core.modules.identity.service.register({ email, password, locale: "en" });

    sent.length = 0;
    const processed = await core.worker.tick();
    expect(processed).toBeGreaterThan(0);

    const mail = sent.find((m) => m.to === email);
    expect(mail?.text).toMatch(/https:\/\/app\.test\/verify-email\?token=/);

    const token = decodeURIComponent(mail!.text.match(/token=([A-Za-z0-9_\-]+)/)![1]!);
    await core.modules.identity.service.verifyEmail(token);

    const login = await core.modules.identity.service.login({ email, password });
    expect(login.user.status).toBe("active");
    expect(login.tokens.tokenType).toBe("Bearer");
    // No org yet → orgless token, empty membership list.
    expect(login.organizations).toEqual([]);
    expect(core.modules.identity.jwt.verifyAccessToken(login.tokens.accessToken).org).toBeNull();

    // refresh rotates the refresh token...
    const rotated = await core.modules.identity.service.refresh(login.tokens.refreshToken);
    expect(rotated.refreshToken).not.toBe(login.tokens.refreshToken);
    // ...and reusing the consumed one is rejected (and trips theft protection,
    // revoking the whole token family).
    await expect(core.modules.identity.service.refresh(login.tokens.refreshToken)).rejects.toThrow();
    await expect(core.modules.identity.service.refresh(rotated.refreshToken)).rejects.toThrow();
  }, 30_000);

  it("makes the organization creator a tenant-scoped admin, and honours the wildcard", async () => {
    const user = await core.modules.identity.service.register({
      email: `founder+${Date.now()}@example.com`,
      password: "correct horse battery",
    });
    const org = await core.modules.organizations.service.createOrganization({
      name: "Acme",
      createdBy: user.id,
    });

    // The `organization.created` subscriber granted `admin` in the new tenant.
    expect(
      await asUser(user.id, org.id, () =>
        core.modules.rbac.permissionProvider.can(user.id, "manage", "role"),
      ),
    ).toBe(true);
    expect(
      await asUser(user.id, org.id, () =>
        core.modules.rbac.permissionProvider.can(user.id, "whatever", "anything"),
      ),
    ).toBe(true);
    // ...but not outside that tenant.
    expect(
      await asUser(user.id, null, () =>
        core.modules.rbac.permissionProvider.can(user.id, "manage", "role"),
      ),
    ).toBe(false);
  }, 30_000);

  it("dead-letters an external event whose handler never succeeds", async () => {
    core.registry.onExternal("test.always_fails", "test.boom", async () => {
      throw new Error("boom");
    });

    await core.uow.transaction(() =>
      core.events.publish({ name: "test.always_fails", version: 1, payload: { n: 1 } }),
    );

    // max attempts defaults to 5; advance past each exponential backoff window.
    for (let i = 0; i < 8; i++) {
      await core.worker.tick();
      clock.advance(2 * 60 * 60 * 1000);
    }

    const stats = await asSystem(() => core.uow.transaction(() => core.outbox.stats()));
    expect(stats.deadLettered).toBeGreaterThan(0);
    expect(stats.pending).toBe(0);
  }, 30_000);

  it("audit trail is append-only", async () => {
    const rows = await asSystem(() =>
      core.uow.transaction(() =>
        core.modules.audit.repository.query({ action: "user.registered", limit: 1 }),
      ),
    );
    expect(rows.length).toBe(1);
  });
});
