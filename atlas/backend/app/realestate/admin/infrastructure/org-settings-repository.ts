import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";

export interface OrgSettingsRow {
  reservationHoldDays: number;
  escalationDays: number;
  defaultDiscountPct: string;
  aiInsightRefreshMinutes: number;
}

@Injectable()
export class OrgSettingsRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async get(): Promise<OrgSettingsRow> {
    const row = await realestateDb()
      .selectFrom("realestate_org_settings")
      .selectAll()
      .where("organization_id", "=", this.org())
      .executeTakeFirst();
    if (row) {
      return {
        reservationHoldDays: row.reservation_hold_days,
        escalationDays: row.escalation_days,
        defaultDiscountPct: row.default_discount_pct,
        aiInsightRefreshMinutes: row.ai_insight_refresh_minutes,
      };
    }
    // Defaults match the table's column defaults; insert lazily on first read.
    await realestateDb().insertInto("realestate_org_settings").values({ organization_id: this.org() }).execute();
    return this.get();
  }

  async update(patch: Partial<{ reservationHoldDays: number; escalationDays: number; defaultDiscountPct: number; aiInsightRefreshMinutes: number }>): Promise<OrgSettingsRow> {
    await this.get(); // ensure a row exists
    const set: Record<string, unknown> = {};
    if (patch.reservationHoldDays !== undefined) set.reservation_hold_days = patch.reservationHoldDays;
    if (patch.escalationDays !== undefined) set.escalation_days = patch.escalationDays;
    if (patch.defaultDiscountPct !== undefined) set.default_discount_pct = String(patch.defaultDiscountPct);
    if (patch.aiInsightRefreshMinutes !== undefined) set.ai_insight_refresh_minutes = patch.aiInsightRefreshMinutes;
    if (Object.keys(set).length > 0) {
      await realestateDb().updateTable("realestate_org_settings").set(set).where("organization_id", "=", this.org()).execute();
    }
    return this.get();
  }
}
