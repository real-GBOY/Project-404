import { Injectable } from "@nestjs/common";
import { currentExecutor } from "@core/kernel/db/db.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { decimal, moneyList, type Money } from "./money.js";

/**
 * Cross-entity read helpers shared by Clients, Matters and the Dashboard —
 * invoice totals, per-client / per-matter money roll-ups, child-row counts.
 * All queries are RLS-scoped to the active tenant. Feature repositories still
 * own their own primary reads and every write; this is only the aggregate glue
 * that would otherwise force circular module dependencies.
 */
@Injectable()
export class LawfirmQueries {
  private org(): string {
    return requireOrganizationId();
  }

  /** Server-authoritative invoice totals (README §6), keyed by invoice id. */
  async invoiceTotals(
    invoiceIds?: string[],
  ): Promise<Map<string, { fees: number; disbursements: number; vat: number; total: number; paid: number; balance: number }>> {
    const ex = currentExecutor();
    let invQ = ex
      .selectFrom("lawfirm_invoices")
      .select(["id", "vat_rate", "currency"])
      .where("organization_id", "=", this.org());
    if (invoiceIds) {
      if (invoiceIds.length === 0) return new Map();
      invQ = invQ.where("id", "in", invoiceIds);
    }
    const invoices = await invQ.execute();
    const ids = invoices.map((i) => i.id);
    if (ids.length === 0) return new Map();

    const lines = await ex
      .selectFrom("lawfirm_invoice_lines")
      .select(["invoice_id", "kind", "amount"])
      .where("organization_id", "=", this.org())
      .where("invoice_id", "in", ids)
      .execute();
    const payments = await ex
      .selectFrom("lawfirm_payments")
      .select(["invoice_id", "amount"])
      .where("organization_id", "=", this.org())
      .where("invoice_id", "in", ids)
      .execute();

    const out = new Map<
      string,
      { fees: number; disbursements: number; vat: number; total: number; paid: number; balance: number }
    >();
    for (const inv of invoices) {
      const myLines = lines.filter((l) => l.invoice_id === inv.id);
      const fees = myLines.filter((l) => l.kind === "fee").reduce((s, l) => s + decimal(l.amount), 0);
      const disbursements = myLines
        .filter((l) => l.kind === "disbursement")
        .reduce((s, l) => s + decimal(l.amount), 0);
      const vat = Math.round(fees * decimal(inv.vat_rate));
      const total = fees + disbursements + vat;
      const paid = payments
        .filter((p) => p.invoice_id === inv.id)
        .reduce((s, p) => s + decimal(p.amount), 0);
      out.set(inv.id, { fees, disbursements, vat, total, paid, balance: total - paid });
    }
    return out;
  }

  /** Outstanding balance per currency for a client (sent | issued invoices). */
  async outstandingForClient(clientId: string): Promise<Money[]> {
    const invoices = await currentExecutor()
      .selectFrom("lawfirm_invoices")
      .select(["id", "currency", "status"])
      .where("organization_id", "=", this.org())
      .where("client_id", "=", clientId)
      .where("status", "in", ["sent", "issued"])
      .execute();
    const totals = await this.invoiceTotals(invoices.map((i) => i.id));
    return moneyList(
      invoices
        .map((i) => ({ currency: i.currency, amount: totals.get(i.id)?.balance ?? 0 }))
        .filter((e) => e.amount > 0),
    );
  }

