import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { admitDb } from "@admit/admit/db/executor.js";
import { admitId } from "@admit/admit/shared/ids.js";
import type { PromoKind } from "../domain/pricing.js";

export interface PromoRecord {
  id: string;
  eventId: string;
  code: string;
  kind: PromoKind;
  value: number;
  maxUses: number | null;
  validFrom: Date | null;
  validUntil: Date | null;
  enabled: boolean;
  createdAt: Date;
}

const toPromo = (r: {
  id: string;
  event_id: string;
  code: string;
  kind: PromoKind;
  value: number;
  max_uses: number | null;
  valid_from: Date | null;
  valid_until: Date | null;
  enabled: boolean;
  created_at: Date;
}): PromoRecord => ({
  id: r.id,
  eventId: r.event_id,
  code: r.code,
  kind: r.kind,
  value: r.value,
  maxUses: r.max_uses,
  validFrom: r.valid_from,
  validUntil: r.valid_until,
  enabled: r.enabled,
  createdAt: r.created_at,
});

/** Bookings that still hold a use of the code: a rejected, expired or cancelled booking gives it back. */
const COUNTED = ["AWAITING_PAYMENT", "IN_REVIEW", "CONFIRMED"] as const;

/** The only code that touches promo codes. */
@Injectable()
export class PromosRepository {
  async listForEvent(eventId: string): Promise<Array<PromoRecord & { usedCount: number }>> {
    const rows = await admitDb().selectFrom("admit_promo_codes").selectAll().where("event_id", "=", eventId).orderBy("created_at", "desc").execute();
    if (!rows.length) return [];
    const counts = await admitDb()
      .selectFrom("admit_bookings")
      .select(["promo_code_id", sql<string>`count(*)`.as("n")])
      .where(
        "promo_code_id",
        "in",
        rows.map((r) => r.id),
      )
      .where("status", "in", [...COUNTED])
      .groupBy("promo_code_id")
      .execute();
    const used = new Map(counts.map((c) => [c.promo_code_id as string, Number(c.n)]));
    return rows.map((r) => ({ ...toPromo(r), usedCount: used.get(r.id) ?? 0 }));
  }

  async find(id: string): Promise<PromoRecord | undefined> {
    const r = await admitDb().selectFrom("admit_promo_codes").selectAll().where("id", "=", id).executeTakeFirst();
    return r && toPromo(r);
  }

  async findByCode(eventId: string, code: string): Promise<PromoRecord | undefined> {
    const r = await admitDb().selectFrom("admit_promo_codes").selectAll().where("event_id", "=", eventId).where("code", "=", code).executeTakeFirst();
    return r && toPromo(r);
  }

  /** Row lock: two guests redeeming the last use of a code at the same moment are serialized here. */
  async lockByCode(eventId: string, code: string): Promise<PromoRecord | undefined> {
    const r = await admitDb()
      .selectFrom("admit_promo_codes")
      .selectAll()
      .where("event_id", "=", eventId)
      .where("code", "=", code)
      .forUpdate()
      .executeTakeFirst();
    return r && toPromo(r);
  }

  async usedCount(id: string): Promise<number> {
    const r = await admitDb()
      .selectFrom("admit_bookings")
      .select(sql<string>`count(*)`.as("n"))
      .where("promo_code_id", "=", id)
      .where("status", "in", [...COUNTED])
      .executeTakeFirstOrThrow();
    return Number(r.n);
  }

  async insert(eventId: string, p: Omit<PromoRecord, "id" | "eventId" | "createdAt">): Promise<string> {
    const id = admitId("prm");
    await admitDb()
      .insertInto("admit_promo_codes")
      .values({
        id,
        organization_id: requireOrganizationId(),
        event_id: eventId,
        code: p.code,
        kind: p.kind,
        value: p.value,
        max_uses: p.maxUses,
        valid_from: p.validFrom,
        valid_until: p.validUntil,
        enabled: p.enabled,
      })
      .execute();
    return id;
  }

  async update(id: string, p: Partial<Pick<PromoRecord, "kind" | "value" | "maxUses" | "validFrom" | "validUntil" | "enabled">>): Promise<void> {
    await admitDb()
      .updateTable("admit_promo_codes")
      .set({
        ...(p.kind !== undefined && { kind: p.kind }),
        ...(p.value !== undefined && { value: p.value }),
        ...(p.maxUses !== undefined && { max_uses: p.maxUses }),
        ...(p.validFrom !== undefined && { valid_from: p.validFrom }),
        ...(p.validUntil !== undefined && { valid_until: p.validUntil }),
        ...(p.enabled !== undefined && { enabled: p.enabled }),
      })
      .where("id", "=", id)
      .execute();
  }

  async remove(id: string): Promise<void> {
    await admitDb().deleteFrom("admit_promo_codes").where("id", "=", id).execute();
  }
}
