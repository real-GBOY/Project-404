import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import {
  asUser,
  createMizanTestApp,
  get,
  hasTestDb,
  seedFirm,
  seedMember,
  type SeededFirm,
} from "@app/lawfirm/tests/helpers.js";
import { PERMISSION_PROVIDER } from "@core/kernel/tokens.js";
import type { IPermissionProvider } from "@core/contracts/index.js";
import { ClientsService } from "@app/lawfirm/clients/clients-service.js";

const suite = hasTestDb ? describe : describe.skip;

suite("lawfirm/clients", () => {
  let app: TestingModule;
  let firmA: SeededFirm;
  let firmB: SeededFirm;
  const svc = () => get<ClientsService>(app, ClientsService);

  beforeAll(async () => {
    app = await createMizanTestApp();
    firmA = await seedFirm(app, "Firm A");
    firmB = await seedFirm(app, "Firm B");
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it("creates a client and reads it back in detail shape", async () => {
    const created = await asUser(firmA.adminId, firmA.orgId, () =>
      svc().create(
        {
          name: "Al-Nour Trading Co.",
          type: "company",
          taxId: "204-889-113",
          address: "Mohandessin, Giza",
          email: null,
          phone: null,
          notes: null,
        },
        firmA.adminId,
      ),
    );
    expect(created.id).toMatch(/^cli_/);
    expect(created.city).toBe("Giza");
    expect(created.registration).toBe("204-889-113");
    expect(created.stats).toMatchObject({ openMatters: 0, totalMatters: 0, unbilledHours: 0 });
    expect(created.stats.outstanding).toEqual([]);

    const fetched = await asUser(firmA.adminId, firmA.orgId, () => svc().get(created.id));
    expect(fetched.name).toBe("Al-Nour Trading Co.");
  });

  it("lists with the summary envelope and paginates at 10", async () => {
    await asUser(firmA.adminId, firmA.orgId, async () => {
      for (let i = 0; i < 12; i++) {
        await svc().create(
          {
            name: `Client ${String(i).padStart(2, "0")}`,
            type: i % 2 ? "individual" : "company",
            email: null,
            phone: null,
            taxId: null,
            address: null,
            notes: null,
          },
          firmA.adminId,
        );
      }
    });
    const page1 = await asUser(firmA.adminId, firmA.orgId, () => svc().list({}));
    expect(page1.items).toHaveLength(10);
    expect(page1.total).toBeGreaterThanOrEqual(13);
    expect(page1.summary.total).toBe(page1.total);
    expect(page1.summary.companies + page1.summary.individuals).toBeLessThanOrEqual(
      page1.summary.total,
    );

    const filtered = await asUser(firmA.adminId, firmA.orgId, () =>
      svc().list({ type: "individual" }),
    );
    expect(filtered.items.every((c) => c.type === "individual")).toBe(true);
  });

  it("archive flips status and records activity", async () => {
    const c = await asUser(firmA.adminId, firmA.orgId, () =>
      svc().create(
        {
          name: "Cedar Holdings",
          type: "company",
          email: null,
          phone: null,
          taxId: null,
          address: null,
          notes: null,
        },
        firmA.adminId,
      ),
    );
    const archived = await asUser(firmA.adminId, firmA.orgId, () =>
      svc().archive(c.id, firmA.adminId),
    );
    expect(archived.status).toBe("archived");
    const feed = await asUser(firmA.adminId, firmA.orgId, () => svc().activityFeed(c.id));
    expect(feed.some((e) => e.action === "client.archived")).toBe(true);
  });

  it("contacts: adding a primary contact demotes the previous primary", async () => {
    const c = await asUser(firmA.adminId, firmA.orgId, () =>
      svc().create(
        {
          name: "Contact Co",
          type: "company",
          email: null,
          phone: null,
          taxId: null,
          address: null,
          notes: null,
        },
        firmA.adminId,
      ),
    );
    await asUser(firmA.adminId, firmA.orgId, () =>
      svc().addContact(c.id, { name: "First", primary: true }),
    );
    await asUser(firmA.adminId, firmA.orgId, () =>
      svc().addContact(c.id, { name: "Second", primary: true }),
    );
    const contacts = await asUser(firmA.adminId, firmA.orgId, () => svc().contacts(c.id));
    expect(contacts.filter((k) => k.primary)).toHaveLength(1);
    expect(contacts.find((k) => k.primary)?.name).toBe("Second");
  });

  it("authz: the seeded role matrix gates create:client but allows read:client for read_only", async () => {
    const readerId = await seedMember(app, firmA, "read_only", "Reader");
    const perms = get<IPermissionProvider>(app, PERMISSION_PROVIDER);
    const can = (uid: string, action: string, resource: string) =>
      asUser(uid, firmA.orgId, () => perms.can(uid, action, resource));

    expect(await can(readerId, "read", "client")).toBe(true);
    expect(await can(readerId, "create", "client")).toBe(false);
    expect(await can(firmA.adminId, "create", "client")).toBe(true);
  });

  it("tenant isolation: firm B cannot see or fetch firm A's clients", async () => {
    const a = await asUser(firmA.adminId, firmA.orgId, () =>
      svc().create(
        {
          name: "A-only",
          type: "company",
          email: null,
          phone: null,
          taxId: null,
          address: null,
          notes: null,
        },
        firmA.adminId,
      ),
    );
    const bList = await asUser(firmB.adminId, firmB.orgId, () => svc().list({}));
    expect(bList.items.some((c) => c.id === a.id)).toBe(false);
    await expect(asUser(firmB.adminId, firmB.orgId, () => svc().get(a.id))).rejects.toThrow(
      /not found/i,
    );
  });
});
