import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import { fixedClock } from "@core/kernel/clock.js";
import { setConfigForTests } from "@core/kernel/config.js";
import {
  asUser,
  createMizanTestApp,
  get,
  hasTestDb,
  seedFirm,
  seedMember,
  type SeededFirm,
} from "./helpers.js";
import { ClientsService } from "@app/lawfirm/clients/clients-service.js";
import { MattersService } from "@app/lawfirm/matters/matters-service.js";
import { HearingsService } from "@app/lawfirm/hearings/hearings-service.js";
import { TasksService } from "@app/lawfirm/tasks/tasks-service.js";
import { TimeService } from "@app/lawfirm/time/time-service.js";
import { SettingsService } from "@app/lawfirm/settings/settings-service.js";
import { DocumentsService } from "@app/lawfirm/documents/documents-service.js";
import { FileStorageService } from "@core/files/infrastructure/file-storage.js";
import { CalendarService } from "@app/lawfirm/calendar/calendar-service.js";
import { TeamService } from "@app/lawfirm/staff/team-service.js";
import { DashboardService } from "@app/lawfirm/dashboard/dashboard-service.js";
import { BillingService } from "@app/lawfirm/billing/billing-service.js";
import { AdminService } from "@app/lawfirm/admin/admin-service.js";
import { StaffRepository } from "@app/lawfirm/staff/staff-repository.js";

const suite = hasTestDb ? describe : describe.skip;

