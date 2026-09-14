import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";

export type ReportType = "collections" | "revenue" | "receivables" | "commissions" | "treasury";
export type ReportSchedule = "manual" | "daily" | "weekly" | "monthly";
export type ReportStatus = "draft" | "active";

export interface FinancialReportRow {
  id: string;
  name: string;
  type: ReportType;
  period: string;
  ownerId: string;
  schedule: ReportSchedule;
  lastRunAt: Date | null;
  status: ReportStatus;
}

export interface CreateFinancialReportInput {
  name: string;
  type: ReportType;
  period: string;
  ownerId: string;
  schedule?: ReportSchedule;
}

@Injectable()
export class FinancialReportsRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(): Promise<FinancialReportRow[]> {
    const rows = await realestateDb()
      .selectFrom("realestate_financial_reports")
      .selectAll()
      .where("organization_id", "=", this.org())
      .orderBy("name", "asc")
      .execute();
    return rows.map((r) => this.toRow(r));
  }

  async create(input: CreateFinancialReportInput): Promise<FinancialReportRow> {
    const id = realestateId("frp");
    await realestateDb()
      .insertInto("realestate_financial_reports")
      .values({
        id,
        organization_id: this.org(),
        name: input.name,
        type: input.type,
        period: input.period,
        owner_id: input.ownerId,
        schedule: input.schedule ?? "manual",
        status: "draft",
      })
      .execute();
    const row = await realestateDb()
      .selectFrom("realestate_financial_reports")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    return this.toRow(row);
  }

  private toRow(r: {
    id: string;
    name: string;
    type: ReportType;
    period: string;
    owner_id: string;
    schedule: ReportSchedule;
    last_run_at: Date | string | null;
    status: ReportStatus;
  }): FinancialReportRow {
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      period: r.period,
      ownerId: r.owner_id,
      schedule: r.schedule,
      lastRunAt: r.last_run_at ? new Date(r.last_run_at) : null,
      status: r.status,
    };
  }
}
