import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import { fixedClock } from "@core/kernel/clock.js";
import {
  asUser,
  createMizanTestApp,
  get,
  hasTestDb,
  seedFirm,
  type SeededFirm,
} from "@app/lawfirm/tests/helpers.js";
import { ClientsService } from "@app/lawfirm/clients/clients-service.js";
import { MattersService } from "@app/lawfirm/matters/matters-service.js";

const suite = hasTestDb ? describe : describe.skip;

suite("lawfirm/matters", () => {
  let app: TestingModule;
  let firmA: SeededFirm;
  let firmB: SeededFirm;
  let clientId: string;
  const clock = fixedClock("2026-06-01T09:00:00.000Z");
  const matters = () => get<MattersService>(app, MattersService);
  const clients = () => get<ClientsService>(app, ClientsService);

  beforeAll(async () => {
    app = await createMizanTestApp({ clock });
    firmA = await seedFirm(app, "Firm A");
    firmB = await seedFirm(app, "Firm B");
    const c = await asUser(firmA.adminId, firmA.orgId, () =>
      clients().create(
        {
          name: "Al-Nour",
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
    clientId = c.id;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it("opens a matter with a generated reference and a Lead participant", async () => {
    const m = await asUser(firmA.adminId, firmA.orgId, () =>
      matters().create(
        {
          title: "Facility dispute",
          clientId,
          practiceArea: "Litigation",
          court: "Cairo Economic Court",
        },
        firmA.adminId,
      ),
    );
    expect(m.reference).toBe("TP-2026-0001");
    expect(m.clientName).toBe("Al-Nour");
    expect(m.leadLawyer).toEqual({ id: firmA.adminId, name: "Firm Admin" });
    expect(m.value).toEqual([]);
    expect(m.participants).toHaveLength(1);
    expect(m.participants[0].role).toBe("Lead");
    expect(m.counts).toEqual({ hearings: 0, tasks: 0, openTasks: 0, documents: 0, notes: 0 });

    const m2 = await asUser(firmA.adminId, firmA.orgId, () =>
      matters().create({ title: "Second", clientId, practiceArea: "Corporate" }, firmA.adminId),
    );
    expect(m2.reference).toBe("TP-2026-0002");
  });

  it("rejects a matter for an unknown client", async () => {
    await expect(
      asUser(firmA.adminId, firmA.orgId, () =>
        matters().create(
          { title: "X", clientId: "cli_missing", practiceArea: "Tax" },
          firmA.adminId,
        ),
      ),
    ).rejects.toThrow(/client/i);
  });

  it("list carries a summary and aggregateValue is empty", async () => {
    const list = await asUser(firmA.adminId, firmA.orgId, () => matters().list({}));
    expect(list.summary.total).toBeGreaterThanOrEqual(2);
    expect(list.summary.aggregateValue).toEqual([]);
    expect(list.items[0].value).toEqual([]);
  });

  it("notes: add, edit, delete", async () => {
    const m = await asUser(firmA.adminId, firmA.orgId, () =>
      matters().create({ title: "With notes", clientId, practiceArea: "Tax" }, firmA.adminId),
    );
    const n = await asUser(firmA.adminId, firmA.orgId, () =>
      matters().addNote(m.id, "keep settlement open", firmA.adminId),
    );
    expect(n.author).toBe("Firm Admin");
    const edited = await asUser(firmA.adminId, firmA.orgId, () =>
      matters().updateNote(m.id, n.id, "changed"),
    );
    expect(edited.body).toBe("changed");
    await asUser(firmA.adminId, firmA.orgId, () => matters().deleteNote(m.id, n.id));
    const notes = await asUser(firmA.adminId, firmA.orgId, () => matters().notes(m.id));
    expect(notes).toHaveLength(0);
  });

  it("close sets status + closedAt and logs activity", async () => {
    const m = await asUser(firmA.adminId, firmA.orgId, () =>
      matters().create({ title: "To close", clientId, practiceArea: "Tax" }, firmA.adminId),
    );
    const closed = await asUser(firmA.adminId, firmA.orgId, () =>
      matters().close(m.id, firmA.adminId),
    );
    expect(closed.status).toBe("closed");
    expect(closed.closedAt).not.toBeNull();
    const feed = await asUser(firmA.adminId, firmA.orgId, () => matters().activityFeed(m.id));
    expect(feed.some((e) => e.action === "matter.closed")).toBe(true);
  });

  it("tenant isolation: firm B cannot fetch firm A's matter", async () => {
    const m = await asUser(firmA.adminId, firmA.orgId, () =>
      matters().create({ title: "A only", clientId, practiceArea: "Tax" }, firmA.adminId),
    );
    await expect(asUser(firmB.adminId, firmB.orgId, () => matters().get(m.id))).rejects.toThrow(
      /not found/i,
    );
  });
});
