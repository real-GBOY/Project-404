import { Injectable } from "@nestjs/common";
import { currentExecutor } from "@core/kernel/db/db.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { lawfirmId } from "@app/lawfirm/shared/ids.js";

export type HearingStatus = "scheduled" | "adjourned" | "decided";

export interface HearingRow {
  id: string;
  matterId: string;
  court: string;
  scheduledAt: Date;
  status: HearingStatus;
  purpose: string;
  outcome: string | null;
}

export interface MatterContext {
  id: string;
  title: string;
  reference: string;
  court: string | null;
  clientId: string;
  clientName: string;
  leadLawyerId: string;
}

@Injectable()
export class HearingsRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(filter: {
    matterId?: string;
    status?: HearingStatus;
    from?: Date;
    to?: Date;
  }): Promise<HearingRow[]> {
    let q = currentExecutor()
      .selectFrom("lawfirm_hearings")
      .selectAll()
      .where("organization_id", "=", this.org());
    if (filter.matterId) q = q.where("matter_id", "=", filter.matterId);
    if (filter.status) q = q.where("status", "=", filter.status);
    if (filter.from) q = q.where("scheduled_at", ">=", filter.from);
    if (filter.to) q = q.where("scheduled_at", "<=", filter.to);
    const rows = await q.orderBy("scheduled_at", "asc").execute();
    return rows.map((r) => this.toRow(r));
  }

  async all(): Promise<HearingRow[]> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_hearings")
      .selectAll()
      .where("organization_id", "=", this.org())
      .execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<HearingRow | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_hearings")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async matterContext(matterId: string): Promise<MatterContext | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_matters")
      .innerJoin("lawfirm_clients", (join) =>
        join
          .onRef("lawfirm_clients.id", "=", "lawfirm_matters.client_id")
          .onRef("lawfirm_clients.organization_id", "=", "lawfirm_matters.organization_id"),
      )
      .select([
        "lawfirm_matters.id as id",
        "lawfirm_matters.title as title",
        "lawfirm_matters.reference as reference",
        "lawfirm_matters.court as court",
        "lawfirm_matters.client_id as clientId",
        "lawfirm_clients.name as clientName",
        "lawfirm_matters.lead_lawyer_id as leadLawyerId",
      ])
      .where("lawfirm_matters.organization_id", "=", this.org())
      .where("lawfirm_matters.id", "=", matterId)
      .executeTakeFirst();
    return row ?? null;
  }

  async create(input: {
    matterId: string;
    court: string;
    scheduledAt: Date;
    purpose: string;
  }): Promise<HearingRow> {
    const id = lawfirmId("hrg");
    await currentExecutor()
      .insertInto("lawfirm_hearings")
      .values({
        id,
        organization_id: this.org(),
        matter_id: input.matterId,
        court: input.court,
        scheduled_at: input.scheduledAt,
        status: "scheduled",
        purpose: input.purpose,
      })
      .execute();
    return (await this.findById(id))!;
  }

  async update(
    id: string,
    patch: Partial<{ court: string; scheduledAt: Date; purpose: string; status: HearingStatus; outcome: string | null }>,
  ): Promise<HearingRow | null> {
    const set: Record<string, unknown> = {};
    if (patch.court !== undefined) set.court = patch.court;
    if (patch.scheduledAt !== undefined) set.scheduled_at = patch.scheduledAt;
    if (patch.purpose !== undefined) set.purpose = patch.purpose;
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.outcome !== undefined) set.outcome = patch.outcome;
    if (Object.keys(set).length > 0) {
      await currentExecutor()
        .updateTable("lawfirm_hearings")
        .set(set)
        .where("organization_id", "=", this.org())
        .where("id", "=", id)
        .execute();
    }
    return this.findById(id);
  }

  private toRow(r: {
    id: string;
    matter_id: string;
    court: string;
    scheduled_at: Date | string;
    status: HearingStatus;
    purpose: string;
    outcome: string | null;
  }): HearingRow {
    return {
      id: r.id,
      matterId: r.matter_id,
      court: r.court,
      scheduledAt: new Date(r.scheduled_at),
      status: r.status,
      purpose: r.purpose,
      outcome: r.outcome,
    };
  }
}
