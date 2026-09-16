import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";

/**
 * Collections and Outstanding are read-composition aggregates over
 * `realestate_installments` — never stored, per the plan's data-model note
 * (Collections is the one screen whose per-project rows exactly reconcile
 * with their own KPIs, so recomputing is both correct and cheap).
 */
export interface CollectionsFilter {
  projectId?: string;
}

export interface OutstandingFilter {
  agentId?: string;
  projectId?: string;
}

@Injectable()
export class FinanceQueries {
  private org(): string {
    return requireOrganizationId();
  }

  /** Per-project collections rollup: due, collected, overdue, accounts, rate. */
  async collectionsByProject(
    filter: CollectionsFilter = {},
  ): Promise<Array<{ projectId: string; dueEgp: number; collectedEgp: number; overdueEgp: number; accounts: number; collectionRatePct: number }>> {
    let rows = await realestateDb()
      .selectFrom("realestate_installments")
      .innerJoin("realestate_payment_plans", (join) =>
        join
          .onRef("realestate_payment_plans.id", "=", "realestate_installments.payment_plan_id")
          .onRef("realestate_payment_plans.organization_id", "=", "realestate_installments.organization_id"),
      )
      .select([
        "realestate_payment_plans.unit_id as unitId",
        "realestate_payment_plans.customer_id as customerId",
        "realestate_installments.amount_egp as amountEgp",
        "realestate_installments.paid_egp as paidEgp",
        "realestate_installments.status as status",
      ])
      .where("realestate_installments.organization_id", "=", this.org())
      .execute();

    const unitIds = [...new Set(rows.map((r) => r.unitId))];
    const units =
      unitIds.length === 0
        ? []
        : await realestateDb()
            .selectFrom("realestate_units")
            .select(["id", "project_id"])
            .where("organization_id", "=", this.org())
            .where("id", "in", unitIds)
            .execute();
    const unitToProject = new Map(units.map((u) => [u.id, u.project_id]));
    if (filter.projectId) rows = rows.filter((r) => unitToProject.get(r.unitId) === filter.projectId);

    const byProject = new Map<
      string,
      { dueEgp: number; collectedEgp: number; overdueEgp: number; accounts: Set<string> }
    >();
    for (const r of rows) {
      const projectId = unitToProject.get(r.unitId) ?? "unknown";
      const g = byProject.get(projectId) ?? { dueEgp: 0, collectedEgp: 0, overdueEgp: 0, accounts: new Set<string>() };
      g.dueEgp += r.amountEgp;
      g.collectedEgp += r.paidEgp;
      if (r.status === "overdue") g.overdueEgp += r.amountEgp - r.paidEgp;
      g.accounts.add(r.customerId);
      byProject.set(projectId, g);
    }

    return [...byProject.entries()].map(([projectId, g]) => ({
      projectId,
      dueEgp: g.dueEgp,
      collectedEgp: g.collectedEgp,
      overdueEgp: g.overdueEgp,
      accounts: g.accounts.size,
      collectionRatePct: g.dueEgp > 0 ? Math.round((g.collectedEgp / g.dueEgp) * 1000) / 10 : 0,
    }));
  }

  /** Outstanding accounts: customers with an overdue or pending installment past due date.
   *  One row per overdue installment — a customer can have more than one on the
   *  same unit, so `installmentId` (not the customer/unit pair) is what's unique per row. */
  async outstandingAccounts(
    filter: OutstandingFilter = {},
  ): Promise<Array<{ installmentId: string; customerId: string; unitId: string; overdueEgp: number; agingDays: number; dueDate: string }>> {
    const org = this.org();
    const today = new Date();
    let rows = await realestateDb()
      .selectFrom("realestate_installments")
      .innerJoin("realestate_payment_plans", (join) =>
        join
          .onRef("realestate_payment_plans.id", "=", "realestate_installments.payment_plan_id")
          .onRef("realestate_payment_plans.organization_id", "=", "realestate_installments.organization_id"),
      )
      .select([
        "realestate_installments.id as installmentId",
        "realestate_payment_plans.customer_id as customerId",
        "realestate_payment_plans.unit_id as unitId",
        "realestate_installments.amount_egp as amountEgp",
        "realestate_installments.paid_egp as paidEgp",
        "realestate_installments.due_date as dueDate",
        "realestate_installments.status as status",
      ])
      .where("realestate_installments.organization_id", "=", org)
      .where("realestate_installments.status", "in", ["pending", "partial", "overdue"])
      .where("realestate_installments.due_date", "<", today)
      .execute();

    if (filter.projectId) {
      const unitIds = [...new Set(rows.map((r) => r.unitId))];
      const units =
        unitIds.length === 0
          ? []
          : await realestateDb().selectFrom("realestate_units").select(["id", "project_id"]).where("organization_id", "=", org).where("id", "in", unitIds).execute();
      const unitToProject = new Map(units.map((u) => [u.id, u.project_id]));
      rows = rows.filter((r) => unitToProject.get(r.unitId) === filter.projectId);
    }
    if (filter.agentId) {
      const customerIds = [...new Set(rows.map((r) => r.customerId))];
      const customers =
        customerIds.length === 0
          ? []
          : await realestateDb().selectFrom("realestate_customers").select(["id", "agent_id"]).where("organization_id", "=", org).where("id", "in", customerIds).execute();
      const customerToAgent = new Map(customers.map((c) => [c.id, c.agent_id]));
      rows = rows.filter((r) => customerToAgent.get(r.customerId) === filter.agentId);
    }

    return rows.map((r) => {
      const due = new Date(r.dueDate);
      const agingDays = Math.max(0, Math.round((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        installmentId: r.installmentId,
        customerId: r.customerId,
        unitId: r.unitId,
        overdueEgp: r.amountEgp - r.paidEgp,
        agingDays,
        dueDate: due.toISOString().slice(0, 10),
      };
    });
  }
}
