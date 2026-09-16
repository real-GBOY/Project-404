import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";
import { combinedRelevance } from "@atlas/realestate/shared/search.js";

export type PaymentMethod = "bank-transfer" | "cheque" | "cash" | "card";
export type PaymentStatus = "paid" | "pending" | "overdue";

export interface PaymentFilter {
  method?: PaymentMethod;
  status?: PaymentStatus;
  customerId?: string;
  /** Free-text search across reference / customer name, ranked by relevance. */
  q?: string;
}

export interface PaymentRow {
  id: string;
  reference: string;
  customerId: string;
  unitId: string;
  installmentId: string | null;
  amountEgp: number;
  method: PaymentMethod;
  paidAt: Date;
  status: PaymentStatus;
}

export interface CreatePaymentInput {
  customerId: string;
  unitId: string;
  installmentId?: string | null;
  amountEgp: number;
  method: PaymentMethod;
}

@Injectable()
export class PaymentsRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(filter: PaymentFilter = {}): Promise<PaymentRow[]> {
    let q = realestateDb()
      .selectFrom("realestate_payments")
      .selectAll("realestate_payments")
      .where("realestate_payments.organization_id", "=", this.org());
    if (filter.customerId) q = q.where("realestate_payments.customer_id", "=", filter.customerId);
    if (filter.method) q = q.where("realestate_payments.method", "=", filter.method);
    if (filter.status) q = q.where("realestate_payments.status", "=", filter.status);

    const term = filter.q?.trim();
    if (term) {
      const joined = q.innerJoin("realestate_customers", (join) =>
        join
          .onRef("realestate_customers.id", "=", "realestate_payments.customer_id")
          .onRef("realestate_customers.organization_id", "=", "realestate_payments.organization_id"),
      );
      const score = combinedRelevance([{ column: "realestate_payments.reference" }, { column: "realestate_customers.name", weight: 0.8 }], term);
      const rows = await joined
        .select(score.as("relevance_score"))
        .where(score, ">", 0)
        .orderBy("relevance_score", "desc")
        .orderBy("realestate_payments.paid_at", "desc")
        .execute();
      return rows.map((r) => this.toRow(r));
    }

    const rows = await q.orderBy("realestate_payments.paid_at", "desc").execute();
    return rows.map((r) => this.toRow(r));
  }

  async create(input: CreatePaymentInput): Promise<PaymentRow> {
    const id = realestateId("pay");
    const org = this.org();

    // `reference` is a short human-readable code, not a globally-unique id —
    // draw from a 5-digit space, but retry on the rare collision (the
    // per-org unique constraint) rather than let it surface as a 500.
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const reference = `PM-${Math.floor(10000 + Math.random() * 90000)}`;
      try {
        await realestateDb()
          .insertInto("realestate_payments")
          .values({
            id,
            organization_id: org,
            reference,
            customer_id: input.customerId,
            unit_id: input.unitId,
            installment_id: input.installmentId ?? null,
            amount_egp: input.amountEgp,
            method: input.method,
            status: "paid",
          })
          .execute();
        break;
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code === "23505" && attempt < maxAttempts) continue;
        throw err;
      }
    }

    const row = await realestateDb()
      .selectFrom("realestate_payments")
      .selectAll()
      .where("organization_id", "=", org)
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    return this.toRow(row);
  }

  private toRow(r: {
    id: string;
    reference: string;
    customer_id: string;
    unit_id: string;
    installment_id: string | null;
    amount_egp: number;
    method: PaymentMethod;
    paid_at: Date | string;
    status: PaymentStatus;
  }): PaymentRow {
    return {
      id: r.id,
      reference: r.reference,
      customerId: r.customer_id,
      unitId: r.unit_id,
      installmentId: r.installment_id,
      amountEgp: r.amount_egp,
      method: r.method,
      paidAt: new Date(r.paid_at),
      status: r.status,
    };
  }
}
