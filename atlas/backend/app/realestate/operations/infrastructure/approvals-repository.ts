import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";

export type ApprovalKind = "discount" | "refund" | "contract" | "commission" | "other";
export type ApprovalStatus = "awaiting-approval" | "escalated" | "approved" | "rejected";

export interface ApprovalRow {
  id: string;
  kind: ApprovalKind;
  subject: string;
  relatedType: string | null;
  relatedId: string | null;
  amountEgp: number | null;
  requestedBy: string;
  stepNo: number;
  stepTotal: number;
  status: ApprovalStatus;
  createdAt: Date;
}

export interface CreateApprovalInput {
  kind: ApprovalKind;
  subject: string;
  relatedType?: string | null;
  relatedId?: string | null;
  amountEgp?: number | null;
  requestedBy: string;
  stepTotal?: number;
}

@Injectable()
export class ApprovalsRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(status?: ApprovalStatus): Promise<ApprovalRow[]> {
    let q = realestateDb().selectFrom("realestate_approvals").selectAll().where("organization_id", "=", this.org());
    if (status) q = q.where("status", "=", status);
    const rows = await q.orderBy("created_at", "desc").execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<ApprovalRow | null> {
    const row = await realestateDb()
      .selectFrom("realestate_approvals")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async create(input: CreateApprovalInput): Promise<ApprovalRow> {
    const id = realestateId("apr");
    await realestateDb()
      .insertInto("realestate_approvals")
      .values({
        id,
        organization_id: this.org(),
        kind: input.kind,
        subject: input.subject,
        related_type: input.relatedType ?? null,
        related_id: input.relatedId ?? null,
        amount_egp: input.amountEgp ?? null,
        requested_by: input.requestedBy,
        step_no: 1,
        step_total: input.stepTotal ?? 1,
      })
      .execute();
    return (await this.findById(id))!;
  }

  async decide(id: string, status: "approved" | "rejected"): Promise<ApprovalRow | null> {
    await realestateDb()
      .updateTable("realestate_approvals")
      .set({ status })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
    return this.findById(id);
  }

  private toRow(r: {
    id: string;
    kind: ApprovalKind;
    subject: string;
    related_type: string | null;
    related_id: string | null;
    amount_egp: number | null;
    requested_by: string;
    step_no: number;
    step_total: number;
    status: ApprovalStatus;
    created_at: Date | string;
  }): ApprovalRow {
    return {
      id: r.id,
      kind: r.kind,
      subject: r.subject,
      relatedType: r.related_type,
      relatedId: r.related_id,
      amountEgp: r.amount_egp,
      requestedBy: r.requested_by,
      stepNo: r.step_no,
      stepTotal: r.step_total,
      status: r.status,
      createdAt: new Date(r.created_at),
    };
  }
}
