import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, EVENT_BUS, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger, IEventBus } from "@core/contracts/index.js";
import { ActivityService } from "@app/lawfirm/activity/activity-service.js";
import { LawfirmDirectory } from "@app/lawfirm/shared/directory.js";
import { LawfirmQueries } from "@app/lawfirm/shared/lawfirm-queries.js";
import { moneyList, type Money } from "@app/lawfirm/shared/money.js";
import { cityOf, registrationLabel } from "./client.domain.js";
import { clientArchived, clientCreated } from "./client.events.js";
import {
  ClientsRepository,
  type ClientRow,
  type ClientStatus,
  type ClientType,
  type CreateClientInput,
  type ListClientsParams,
} from "./clients-repository.js";

const PAGE_SIZE = 10;

@Injectable()
export class ClientsService {
  constructor(
    private readonly repo: ClientsRepository,
    private readonly queries: LawfirmQueries,
    private readonly directory: LawfirmDirectory,
    private readonly activity: ActivityService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async list(params: {
    q?: string;
    status?: ClientStatus | "all";
    type?: ClientType | "all";
    sort?: string;
    page?: number;
  }) {
    const listParams: ListClientsParams = {
      q: params.q,
      status: params.status ?? "all",
      type: params.type ?? "all",
      sort: params.sort === "createdAt" || params.sort === "-createdAt" ? params.sort : "name",
      page: Math.max(1, params.page ?? 1),
      pageSize: PAGE_SIZE,
    };

    return readInTenant(async () => {
      const { rows, total } = await this.repo.list(listParams);
      const items = await Promise.all(rows.map((r) => this.listItem(r)));
      const counts = await this.repo.summaryCounts();

      const allIds = await this.repo.allIds();
      const outstandingAll: Array<{ currency: string; amount: number }> = [];
      for (const id of allIds) {
        for (const m of await this.queries.outstandingForClient(id)) {
          outstandingAll.push({ currency: m.currency, amount: Number(m.amount) });
        }
      }

      return {
        items,
        total,
        summary: {
          total: counts.total,
          companies: counts.companies,
          individuals: counts.individuals,
          outstanding: moneyList(outstandingAll),
        },
      };
    });
  }

  async get(id: string) {
    const client = await readInTenant(() => this.repo.findById(id));
    if (!client) throw NotFound("client.not_found", "Client not found.");
    return readInTenant(() => this.detail(client));
  }

  async create(input: CreateClientInput, actorId: string) {
    const client = await this.uow.transaction(async () => {
      const created = await this.repo.create(input);
      await this.activity.record({
        actorId,
        action: "client.created",
        targetType: "client",
        targetId: created.id,
        targetLabel: created.name,
      });
      await this.audit.record({
        actorId,
        action: "lawfirm.client.created",
        resourceType: "lawfirm_client",
        resourceId: created.id,
        after: created,
      });
      await this.events.publish(
        clientCreated({ clientId: created.id, name: created.name, actorId }),
      );
      return created;
    });
    return readInTenant(() => this.detail(client));
  }

  async update(id: string, patch: Partial<CreateClientInput>, actorId: string) {
    const client = await this.uow.transaction(async () => {
      const before = await this.repo.findById(id);
      if (!before) throw NotFound("client.not_found", "Client not found.");
      const updated = await this.repo.update(id, patch);
      await this.audit.record({
        actorId,
        action: "lawfirm.client.updated",
        resourceType: "lawfirm_client",
        resourceId: id,
        before,
        after: updated,
      });
      return updated!;
    });
    return readInTenant(() => this.detail(client));
  }

  async archive(id: string, actorId: string) {
    const client = await this.uow.transaction(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) throw NotFound("client.not_found", "Client not found.");
      const updated = await this.repo.update(id, { status: "archived" });
      await this.activity.record({
        actorId,
        action: "client.archived",
        targetType: "client",
        targetId: id,
        targetLabel: existing.name,
      });
      await this.audit.record({
        actorId,
        action: "lawfirm.client.archived",
        resourceType: "lawfirm_client",
        resourceId: id,
      });
      await this.events.publish(clientArchived({ clientId: id, actorId }));
      return updated!;
    });
    return readInTenant(() => this.detail(client));
  }

  // ─── detail tabs ───────────────────────────────────────────────────────────
  async contacts(clientId: string) {
    await this.assertExists(clientId);
    return readInTenant(() => this.repo.contacts(clientId)).then((rows) =>
      rows.map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role,
        email: c.email,
        phone: c.phone,
        primary: c.primary,
      })),
    );
  }

  async addContact(
    clientId: string,
    input: { name: string; role?: string; email?: string; phone?: string; primary?: boolean },
  ) {
    return this.uow.transaction(async () => {
      const client = await this.repo.findById(clientId);
      if (!client) throw NotFound("client.not_found", "Client not found.");
      if (input.primary) await this.repo.clearPrimary(clientId);
      const row = await this.repo.addContact(clientId, input);
      return {
        id: row.id,
        name: row.name,
        role: row.role,
        email: row.email,
        phone: row.phone,
        primary: row.primary,
      };
    });
  }

  async matters(clientId: string) {
    await this.assertExists(clientId);
    return readInTenant(async () => {
      const matters = await this.repo.mattersForClient(clientId);
      const names = await this.directory.userNames(matters.map((m) => m.leadLawyerId));
      const next = await this.queries.nextHearingByMatter(
        matters.map((m) => m.id),
        this.clock.now(),
      );
      return matters.map((m) => ({
        id: m.id,
        reference: m.reference,
        title: m.title,
        practiceArea: m.practiceArea,
        court: m.court,
        leadLawyer: names.get(m.leadLawyerId) ?? "—",
        status: m.status,
        openedAt: m.openedAt.toISOString(),
        nextHearing: next.get(m.id)?.toISOString() ?? null,
      }));
    });
  }

  async documents(clientId: string) {
    await this.assertExists(clientId);
    return readInTenant(() => this.repo.documentsForClient(clientId)).then((rows) =>
      rows.map((d) => ({
        id: d.id,
        name: d.name,
        matterTitle: d.matterTitle ?? "—",
        category: d.category,
        status: d.status,
        uploadedAt: d.uploadedAt.toISOString(),
      })),
    );
  }

  async billing(clientId: string) {
    await this.assertExists(clientId);
    return readInTenant(async () => {
      const invoices = await this.repo.invoicesForClient(clientId);
      const totals = await this.queries.invoiceTotals(invoices.map((i) => i.id));
      return invoices.map((i) => ({
        id: i.id,
        number: i.number,
        status: i.status,
        currency: i.currency,
        total: totals.get(i.id)?.total ?? 0,
        balance: totals.get(i.id)?.balance ?? 0,
        issuedAt: i.issuedAt?.toISOString() ?? null,
      }));
    });
  }

  async activityFeed(clientId: string) {
    await this.assertExists(clientId);
    return readInTenant(async () => {
      const matters = await this.repo.mattersForClient(clientId);
      const targets = [
        { type: "client", id: clientId },
        ...matters.map((m) => ({ type: "matter", id: m.id })),
      ];
      return this.activity.forTargets(targets);
    });
  }

  // ─── shaping ───────────────────────────────────────────────────────────────
  private async listItem(c: ClientRow) {
    const [counts, partnerId, outstanding, primary] = await Promise.all([
      this.queries.matterCountsForClient(c.id),
      this.queries.relationshipPartnerId(c.id),
      this.queries.outstandingForClient(c.id),
      this.repo.primaryContact(c.id),
    ]);
    return {
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      email: c.email,
      phone: c.phone,
      city: cityOf(c.address),
      contactName: primary?.name ?? null,
      partner: await this.directory.userName(partnerId),
      openMatters: counts.open,
      totalMatters: counts.total,
      outstanding,
      createdAt: c.createdAt.toISOString(),
    };
  }

  private async detail(c: ClientRow) {
    const [counts, partnerId, outstanding, rollup, documents, _openTasks, primary] =
      await Promise.all([
        this.queries.matterCountsForClient(c.id),
        this.queries.relationshipPartnerId(c.id),
        this.queries.outstandingForClient(c.id),
        this.queries.billingRollupForClient(c.id),
        this.queries.documentCountForClient(c.id),
        this.openTaskCountForClient(c.id),
        this.repo.primaryContact(c.id),
      ]);
    return {
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      email: c.email,
      phone: c.phone,
      taxId: c.taxId,
      address: c.address,
      city: cityOf(c.address),
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      partner: await this.directory.userName(partnerId),
      registration: registrationLabel(c),
      stats: {
        openMatters: counts.open,
        totalMatters: counts.total,
        documents,
        outstanding,
        billedToDate: rollup.billedToDate,
        collected: rollup.collected,
        unbilledHours: 0,
      },
      primaryContact: primary
        ? {
            id: primary.id,
            name: primary.name,
            role: primary.role,
            email: primary.email,
            phone: primary.phone,
            primary: primary.primary,
          }
        : null,
    };
  }

  private async openTaskCountForClient(clientId: string): Promise<number> {
    const matters = await this.repo.mattersForClient(clientId);
    const map = await this.queries.openTaskCountByMatter(matters.map((m) => m.id));
    return [...map.values()].reduce((s, n) => s + n, 0);
  }

  private async assertExists(clientId: string): Promise<void> {
    const client = await readInTenant(() => this.repo.findById(clientId));
    if (!client) throw NotFound("client.not_found", "Client not found.");
  }

  /** exported for reuse in tests */
  static readonly PAGE_SIZE = PAGE_SIZE;
}

export type { Money };
