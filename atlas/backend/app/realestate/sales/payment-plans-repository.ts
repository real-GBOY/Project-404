import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";
import type { InstallmentSpec } from "./payment-plan.domain.js";

export type Cadence = "monthly" | "quarterly" | "semi-annual" | "annual";

export interface PaymentPlanRow {
  id: string;
  contractId: string;
  unitId: string;
  customerId: string;
  totalEgp: number;
  downPaymentPct: string;
  installmentCount: number;
  cadence: Cadence;
  startDate: string;
}

export interface InstallmentRow {
  id: string;
  paymentPlanId: string;
  seqNo: number;
  label: string;
  dueDate: string;
  amountEgp: number;
  paidEgp: number;
  status: "pending" | "partial" | "paid" | "overdue";
}

export interface CreatePaymentPlanInput {
  contractId: string;
  unitId: string;
  customerId: string;
  totalEgp: number;
  downPaymentPct: number;
  installmentCount: number;
  cadence: Cadence;
  startDate: string;
}

@Injectable()
export class PaymentPlansRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async findByContract(contractId: string): Promise<PaymentPlanRow | null> {
    const row = await realestateDb()
      .selectFrom("realestate_payment_plans")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("contract_id", "=", contractId)
      .executeTakeFirst();
    return row ? this.toPlanRow(row) : null;
  }

  async findById(id: string): Promise<PaymentPlanRow | null> {
    const row = await realestateDb()
      .selectFrom("realestate_payment_plans")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toPlanRow(row) : null;
  }

  async create(input: CreatePaymentPlanInput): Promise<PaymentPlanRow> {
    const id = realestateId("pln");
    await realestateDb()
      .insertInto("realestate_payment_plans")
      .values({
        id,
        organization_id: this.org(),
        contract_id: input.contractId,
        unit_id: input.unitId,
        customer_id: input.customerId,
        total_egp: input.totalEgp,
        down_payment_pct: String(input.downPaymentPct),
        installment_count: input.installmentCount,
        cadence: input.cadence,
        start_date: input.startDate,
      })
      .execute();
    return (await this.findById(id))!;
  }

  async insertInstallments(paymentPlanId: string, schedule: InstallmentSpec[]): Promise<void> {
    const org = this.org();
    await realestateDb()
      .insertInto("realestate_installments")
      .values(
        schedule.map((s) => ({
          id: realestateId("ins"),
          organization_id: org,
          payment_plan_id: paymentPlanId,
          seq_no: s.seqNo,
          label: s.label,
          due_date: s.dueDate,
          amount_egp: s.amountEgp,
        })),
      )
      .execute();
  }

  async installmentsForPlan(paymentPlanId: string): Promise<InstallmentRow[]> {
    const rows = await realestateDb()
      .selectFrom("realestate_installments")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("payment_plan_id", "=", paymentPlanId)
      .orderBy("seq_no", "asc")
      .execute();
    return rows.map((r) => this.toInstallmentRow(r));
  }

  async listInstallments(status?: InstallmentRow["status"]): Promise<InstallmentRow[]> {
    let q = realestateDb().selectFrom("realestate_installments").selectAll().where("organization_id", "=", this.org());
    if (status) q = q.where("status", "=", status);
    const rows = await q.orderBy("due_date", "asc").execute();
    return rows.map((r) => this.toInstallmentRow(r));
  }

  async findInstallmentById(id: string): Promise<InstallmentRow | null> {
    const row = await realestateDb()
      .selectFrom("realestate_installments")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toInstallmentRow(row) : null;
  }

  async applyPayment(id: string, amountEgp: number): Promise<InstallmentRow | null> {
    const existing = await this.findInstallmentById(id);
    if (!existing) return null;
    const paidEgp = existing.paidEgp + amountEgp;
    const status = paidEgp >= existing.amountEgp ? "paid" : paidEgp > 0 ? "partial" : existing.status;
    await realestateDb()
      .updateTable("realestate_installments")
      .set({ paid_egp: paidEgp, status })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
    return this.findInstallmentById(id);
  }

  private toPlanRow(r: {
    id: string;
    contract_id: string;
    unit_id: string;
    customer_id: string;
    total_egp: number;
    down_payment_pct: string;
    installment_count: number;
    cadence: Cadence;
    start_date: string | Date;
  }): PaymentPlanRow {
    return {
      id: r.id,
      contractId: r.contract_id,
      unitId: r.unit_id,
      customerId: r.customer_id,
      totalEgp: r.total_egp,
      downPaymentPct: r.down_payment_pct,
      installmentCount: r.installment_count,
      cadence: r.cadence,
      startDate: new Date(r.start_date).toISOString().slice(0, 10),
    };
  }

  private toInstallmentRow(r: {
    id: string;
    payment_plan_id: string;
    seq_no: number;
    label: string;
    due_date: string | Date;
    amount_egp: number;
    paid_egp: number;
    status: InstallmentRow["status"];
  }): InstallmentRow {
    return {
      id: r.id,
      paymentPlanId: r.payment_plan_id,
      seqNo: r.seq_no,
      label: r.label,
      dueDate: new Date(r.due_date).toISOString().slice(0, 10),
      amountEgp: r.amount_egp,
      paidEgp: r.paid_egp,
      status: r.status,
    };
  }
}
