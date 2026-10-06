import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { getContext } from "@core/kernel/logging/context.js";
import { raqibDb } from "@raqib/raqib/db/executor.js";

/**
 * Human-readable references (VIS-26-0418, CA-26-0118, …): one atomic counter per (kind, year) per
 * organization. The upsert takes a row lock, so concurrent creators get distinct, gap-free-per-commit numbers.
 */
@Injectable()
export class Counters {
  async next(kind: "VIS" | "CA" | "OBS" | "TR" | "ACR" | "RPT" | "CNF", year: number): Promise<string> {
    const orgId = getContext()?.organizationId;
    if (!orgId) throw new Error("counter used outside a tenant context");
    const row = await raqibDb()
      .insertInto("raqib_counters")
      .values({ organization_id: orgId, kind, year, value: 1 })
      .onConflict((oc) => oc.columns(["organization_id", "kind", "year"]).doUpdateSet({ value: sql`raqib_counters.value + 1` }))
      .returning("value")
      .executeTakeFirstOrThrow();
    return `${kind}-${String(year % 100).padStart(2, "0")}-${String(row.value).padStart(4, "0")}`;
  }
}
