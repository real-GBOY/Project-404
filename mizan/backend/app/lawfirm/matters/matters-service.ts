import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { currentExecutor, readInTenant } from "@core/kernel/db/db.js";
import { NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, EVENT_BUS, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger, IEventBus } from "@core/contracts/index.js";
import { ActivityService } from "@app/lawfirm/activity/activity-service.js";
import { LawfirmDirectory } from "@app/lawfirm/shared/directory.js";
import { LawfirmQueries } from "@app/lawfirm/shared/lawfirm-queries.js";
import { moneyList } from "@app/lawfirm/shared/money.js";
import { SettingsService } from "@app/lawfirm/settings/settings-service.js";
import { matterAssigned, matterClosed, matterOpened } from "./matter.events.js";
import { MattersRepository, type MatterRow } from "./matters-repository.js";

const PAGE_SIZE = 10;

@Injectable()
export class MattersService {
  constructor(
    private readonly repo: MattersRepository,
    private readonly queries: LawfirmQueries,
    private readonly directory: LawfirmDirectory,
    private readonly activity: ActivityService,
    private readonly settings: SettingsService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async caseworkSummary() {
    return readInTenant(async () => {
      const matters = await this.repo.allForSummary();
      const [hearings, tasks] = await Promise.all([
        this.countScheduledHearings(),
        this.countOpenTasks(),
      ]);
      return {
        matters: matters.filter((m) => m.status !== "closed").length,
        hearings,
        tasks,
      };
    });
  }

  async formOptions() {
    const settings = await this.settings.get();
    return readInTenant(async () => {
      const clientRows = await this.repo.clientNameMap();
      const openMatters = (await this.repo.allForSummary()).filter((m) => m.status !== "closed");
      const staffIds = await this.queries.activeStaffIds();
      const names = await this.directory.userNames(staffIds);
      return {
        clients: [...clientRows.entries()].map(([id, name]) => ({ id, name })),
        matters: openMatters.map((m) => ({ id: m.id, name: `${m.reference} — ${m.title}` })),
        lawyers: staffIds.map((id) => ({ id, name: names.get(id) ?? "—" })),
        practiceAreas: settings.matterTypes,
        courts: settings.courts,
      };
    });
  }

  async list(params: {
    q?: string;
    status?: MatterRow["status"] | "all";
    practiceArea?: string;
    clientId?: string;
    sort?: string;
    page?: number;
  }) {
    return readInTenant(async () => {
      const { rows, total } = await this.repo.list({
        q: params.q,
        status: params.status ?? "all",
        practiceArea: params.practiceArea || undefined,
        clientId: params.clientId || undefined,
        sort: params.sort === "openedAt" ? "openedAt" : "-openedAt",
        page: Math.max(1, params.page ?? 1),
        pageSize: PAGE_SIZE,
      });
      const items = await Promise.all(rows.map((m) => this.listItem(m)));

      const all = await this.repo.allForSummary();
      const yearStart = new Date(this.clock.now().getFullYear(), 0, 1);
      return {
        items,
        total,
        summary: {
          total: all.length,
          active: all.filter((m) => m.status === "open").length,
          onHold: all.filter((m) => m.status === "on_hold").length,
          closedThisYear: all.filter((m) => m.closedAt && m.closedAt >= yearStart).length,
          aggregateValue: [],
        },
      };
    });
  }

  async get(id: string) {
    const matter = await readInTenant(() => this.repo.findById(id));
    if (!matter) throw NotFound("matter.not_found", "Matter not found.");
    return readInTenant(() => this.detail(matter));
  }

  async create(
    input: { title: string; clientId: string; practiceArea: string; court?: string | null; description?: string | null },
    actorId: string,
  ) {
    const matter = await this.uow.transaction(async () => {
      if (!(await this.repo.clientExists(input.clientId))) {
        throw ValidationError("matter.unknown_client", "That client does not exist.");
      }
      const reference = await this.repo.nextReference(this.clock.now().getFullYear());
      const created = await this.repo.create({
        reference,
        title: input.title,
        clientId: input.clientId,
        practiceArea: input.practiceArea,
        court: input.court ?? null,
        leadLawyerId: actorId,
        description: input.description ?? null,
        openedAt: this.clock.now(),
      });
      await this.repo.addParticipant(created.id, actorId, "Lead");
      await this.activity.record({
        actorId,
        action: "matter.opened",
        targetType: "matter",
        targetId: created.id,
        targetLabel: created.title,
      });
      await this.audit.record({
        actorId,
        action: "lawfirm.matter.opened",
        resourceType: "lawfirm_matter",
        resourceId: created.id,
        after: created,
      });
      await this.events.publish(matterOpened({ matterId: created.id, reference, actorId }));
      return created;
    });
    return readInTenant(() => this.detail(matter));
  }

  async update(
    id: string,
    patch: Partial<{ title: string; practiceArea: string; court: string | null; description: string | null; clientId: string }>,
    actorId: string,
  ) {
    const matter = await this.uow.transaction(async () => {
      const before = await this.repo.findById(id);
      if (!before) throw NotFound("matter.not_found", "Matter not found.");
      const updated = await this.repo.update(id, patch);
      await this.audit.record({
        actorId,
        action: "lawfirm.matter.updated",
        resourceType: "lawfirm_matter",
        resourceId: id,
        before,
        after: updated,
      });
      return updated!;
    });
    return readInTenant(() => this.detail(matter));
  }

  async close(id: string, actorId: string) {
    const matter = await this.uow.transaction(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) throw NotFound("matter.not_found", "Matter not found.");
      const closed = await this.repo.close(id, this.clock.now());
      await this.activity.record({
        actorId,
        action: "matter.closed",
        targetType: "matter",
        targetId: id,
        targetLabel: existing.title,
      });
      await this.audit.record({
        actorId,
        action: "lawfirm.matter.closed",
        resourceType: "lawfirm_matter",
        resourceId: id,
      });
      await this.events.publish(matterClosed({ matterId: id, actorId }));
      return closed!;
    });
    return readInTenant(() => this.detail(matter));
  }

  // ─── participants ──────────────────────────────────────────────────────────
  async participants(id: string) {
    await this.assertExists(id);
    return readInTenant(() => this.participantViews(id));
  }

  async addParticipant(id: string, userId: string, role: string, actorId: string) {
    return this.uow.transaction(async () => {
      const matter = await this.repo.findById(id);
      if (!matter) throw NotFound("matter.not_found", "Matter not found.");
      const row = await this.repo.addParticipant(id, userId, role);
      await this.events.publish(matterAssigned({ matterId: id, userId, role, actorId }));
      return { id: row.id, userId: row.userId, name: (await this.directory.userName(userId)) ?? "—", role: row.role };
    });
  }

  async removeParticipant(id: string, participantId: string) {
    return this.uow.transaction(async () => {
      await this.assertExists(id);
      await this.repo.removeParticipant(id, participantId);
    });
  }

  // ─── updates ───────────────────────────────────────────────────────────────
  async updates(id: string) {
    await this.assertExists(id);
    return readInTenant(async () => {
      const rows = await this.repo.updates(id);
      const names = await this.directory.userNames(rows.map((r) => r.authorId));
      const docNames = await this.documentNameMap(rows.flatMap((r) => r.documentIds));
      return rows.map((r) => ({
        id: r.id,
        author: names.get(r.authorId) ?? "—",
        body: r.body,
        documents: r.documentIds
          .filter((did) => docNames.has(did))
          .map((did) => ({ id: did, name: docNames.get(did)! })),
        createdAt: r.createdAt.toISOString(),
      }));
    });
  }

  async addUpdate(id: string, body: string, documentIds: string[], actorId: string) {
    const row = await this.uow.transaction(async () => {
      const matter = await this.repo.findById(id);
      if (!matter) throw NotFound("matter.not_found", "Matter not found.");
      const created = await this.repo.addUpdate(id, actorId, body, documentIds);
      await this.activity.record({
        actorId,
        action: "matter.update_added",
        targetType: "matter",
        targetId: id,
        targetLabel: matter.title,
      });
      return created;
    });
    return {
      id: row.id,
      author: (await this.directory.userName(actorId)) ?? "—",
      body: row.body,
      documents: [] as { id: string; name: string }[],
      createdAt: row.createdAt.toISOString(),
    };
  }

  // ─── notes ─────────────────────────────────────────────────────────────────
  async notes(id: string) {
    await this.assertExists(id);
    return readInTenant(async () => {
      const rows = await this.repo.notes(id);
      const names = await this.directory.userNames(rows.map((r) => r.authorId));
      return rows.map((n) => this.noteView(n, names.get(n.authorId) ?? "—"));
    });
  }

  async addNote(id: string, body: string, actorId: string) {
    const note = await this.uow.transaction(async () => {
      const matter = await this.repo.findById(id);
      if (!matter) throw NotFound("matter.not_found", "Matter not found.");
      return this.repo.addNote(id, actorId, body);
    });
    return this.noteView(note, (await this.directory.userName(actorId)) ?? "—");
  }

  async updateNote(id: string, noteId: string, body: string) {
    const note = await this.uow.transaction(async () => {
      const existing = await this.repo.findNote(id, noteId);
      if (!existing) throw NotFound("matter_note.not_found", "Note not found.");
      return (await this.repo.updateNote(id, noteId, body))!;
    });
    return this.noteView(note, (await this.directory.userName(note.authorId)) ?? "—");
  }

  async deleteNote(id: string, noteId: string) {
    await this.uow.transaction(async () => {
      const existing = await this.repo.findNote(id, noteId);
      if (!existing) throw NotFound("matter_note.not_found", "Note not found.");
      await this.repo.deleteNote(id, noteId);
    });
  }

  // ─── financials / activity ─────────────────────────────────────────────────
  async financials(id: string) {
    await this.assertExists(id);
    return readInTenant(async () => {
      const invoices = await this.repo.invoicesForMatter(id);
      const totals = await this.queries.invoiceTotals(invoices.map((i) => i.id));
      const expenses = await this.repo.expensesForMatter(id);
      return {
        billed: moneyList(invoices.map((i) => ({ currency: i.currency, amount: totals.get(i.id)?.total ?? 0 }))),
        collected: moneyList(invoices.map((i) => ({ currency: i.currency, amount: totals.get(i.id)?.paid ?? 0 }))),
        outstanding: moneyList(
          invoices.map((i) => ({ currency: i.currency, amount: totals.get(i.id)?.balance ?? 0 })),
        ),
        expenses: moneyList(expenses.map((e) => ({ currency: e.currency, amount: Number(e.amount) }))),
        invoices: invoices.map((i) => ({
          id: i.id,
          number: i.number,
          status: i.status,
          currency: i.currency,
          total: totals.get(i.id)?.total ?? 0,
          balance: totals.get(i.id)?.balance ?? 0,
        })),
      };
    });
  }

  async activityFeed(id: string) {
    await this.assertExists(id);
    return readInTenant(async () => {
      const hearingIds = await this.hearingIdsForMatter(id);
      return this.activity.forTargets([
        { type: "matter", id },
        ...hearingIds.map((hid) => ({ type: "hearing", id: hid })),
      ]);
    });
  }

  // ─── shaping ───────────────────────────────────────────────────────────────
  private async listItem(m: MatterRow) {
    const [clientName, leadName, next, openTasks] = await Promise.all([
      this.repo.clientName(m.clientId),
      this.directory.userName(m.leadLawyerId),
      this.queries.nextHearingByMatter([m.id], this.clock.now()),
      this.queries.openTaskCountByMatter([m.id]),
    ]);
    return {
      id: m.id,
      reference: m.reference,
      title: m.title,
      clientId: m.clientId,
      clientName,
      practiceArea: m.practiceArea,
      court: m.court,
      status: m.status,
      leadLawyer: leadName ?? "—",
      openedAt: m.openedAt.toISOString(),
      nextHearingAt: next.get(m.id)?.toISOString() ?? null,
      openTasks: openTasks.get(m.id) ?? 0,
      value: [],
    };
  }

  private async detail(m: MatterRow) {
    const [clientName, leadName, participants, counts] = await Promise.all([
      this.repo.clientName(m.clientId),
      this.directory.userName(m.leadLawyerId),
      this.participantViews(m.id),
      this.queries.childCountsForMatter(m.id),
    ]);
    return {
      id: m.id,
      reference: m.reference,
      title: m.title,
      description: m.description,
      clientId: m.clientId,
      clientName,
      practiceArea: m.practiceArea,
      status: m.status,
      court: m.court,
      leadLawyer: { id: m.leadLawyerId, name: leadName ?? "—" },
      openedAt: m.openedAt.toISOString(),
      closedAt: m.closedAt?.toISOString() ?? null,
      value: [],
      participants,
      counts,
    };
  }

  private async participantViews(matterId: string) {
    const rows = await this.repo.participants(matterId);
    const names = await this.directory.userNames(rows.map((r) => r.userId));
    return rows.map((p) => ({ id: p.id, userId: p.userId, name: names.get(p.userId) ?? "—", role: p.role }));
  }

  private noteView(n: { id: string; authorId: string; body: string; createdAt: Date; updatedAt: Date }, author: string) {
    return {
      id: n.id,
      author,
      authorId: n.authorId,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    };
  }

  private async assertExists(id: string): Promise<void> {
    const matter = await readInTenant(() => this.repo.findById(id));
    if (!matter) throw NotFound("matter.not_found", "Matter not found.");
  }

  private async countScheduledHearings(): Promise<number> {
    const r = await currentExecutor()
      .selectFrom("lawfirm_hearings")
      .select((eb) => eb.fn.countAll<string>().as("c"))
      .where("status", "=", "scheduled")
      .executeTakeFirst();
    return Number(r?.c ?? 0);
  }

  private async countOpenTasks(): Promise<number> {
    const r = await currentExecutor()
      .selectFrom("lawfirm_tasks")
      .select((eb) => eb.fn.countAll<string>().as("c"))
      .where("status", "!=", "done")
      .executeTakeFirst();
    return Number(r?.c ?? 0);
  }

  private async hearingIdsForMatter(matterId: string): Promise<string[]> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_hearings")
      .select("id")
      .where("matter_id", "=", matterId)
      .execute();
    return rows.map((r) => r.id);
  }

  private async documentNameMap(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await currentExecutor()
      .selectFrom("lawfirm_documents")
      .select(["id", "name"])
      .where("id", "in", ids)
      .execute();
    return new Map(rows.map((r) => [r.id, r.name]));
  }
}