  async matterCountsForClient(clientId: string): Promise<{ open: number; total: number }> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_matters")
      .select(["status"])
      .where("organization_id", "=", this.org())
      .where("client_id", "=", clientId)
      .execute();
    return { open: rows.filter((r) => r.status !== "closed").length, total: rows.length };
  }

  async childCountsForMatter(matterId: string): Promise<{
    hearings: number;
    tasks: number;
    openTasks: number;
    documents: number;
    notes: number;
  }> {
    const ex = currentExecutor();
    const org = this.org();
    const count = async (table: "lawfirm_hearings" | "lawfirm_documents" | "lawfirm_matter_notes") => {
      const r = await ex
        .selectFrom(table)
        .select((eb) => eb.fn.countAll<string>().as("c"))
        .where("organization_id", "=", org)
        .where("matter_id", "=", matterId)
        .executeTakeFirst();
      return Number(r?.c ?? 0);
    };
    const tasks = await ex
      .selectFrom("lawfirm_tasks")
      .select(["status"])
      .where("organization_id", "=", org)
      .where("matter_id", "=", matterId)
      .execute();
    return {
      hearings: await count("lawfirm_hearings"),
      tasks: tasks.length,
      openTasks: tasks.filter((t) => t.status !== "done").length,
      documents: await count("lawfirm_documents"),
      notes: await count("lawfirm_matter_notes"),
    };
  }

  /** `[{ currency, amount }]` sums over invoice `total` / `paid` / `balance`. */
  async billingRollupForClient(clientId: string): Promise<{
    billedToDate: Money[];
    collected: Money[];
  }> {
    const invoices = await currentExecutor()
      .selectFrom("lawfirm_invoices")
      .select(["id", "currency", "status"])
      .where("organization_id", "=", this.org())
      .where("client_id", "=", clientId)
      .execute();
    const totals = await this.invoiceTotals(invoices.map((i) => i.id));
    const billed = invoices
      .filter((i) => i.status !== "draft" && i.status !== "void")
      .map((i) => ({ currency: i.currency, amount: totals.get(i.id)?.total ?? 0 }));
    const collected = invoices.map((i) => ({
      currency: i.currency,
      amount: totals.get(i.id)?.paid ?? 0,
    }));
    return { billedToDate: moneyList(billed), collected: moneyList(collected) };
  }

  async documentCountForClient(clientId: string): Promise<number> {
    const r = await currentExecutor()
      .selectFrom("lawfirm_documents")
      .innerJoin("lawfirm_matters", (join) =>
        join
          .onRef("lawfirm_matters.id", "=", "lawfirm_documents.matter_id")
          .onRef("lawfirm_matters.organization_id", "=", "lawfirm_documents.organization_id"),
      )
      .select((eb) => eb.fn.countAll<string>().as("c"))
      .where("lawfirm_documents.organization_id", "=", this.org())
      .where("lawfirm_matters.client_id", "=", clientId)
      .executeTakeFirst();
    return Number(r?.c ?? 0);
  }

  /** Earliest still-scheduled hearing at or after `now`, per matter id. */
  async nextHearingByMatter(matterIds: string[], now: Date): Promise<Map<string, Date>> {
    if (matterIds.length === 0) return new Map();
    const rows = await currentExecutor()
      .selectFrom("lawfirm_hearings")
      .select(["matter_id", "scheduled_at"])
      .where("organization_id", "=", this.org())
      .where("matter_id", "in", matterIds)
      .where("status", "=", "scheduled")
      .where("scheduled_at", ">=", now)
      .orderBy("scheduled_at", "asc")
      .execute();
    const out = new Map<string, Date>();
    for (const r of rows) {
      if (!out.has(r.matter_id)) out.set(r.matter_id, new Date(r.scheduled_at));
    }
    return out;
  }

  async openTaskCountByMatter(matterIds: string[]): Promise<Map<string, number>> {
    if (matterIds.length === 0) return new Map();
    const rows = await currentExecutor()
      .selectFrom("lawfirm_tasks")
      .select(["matter_id", "status"])
      .where("organization_id", "=", this.org())
      .where("matter_id", "in", matterIds)
      .execute();
    const out = new Map<string, number>();
    for (const r of rows) {
      if (!r.matter_id || r.status === "done") continue;
      out.set(r.matter_id, (out.get(r.matter_id) ?? 0) + 1);
    }
    return out;
  }

  /** Real workload numbers for a staff member (README decision: derive what we can). */
  async workloadForUser(
    userId: string,
    now: Date,
  ): Promise<{ activeMatters: number; openTasks: number; upcomingHearings: number }> {
    const ex = currentExecutor();
    const org = this.org();

    const leadMatters = await ex
      .selectFrom("lawfirm_matters")
      .select(["id"])
      .where("organization_id", "=", org)
      .where("lead_lawyer_id", "=", userId)
      .where("status", "!=", "closed")
      .execute();
    const participantMatters = await ex
      .selectFrom("lawfirm_matter_participants")
      .innerJoin("lawfirm_matters", (join) =>
        join
          .onRef("lawfirm_matters.id", "=", "lawfirm_matter_participants.matter_id")
          .onRef("lawfirm_matters.organization_id", "=", "lawfirm_matter_participants.organization_id"),
      )
      .select(["lawfirm_matters.id as id"])
      .where("lawfirm_matter_participants.organization_id", "=", org)
      .where("lawfirm_matter_participants.user_id", "=", userId)
      .where("lawfirm_matters.status", "!=", "closed")
      .execute();

    const openTasksRow = await ex
      .selectFrom("lawfirm_tasks")
      .select((eb) => eb.fn.countAll<string>().as("c"))
      .where("organization_id", "=", org)
      .where("assignee_id", "=", userId)
      .where("status", "!=", "done")
      .executeTakeFirst();

    const upcomingRow = await ex
      .selectFrom("lawfirm_hearings")
      .innerJoin("lawfirm_matters", (join) =>
        join
          .onRef("lawfirm_matters.id", "=", "lawfirm_hearings.matter_id")
          .onRef("lawfirm_matters.organization_id", "=", "lawfirm_hearings.organization_id"),
      )
      .select((eb) => eb.fn.countAll<string>().as("c"))
      .where("lawfirm_hearings.organization_id", "=", org)
      .where("lawfirm_matters.lead_lawyer_id", "=", userId)
      .where("lawfirm_hearings.status", "=", "scheduled")
      .where("lawfirm_hearings.scheduled_at", ">=", now)
      .executeTakeFirst();

    const matterIds = new Set([...leadMatters, ...participantMatters].map((m) => m.id));
    return {
      activeMatters: matterIds.size,
      openTasks: Number(openTasksRow?.c ?? 0),
      upcomingHearings: Number(upcomingRow?.c ?? 0),
    };
  }

  async mattersForUser(userId: string): Promise<Array<{ id: string; reference: string; title: string; isLead: boolean }>> {
    const ex = currentExecutor();
    const org = this.org();
    const rows = await ex
      .selectFrom("lawfirm_matters")
      .leftJoin("lawfirm_matter_participants", (join) =>
        join
          .onRef("lawfirm_matter_participants.matter_id", "=", "lawfirm_matters.id")
          .onRef("lawfirm_matter_participants.organization_id", "=", "lawfirm_matters.organization_id")
          .on("lawfirm_matter_participants.user_id", "=", userId),
      )
      .select([
        "lawfirm_matters.id as id",
        "lawfirm_matters.reference as reference",
        "lawfirm_matters.title as title",
        "lawfirm_matters.lead_lawyer_id as leadLawyerId",
        "lawfirm_matter_participants.user_id as participantUserId",
      ])
      .where("lawfirm_matters.organization_id", "=", org)
      .where("lawfirm_matters.status", "!=", "closed")
      .where((eb) =>
        eb.or([eb("lawfirm_matters.lead_lawyer_id", "=", userId), eb("lawfirm_matter_participants.user_id", "=", userId)]),
      )
      .execute();
    const seen = new Map<string, { id: string; reference: string; title: string; isLead: boolean }>();
    for (const r of rows) {
      if (!seen.has(r.id)) {
        seen.set(r.id, { id: r.id, reference: r.reference, title: r.title, isLead: r.leadLawyerId === userId });
      }
    }
    return [...seen.values()];
  }

  /** Active staff-profile user ids (for form pickers). */
  async activeStaffIds(): Promise<string[]> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_staff_profiles")
      .select(["user_id"])
      .where("organization_id", "=", this.org())
      .where("status", "=", "active")
      .execute();
    return rows.map((r) => r.user_id);
  }

  /** Lead lawyer (by matter count) for a client, as a user id. */
  async relationshipPartnerId(clientId: string): Promise<string | null> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_matters")
      .select(["lead_lawyer_id"])
      .where("organization_id", "=", this.org())
      .where("client_id", "=", clientId)
      .execute();
    if (rows.length === 0) return null;
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.lead_lawyer_id, (counts.get(r.lead_lawyer_id) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
}