suite("lawfirm feature areas", () => {
  let app: TestingModule;
  let firm: SeededFirm;
  let firmB: SeededFirm;
  let clientId: string;
  let matterId: string;
  const clock = fixedClock("2026-06-01T09:00:00.000Z");
  const svc = <T>(t: new (...a: never[]) => T) => get<T>(app, t);
  let storageDir: string;

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), "mizan-files-"));
    setConfigForTests({ fileStoragePath: storageDir });
    app = await createMizanTestApp({ clock });
    setConfigForTests({ fileStoragePath: storageDir });
    firm = await seedFirm(app, "Firm A");
    firmB = await seedFirm(app, "Firm B");
    await asUser(firm.adminId, firm.orgId, async () => {
      const c = await svc(ClientsService).create(
        {
          name: "Al-Nour",
          type: "company",
          email: null,
          phone: null,
          taxId: null,
          address: null,
          notes: null,
        },
        firm.adminId,
      );
      clientId = c.id;
      const m = await svc(MattersService).create(
        {
          title: "Facility dispute",
          clientId,
          practiceArea: "Litigation",
          court: "Cairo Economic Court",
        },
        firm.adminId,
      );
      matterId = m.id;
    });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  it("hearings: schedule → adjourn chains a new scheduled session", async () => {
    const h = await asUser(firm.adminId, firm.orgId, () =>
      svc(HearingsService).create(
        { matterId, purpose: "Merits", scheduledAt: "2026-06-10T09:00:00Z" },
        firm.adminId,
      ),
    );
    expect(h.matterReference).toMatch(/^TP-/);
    const { adjourned, next } = await asUser(firm.adminId, firm.orgId, () =>
      svc(HearingsService).adjourn(h.id, "2026-07-01T09:00:00Z", "Court motion", firm.adminId),
    );
    expect(adjourned.status).toBe("adjourned");
    expect(next.status).toBe("scheduled");
    expect(new Date(next.scheduledAt).toISOString()).toBe("2026-07-01T09:00:00.000Z");

    const decided = await asUser(firm.adminId, firm.orgId, () =>
      svc(HearingsService).recordOutcome(next.id, "Claim dismissed", firm.adminId),
    );
    expect(decided.status).toBe("decided");
  });

  it("tasks: create, toggle complete, and 'mine' filter", async () => {
    const t = await asUser(firm.adminId, firm.orgId, () =>
      svc(TasksService).create(
        { title: "Draft memo", matterId, priority: "high", dueAt: "2026-06-02T00:00:00Z" },
        firm.adminId,
      ),
    );
    expect(t.overdue).toBe(false);
    const done = await asUser(firm.adminId, firm.orgId, () =>
      svc(TasksService).toggleComplete(t.id, firm.adminId),
    );
    expect(done.status).toBe("done");
    expect(done.completedAt).not.toBeNull();
    const mine = await asUser(firm.adminId, firm.orgId, () =>
      svc(TasksService).list({ mine: true, actorId: firm.adminId }),
    );
    expect(mine.items.every((k) => k.assigneeId === firm.adminId)).toBe(true);
  });

  it("time entries: log → list(mine) → summary rolls up → patch → delete", async () => {
    await asUser(firm.adminId, firm.orgId, () =>
      svc(SettingsService).update(
        { standardRates: [{ role: "Partner", hourlyRate: 3000, currency: "EGP" }] },
        firm.adminId,
      ),
    );

    const e = await asUser(firm.adminId, firm.orgId, () =>
      svc(TimeService).create(
        { matterId, activity: "Drafting", minutes: 90, billable: true },
        firm.adminId,
      ),
    );
    expect(e.hours).toBe(1.5);
    expect(e.hourlyRate).toBe(3000);
    expect(e.value).toEqual([{ currency: "EGP", amount: "4500" }]);

    const mine = await asUser(firm.adminId, firm.orgId, () =>
      svc(TimeService).list({ mine: true, actorId: firm.adminId }),
    );
    expect(mine.items.some((x) => x.id === e.id)).toBe(true);

    const summary = await asUser(firm.adminId, firm.orgId, () =>
      svc(TimeService).summary({ actorId: firm.adminId }),
    );
    const row = summary.items.find((x) => x.matterId === matterId)!;
    expect(row.minutes).toBe(90);
    expect(summary.totals).toEqual([{ currency: "EGP", amount: "4500" }]);

    const patched = await asUser(firm.adminId, firm.orgId, () =>
      svc(TimeService).update(e.id, { minutes: 120 }),
    );
    expect(patched.minutes).toBe(120);

    await asUser(firm.adminId, firm.orgId, () => svc(TimeService).remove(e.id));
    const after = await asUser(firm.adminId, firm.orgId, () =>
      svc(TimeService).list({ actorId: firm.adminId }),
    );
    expect(after.items.some((x) => x.id === e.id)).toBe(false);
  });

  it("hearings: check-in stamps checkedInAt and is idempotent", async () => {
    const h = await asUser(firm.adminId, firm.orgId, () =>
      svc(HearingsService).create(
        { matterId, purpose: "Directions", scheduledAt: "2026-06-12T09:00:00Z" },
        firm.adminId,
      ),
    );
    expect(h.checkedInAt).toBeNull();
    const first = await asUser(firm.adminId, firm.orgId, () =>
      svc(HearingsService).checkIn(h.id, firm.adminId),
    );
    expect(first.checkedInAt).not.toBeNull();
    const second = await asUser(firm.adminId, firm.orgId, () =>
      svc(HearingsService).checkIn(h.id, firm.adminId),
    );
    expect(second.checkedInAt).toBe(first.checkedInAt);
    const fetched = await asUser(firm.adminId, firm.orgId, () => svc(HearingsService).get(h.id));
    expect(fetched.checkedInAt).toBe(first.checkedInAt);
  });

  it("documents: metadata-only upload + summary", async () => {
    const d = await asUser(firm.adminId, firm.orgId, () =>
      svc(DocumentsService).upload(
        { name: "Statement.pdf", matterId, category: "Pleading" },
        firm.adminId,
      ),
    );
    expect(d.matterReference).toMatch(/^TP-/);
    expect(d.status).toBe("draft");
    const summary = await asUser(firm.adminId, firm.orgId, () => svc(DocumentsService).summary());
    expect(summary.total).toBeGreaterThanOrEqual(1);
    expect(summary.awaitingReview).toBeGreaterThanOrEqual(1);
  });

  it("calendar: aggregates hearings, events and due tasks", async () => {
    await asUser(firm.adminId, firm.orgId, () =>
      svc(CalendarService).createEvent(
        { title: "Client call", kind: "meeting", startAt: "2026-06-05T14:00:00Z", matterId },
        firm.adminId,
      ),
    );
    const cal = await asUser(firm.adminId, firm.orgId, () =>
      svc(CalendarService).range({ from: "2026-01-01", to: "2026-12-31" }),
    );
    const kinds = new Set(cal.items.map((i) => i.kind));
    expect(kinds.has("hearing")).toBe(true);
    expect(kinds.has("event")).toBe(true);
    expect([...cal.items].map((i) => i.at)).toEqual([...cal.items].map((i) => i.at).sort());
  });

  it("team: a staff profile carries real workload counts and utilization 0", async () => {
    await asUser(firm.adminId, firm.orgId, () =>
      get<StaffRepository>(app, StaffRepository).upsert({
        userId: firm.adminId,
        title: "Managing Partner",
        practiceAreas: ["Litigation"],
      }),
    );
    const list = await asUser(firm.adminId, firm.orgId, () => svc(TeamService).list());
    const me = list.items.find((m) => m.email.startsWith("admin+"));
    expect(me).toBeDefined();
    expect(me!.role).toBe("firm_admin");
    expect(me!.activeMatters).toBeGreaterThanOrEqual(1);
    expect(me!.utilization).toBe(0);
  });

  it("team: candidates lists firm members without a profile, create adds one", async () => {
    const newUserId = await seedMember(app, firm, "lawyer", "Nadia Farouk");

    const before = await asUser(firm.adminId, firm.orgId, () => svc(TeamService).candidates());
    expect(before.items.some((c) => c.id === newUserId)).toBe(true);

    const created = await asUser(firm.adminId, firm.orgId, () =>
      svc(TeamService).create({ userId: newUserId, title: "Senior Associate" }),
    );
    expect(created.title).toBe("Senior Associate");
    expect(created.name).toBe("Nadia Farouk");

    const after = await asUser(firm.adminId, firm.orgId, () => svc(TeamService).candidates());
    expect(after.items.some((c) => c.id === newUserId)).toBe(false);

    await expect(
      asUser(firm.adminId, firm.orgId, () => svc(TeamService).create({ userId: newUserId })),
    ).rejects.toThrow(/already has a team profile/);
  });

  it("team: create rejects a user who is not a member of the firm", async () => {
    const outsiderId = await seedMember(app, firmB, "lawyer", "Outsider");
    await expect(
      asUser(firm.adminId, firm.orgId, () => svc(TeamService).create({ userId: outsiderId })),
    ).rejects.toThrow(/not a member of this firm/);
  });

  it("documents: presigned upload — createUpload → write bytes → confirm → download", async () => {
    const bytes = Buffer.from("%PDF-1.7 pleading body\n");

    const { document, upload } = await asUser(firm.adminId, firm.orgId, () =>
      svc(DocumentsService).createUpload(
        {
          name: "Motion to Dismiss.pdf",
          matterId,
          category: "Pleading",
          contentType: "application/pdf",
          byteSize: bytes.byteLength,
        },
        firm.adminId,
      ),
    );
    expect(upload.method).toBe("PUT");
    expect(upload.url).toMatch(/^\/files\/file_[\w-]+\/bytes$/);

    // Before confirm the document is not downloadable.
    await expect(
      asUser(firm.adminId, firm.orgId, () => svc(DocumentsService).content(document.id)),
    ).rejects.toThrow(/upload has not been confirmed/);

    // What `PUT /api/files/:id/bytes` does under the hood:
    const fileId = upload.url.split("/")[2];
    await asUser(firm.adminId, firm.orgId, () =>
      get(app, FileStorageService).writeBytes(fileId, bytes),
    );

    const confirmed = await asUser(firm.adminId, firm.orgId, () =>
      svc(DocumentsService).confirmUpload(document.id, firm.adminId),
    );
    expect(confirmed.sizeBytes).toBe(bytes.byteLength);

    const { content, contentType } = await asUser(firm.adminId, firm.orgId, () =>
      svc(DocumentsService).content(document.id),
    );
    expect(content.equals(bytes)).toBe(true);
    expect(contentType).toBe("application/pdf");

    // Removing the document also removes the underlying stored file — no orphan.
    await asUser(firm.adminId, firm.orgId, () => svc(DocumentsService).remove(document.id));
    await expect(
      asUser(firm.adminId, firm.orgId, () =>
        get(app, FileStorageService).getContent({ id: fileId }),
      ),
    ).rejects.toThrow(/not found/i);
  });

  it("documents: content() reports when a metadata-only document has no file", async () => {
    const d = await asUser(firm.adminId, firm.orgId, () =>
      svc(DocumentsService).upload(
        { name: "Placeholder.pdf", matterId, category: "Correspondence" },
        firm.adminId,
      ),
    );
    await expect(
      asUser(firm.adminId, firm.orgId, () => svc(DocumentsService).content(d.id)),
    ).rejects.toThrow(/no file attached/);
  });

  it("dashboard: composes KPIs with empty derived slots", async () => {
    const data = await asUser(firm.adminId, firm.orgId, () => svc(DashboardService).data());
    expect(data.kpis.activeMatters).toBeGreaterThanOrEqual(1);
    expect(data.kpis.unbilledHours).toBe(0);
    expect(data.kpis.unbilledValue).toEqual([]);
    expect(data.billing.series).toEqual([]);
    expect(Array.isArray(data.recentActivity)).toBe(true);
  });

  it("dashboard: billing series spans the trailing 6 months once there is activity", async () => {
    const inv = await asUser(firm.adminId, firm.orgId, () =>
      svc(BillingService).createInvoice(
        {
          clientId,
          currency: "EGP",
          vatRate: 0.14,
          lines: [{ kind: "fee", description: "Fees", amount: 100_000 }],
        },
        firm.adminId,
      ),
    );
    await asUser(firm.adminId, firm.orgId, () =>
      svc(BillingService).invoiceAction(inv.id, "issue", firm.adminId),
    );
    await asUser(firm.adminId, firm.orgId, () =>
      svc(BillingService).recordPayment(
        { invoiceId: inv.id, amount: 50_000, currency: "EGP", method: "bank_transfer" },
        firm.adminId,
      ),
    );

    const data = await asUser(firm.adminId, firm.orgId, () => svc(DashboardService).data());
    expect(data.billing.series).toHaveLength(6);
    expect(data.billing.series.map((p) => p.month)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
    ]);
    const current = data.billing.series.at(-1)!;
    expect(current).toMatchObject({
      month: "2026-06",
      currency: "EGP",
      billed: 114_000,
      collected: 50_000,
    });
    expect(data.billing.series.slice(0, 5).every((p) => p.billed === 0 && p.collected === 0)).toBe(
      true,
    );
  });

  it("admin adapter: roles carry a permission count; members carry a role key", async () => {
    const lawyerId = await seedMember(app, firm, "lawyer", "A Lawyer");
    const roles = await asUser(firm.adminId, firm.orgId, () => svc(AdminService).roles());
    expect(roles.items).toHaveLength(6);
    expect(roles.items.find((r) => r.key === "firm_admin")!.permissions).toBeGreaterThan(0);
    const members = await asUser(firm.adminId, firm.orgId, () => svc(AdminService).members());
    expect(members.items.some((m) => m.role === "lawyer")).toBe(true);

    // assignRole is replace, not add
    await asUser(firm.adminId, firm.orgId, () =>
      svc(AdminService).assignRole(lawyerId, "paralegal", firm.adminId),
    );
    const after = await asUser(firm.adminId, firm.orgId, () => svc(AdminService).members());
    expect(after.items.find((m) => m.id === lawyerId)!.role).toBe("paralegal");
  });

  it("notifications adapter: reshapes Core notifications to { items, unreadCount, readAt, href }", async () => {
    // seed one directly into the Core table for the admin
    await asUser(firm.adminId, firm.orgId, async () => {
      const { currentExecutor } = await import("@core/kernel/db/db.js");
      await currentExecutor()
        .insertInto("notifications")
        .values({
          id: "ntf_test_1",
          user_id: firm.adminId,
          organization_id: firm.orgId,
          type: "hearing.scheduled",
          title: "Hearing scheduled",
          body: "Cairo Economic Court",
          locale: "en",
        })
        .execute();
    });
    const list = await asUser(firm.adminId, firm.orgId, () =>
      svc(AdminService).notifications(firm.adminId, false),
    );
    expect(Array.isArray(list.items)).toBe(true);
    expect(list.items.some((n) => n.title === "Hearing scheduled" && n.readAt === null)).toBe(true);
    expect(list.unreadCount).toBeGreaterThanOrEqual(1);

    await asUser(firm.adminId, firm.orgId, () =>
      svc(AdminService).markAllNotificationsRead(firm.adminId),
    );
    const after = await asUser(firm.adminId, firm.orgId, () =>
      svc(AdminService).notifications(firm.adminId, false),
    );
    expect(after.unreadCount).toBe(0);
  });

  it("tenant isolation: firm B sees none of firm A's data", async () => {
    const [bMatters, bHearings, bTasks, bDocs, bTime] = await Promise.all([
      asUser(firmB.adminId, firmB.orgId, () => svc(MattersService).list({})),
      asUser(firmB.adminId, firmB.orgId, () => svc(HearingsService).list({})),
      asUser(firmB.adminId, firmB.orgId, () => svc(TasksService).list({ actorId: firmB.adminId })),
      asUser(firmB.adminId, firmB.orgId, () => svc(DocumentsService).list({})),
      asUser(firmB.adminId, firmB.orgId, () => svc(TimeService).list({ actorId: firmB.adminId })),
    ]);
    expect(bMatters.items).toHaveLength(0);
    expect(bHearings.items).toHaveLength(0);
    expect(bTasks.items).toHaveLength(0);
    expect(bDocs.items).toHaveLength(0);
    expect(bTime.items).toHaveLength(0);
  });
});
