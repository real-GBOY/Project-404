import { Injectable } from "@nestjs/common";
import { currentExecutor } from "@core/kernel/db/db.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { lawfirmId } from "@app/lawfirm/shared/ids.js";
import { decimal } from "@app/lawfirm/shared/money.js";

export type TimeEntryStatus = "unbilled" | "billed";
export type TimeEntryCurrency = "EGP" | "AED" | "USD" | "SAR";

export interface TimeEntryRow {
  id: string;
  matterId: string;
  userId: string;
  activity: string;
  narrative: string | null;
  minutes: number;
  billable: boolean;
  hourlyRate: number | null;
  currency: TimeEntryCurrency;
  status: TimeEntryStatus;
  loggedAt: Date;
  createdAt: Date;
}

@Injectable()
export class TimeRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(filter: {
    userId?: string;
    matterId?: string;
    status?: TimeEntryStatus;
  }): Promise<TimeEntryRow[]> {
    let q = currentExecutor()
      .selectFrom("lawfirm_time_entries")
      .selectAll()
      .where("organization_id", "=", this.org());
    if (filter.userId) q = q.where("user_id", "=", filter.userId);
    if (filter.matterId) q = q.where("matter_id", "=", filter.matterId);
    if (filter.status) q = q.where("status", "=", filter.status);
    const rows = await q.orderBy("logged_at", "desc").execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<TimeEntryRow | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_time_entries")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async create(input: {
    matterId: string;
    userId: string;
    activity: string;
    narrative: string | null;
    minutes: number;
    billable: boolean;
    hourlyRate: number | null;
    currency: TimeEntryCurrency;
    loggedAt: Date;
  }): Promise<TimeEntryRow> {
    const id = lawfirmId("tme");
    await currentExecutor()
      .insertInto("lawfirm_time_entries")
      .values({
        id,
        organization_id: this.org(),
        matter_id: input.matterId,
        user_id: input.userId,
        activity: input.activity,
        narrative: input.narrative,
        minutes: input.minutes,
        billable: input.billable,
        hourly_rate: input.hourlyRate === null ? null : String(input.hourlyRate),
        currency: input.currency,
        status: "unbilled",
        logged_at: input.loggedAt,
      })
      .execute();
    return (await this.findById(id))!;
  }

  async update(
    id: string,
    patch: Partial<{
      activity: string;
      narrative: string | null;
      minutes: number;
      billable: boolean;
      loggedAt: Date;
    }>,
  ): Promise<TimeEntryRow | null> {
    const set: Record<string, unknown> = {};
    if (patch.activity !== undefined) set.activity = patch.activity;
    if (patch.narrative !== undefined) set.narrative = patch.narrative;
    if (patch.minutes !== undefined) set.minutes = patch.minutes;
    if (patch.billable !== undefined) set.billable = patch.billable;
    if (patch.loggedAt !== undefined) set.logged_at = patch.loggedAt;
    if (Object.keys(set).length > 0) {
      await currentExecutor()
        .updateTable("lawfirm_time_entries")
        .set(set)
        .where("organization_id", "=", this.org())
        .where("id", "=", id)
        .execute();
    }
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await currentExecutor()
      .deleteFrom("lawfirm_time_entries")
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
  }

  async matterContext(matterId: string): Promise<{ title: string; reference: string } | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_matters")
      .select(["title", "reference"])
      .where("organization_id", "=", this.org())
      .where("id", "=", matterId)
      .executeTakeFirst();
    return row ?? null;
  }

  private toRow(r: {
    id: string;
    matter_id: string;
    user_id: string;
    activity: string;
    narrative: string | null;
    minutes: number;
    billable: boolean;
    hourly_rate: string | null;
    currency: TimeEntryCurrency;
    status: TimeEntryStatus;
    logged_at: Date | string;
    created_at: Date | string;
  }): TimeEntryRow {
    return {
      id: r.id,
      matterId: r.matter_id,
      userId: r.user_id,
      activity: r.activity,
      narrative: r.narrative,
      minutes: r.minutes,
      billable: r.billable,
      hourlyRate: r.hourly_rate === null ? null : decimal(r.hourly_rate),
      currency: r.currency,
      status: r.status,
      loggedAt: new Date(r.logged_at),
      createdAt: new Date(r.created_at),
    };
  }
}
