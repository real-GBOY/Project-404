import { Injectable } from "@nestjs/common";
import { currentExecutor } from "@core/kernel/db/db.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { lawfirmId } from "@app/lawfirm/shared/ids.js";

export type EventKind = "meeting" | "reminder" | "court_filing" | "other";

export interface CalendarEventRow {
  id: string;
  title: string;
  kind: EventKind;
  startAt: Date;
  endAt: Date | null;
  matterId: string | null;
  ownerId: string;
}

@Injectable()
export class CalendarRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async events(): Promise<CalendarEventRow[]> {
    const rows = await currentExecutor()
      .selectFrom("lawfirm_calendar_events")
      .selectAll()
      .where("organization_id", "=", this.org())
      .execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<CalendarEventRow | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_calendar_events")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async create(input: {
    title: string;
    kind: EventKind;
    startAt: Date;
    endAt: Date | null;
    matterId: string | null;
    ownerId: string;
  }): Promise<CalendarEventRow> {
    const id = lawfirmId("cal");
    await currentExecutor()
      .insertInto("lawfirm_calendar_events")
      .values({
        id,
        organization_id: this.org(),
        title: input.title,
        kind: input.kind,
        start_at: input.startAt,
        end_at: input.endAt,
        matter_id: input.matterId,
        owner_id: input.ownerId,
      })
      .execute();
    return (await this.findById(id))!;
  }

  async update(
    id: string,
    patch: Partial<{ title: string; kind: EventKind; startAt: Date; endAt: Date | null }>,
  ): Promise<CalendarEventRow | null> {
    const set: Record<string, unknown> = {};
    if (patch.title !== undefined) set.title = patch.title;
    if (patch.kind !== undefined) set.kind = patch.kind;
    if (patch.startAt !== undefined) set.start_at = patch.startAt;
    if (patch.endAt !== undefined) set.end_at = patch.endAt;
    if (Object.keys(set).length > 0) {
      await currentExecutor()
        .updateTable("lawfirm_calendar_events")
        .set(set)
        .where("organization_id", "=", this.org())
        .where("id", "=", id)
        .execute();
    }
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await currentExecutor()
      .deleteFrom("lawfirm_calendar_events")
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
  }

  private toRow(r: {
    id: string;
    title: string;
    kind: EventKind;
    start_at: Date | string;
    end_at: Date | string | null;
    matter_id: string | null;
    owner_id: string;
  }): CalendarEventRow {
    return {
      id: r.id,
      title: r.title,
      kind: r.kind,
      startAt: new Date(r.start_at),
      endAt: r.end_at ? new Date(r.end_at) : null,
      matterId: r.matter_id,
      ownerId: r.owner_id,
    };
  }
}
