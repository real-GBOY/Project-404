import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";

export type PaymentMethod = "bank-transfer" | "cheque" | "cash" | "card";
export type PaymentStatus = "paid" | "pending" | "overdue";

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

  async list(customerId?: string): Promise<PaymentRow[]> {
    let q = realestateDb().selectFrom("realestate_payments").selectAll().where("organization_id", "=", this.org());
    if (customerId) q = q.where("customer_id", "=", customerId);
    const rows = await q.orderBy("paid_at", "desc").execute();
    return rows.map((r) => this.toRow(r));
  }

  async create(input: CreatePaymentInput): Promise<PaymentRow> {
    const id = realestateId("pay");
    const org = this.org();
    const reference = `PM-${Math.floor(10000 + Math.random() * 90000)}`;
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
