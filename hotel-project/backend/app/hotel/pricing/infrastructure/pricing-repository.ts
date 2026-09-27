import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { hotelDb } from "@hotel/hotel/db/executor.js";
import { hotelId } from "@hotel/hotel/shared/ids.js";
import type { IsoDate } from "@hotel/hotel/shared/dates.js";
import { moneyNumber, moneyString } from "@hotel/hotel/shared/money.js";
import type { Discount, RateRule } from "../domain/pricing.js";

export interface RateRuleRecord extends RateRule {
  archivedAt: Date | null;
}

export interface DiscountRecord extends Discount {
  id: string;
  description: string | null;
  archivedAt: Date | null;
}

export type RateRuleInput = Omit<RateRule, "id">;

export interface DiscountInput {
  code: string;
  description: string | null;
  percentOff: number;
  validFrom: IsoDate | null;
  validTo: IsoDate | null;
}

const asDate = (col: string) => sql<string | null>`${sql.ref(col)}::text`;

@Injectable()
export class PricingRepository {
  private org() {
    return requireOrganizationId();
  }

  async rules(includeArchived = false): Promise<RateRuleRecord[]> {
    let q = hotelDb()
      .selectFrom("hotel_rate_rules")
      .where("organization_id", "=", this.org())
      .select([
        "id",
        "name",
        "kind",
        "room_type_id",
        asDate("start_date").as("start_date"),
        asDate("end_date").as("end_date"),
        "days_of_week",
        "adjustment_type",
        "adjustment_value",
        "min_nights",
        "priority",
        "archived_at",
      ]);
    if (!includeArchived) q = q.where("archived_at", "is", null);
    const rows = await q.orderBy("priority", "desc").orderBy("name").execute();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      roomTypeId: r.room_type_id,
      startDate: r.start_date,
      endDate: r.end_date,
      daysOfWeek: r.days_of_week && r.days_of_week.length > 0 ? r.days_of_week : null,
      adjustmentType: r.adjustment_type,
      adjustmentValue: moneyNumber(r.adjustment_value),
      minNights: r.min_nights,
      priority: r.priority,
      archivedAt: r.archived_at,
    }));
  }

  async createRule(input: RateRuleInput): Promise<string> {
    const id = hotelId("rtr");
    await hotelDb()
      .insertInto("hotel_rate_rules")
      .values({
        id,
        organization_id: this.org(),
        name: input.name,
        kind: input.kind,
        room_type_id: input.roomTypeId,
        start_date: input.startDate,
        end_date: input.endDate,
        // NULL = every night (Prisma types scalar lists as non-null; the column is nullable).
        days_of_week: input.daysOfWeek ?? sql<number[]>`NULL`,
        adjustment_type: input.adjustmentType,
        adjustment_value: moneyString(input.adjustmentValue),
        min_nights: input.minNights,
        priority: input.priority,
      })
      .execute();
    return id;
  }

  async archiveRule(id: string, at: Date): Promise<boolean> {
    const res = await hotelDb()
      .updateTable("hotel_rate_rules")
      .set({ archived_at: at })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .where("archived_at", "is", null)
      .executeTakeFirst();
    return Number(res.numUpdatedRows) > 0;
  }

  async discounts(includeArchived = false): Promise<DiscountRecord[]> {
    let q = hotelDb()
      .selectFrom("hotel_discounts")
      .where("organization_id", "=", this.org())
      .select([
        "id",
        "code",
        "description",
        "percent_off",
        asDate("valid_from").as("valid_from"),
        asDate("valid_to").as("valid_to"),
        "archived_at",
      ]);
    if (!includeArchived) q = q.where("archived_at", "is", null);
    const rows = await q.orderBy("code").execute();
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      description: r.description,
      percentOff: Number(r.percent_off),
      validFrom: r.valid_from,
      validTo: r.valid_to,
      archivedAt: r.archived_at,
    }));
  }

  async discountByCode(code: string): Promise<DiscountRecord | null> {
    const all = await this.discounts();
    return all.find((d) => d.code === code.toUpperCase()) ?? null;
  }

  async createDiscount(input: DiscountInput): Promise<string> {
    const id = hotelId("dsc");
    await hotelDb()
      .insertInto("hotel_discounts")
      .values({
        id,
        organization_id: this.org(),
        code: input.code,
        description: input.description,
        percent_off: input.percentOff.toFixed(2),
        valid_from: input.validFrom,
        valid_to: input.validTo,
      })
      .execute();
    return id;
  }

  async archiveDiscount(id: string, at: Date): Promise<boolean> {
    const res = await hotelDb()
      .updateTable("hotel_discounts")
      .set({ archived_at: at })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .where("archived_at", "is", null)
      .executeTakeFirst();
    return Number(res.numUpdatedRows) > 0;
  }
}
