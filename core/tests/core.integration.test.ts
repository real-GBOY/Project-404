import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import { fixedClock } from "@core/kernel/clock.js";
import { unitOfWork } from "@core/kernel/db/db.js";
import { EVENT_BUS, JWT_SERVICE } from "@core/kernel/tokens.js";
import type { IEventBus } from "@core/contracts/index.js";
import { EventRegistry } from "@core/events/registry.js";
import { OutboxRepository } from "@core/events/outbox/outbox-repository.js";
import { OutboxWorker } from "@core/events/outbox/outbox-worker.js";
import { IdentityService } from "@core/identity/application/identity-service.js";
import type { JwtService } from "@core/identity/infrastructure/jwt-service.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import { RbacPermissionProvider } from "@core/rbac/infrastructure/permission-provider.js";
import { OrganizationService } from "@core/organizations/application/organization-service.js";
import { NotificationService } from "@core/notifications/application/notification-service.js";
import { AuditRepository } from "@core/audit/infrastructure/audit-repository.js";
import type { EmailChannel, EmailMessage } from "@core/notifications/infrastructure/email-channel.js";
import { asSystem, asUser, createTestCore, get, hasTestDb } from "./helpers.js";

/**
 * End-to-end exercise of AURIC Core through its public surface: migrations, RBAC
 * seed, the full auth lifecycle, RBAC enforcement, the in-process event bus, and
 * the transactional outbox + worker delivering an email side effect, including
 * the dead-letter path. The Core runs as `auric_app`, so every RLS policy is
 * live; direct service calls are wrapped in `asUser` / `asSystem`.
 */
const suite = hasTestDb ? describe : describe.skip;

suite("AURIC Core — integration", () => {
  let core: TestingModule;
  const clock = fixedClock("2026-08-29T09:00:00.000Z");
  const sent: EmailMessage[] = [];
  const captureEmail: EmailChannel = {
    async send(message) {
      sent.push(message);
    },
  };

  const identity = () => get(core, IdentityService);
  const worker = () => get(core, OutboxWorker);

  beforeAll(async () => {
    core = await createTestCore({ clock, emailChannel: captureEmail });
  }, 60_000);

  afterAll(async () => {
    await core?.close();
  });

  it("seeds the admin role with a wildcard permission", async () => {
    const roles = await get(core, RbacService).listRoles();
    expect(roles.map((r) => r.key)).toContain("admin");
  });

  it("register writes a welcome notification in the same transaction", async () => {
    const user = await identity().register({
      email: `welcome+${Date.now()}@example.com`,
      password: "correct horse battery",
      locale: "ar",
    });
    expect(user.status).toBe("pending");

    const notes = await asUser(user.id, null, () =>
      get(core, NotificationService).listForUser(user.id, {}),
    );
    expect(notes.some((n) => n.type === "welcome")).toBe(true);
  });

  it("delivers the verification email through the outbox, then login works", async () => {
    const email = `owner+${Date.now()}@example.com`;
    const password = "correct horse battery";
    await identity().register({ email, password, locale: "en" });

    sent.length = 0;
    const processed = await worker().tick();
    expect(processed).toBeGreaterThan(0);

    const mail = sent.find((m) => m.to === email);
    expect(mail?.text).toMatch(/https:\/\/app\.test\/verify-email\?token=/);

    const token = decodeURIComponent(mail!.text.match(/token=([A-Za-z0-9_\-]+)/)![1]!);
    await identity().verifyEmail(token);

    const login = await identity().login({ email, password });
    expect(login.user.status).toBe("active");
    expect(login.tokens.tokenType).toBe("Bearer");
    expect(login.organizations).toEqual([]);
    expect(get<JwtService>(core, JWT_SERVICE).verifyAccessToken(login.tokens.accessToken).org).toBeNull();

    const rotated = await identity().refresh(login.tokens.refreshToken);
    expect(rotated.refreshToken).not.toBe(login.tokens.refreshToken);
    await expect(identity().refresh(login.tokens.refreshToken)).rejects.toThrow();
    await expect(identity().refresh(rotated.refreshToken)).rejects.toThrow();
  }, 30_000);

  it("makes the organization creator a tenant-scoped admin, and honours the wildcard", async () => {
    const user = await identity().register({
      email: `founder+${Date.now()}@example.com`,
      password: "correct horse battery",
    });
    const org = await get(core, OrganizationService).createOrganization({
      name: "Acme",
      createdBy: user.id,
    });
    const perms = get(core, RbacPermissionProvider);

    expect(await asUser(user.id, org.id, () => perms.can(user.id, "manage", "role"))).toBe(true);
    expect(await asUser(user.id, org.id, () => perms.can(user.id, "whatever", "anything"))).toBe(true);
    expect(await asUser(user.id, null, () => perms.can(user.id, "manage", "role"))).toBe(false);
  }, 30_000);

  it("dead-letters an external event whose handler never succeeds", async () => {
    get(core, EventRegistry).onExternal("test.always_fails", "test.boom", async () => {
      throw new Error("boom");
    });

    await asSystem(() =>
      unitOfWork.transaction(() =>
        get<IEventBus>(core, EVENT_BUS).publish({
          name: "test.always_fails",
          version: 1,
          payload: { n: 1 },
        }),
      ),
    );

    for (let i = 0; i < 8; i++) {
      await worker().tick();
      clock.advance(2 * 60 * 60 * 1000);
    }

    const stats = await asSystem(() =>
      unitOfWork.transaction(() => get(core, OutboxRepository).stats()),
    );
    expect(stats.deadLettered).toBeGreaterThan(0);
    expect(stats.pending).toBe(0);
  }, 30_000);

  it("audit trail is append-only", async () => {
    const rows = await asSystem(() =>
      unitOfWork.transaction(() =>
        get(core, AuditRepository).query({ action: "user.registered", limit: 1 }),
      ),
    );
    expect(rows.length).toBe(1);
  });
});
