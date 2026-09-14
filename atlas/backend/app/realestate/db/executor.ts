import { currentExecutor } from "@core/kernel/db/db.js";
import type { RealestateTables } from "./schema.js";

/**
 * Typed access to Atlas's own tables, layered on top of Core's ambient
 * executor/transaction (`currentExecutor()`). Core's `UNIT_OF_WORK` /
 * `currentExecutor()` are hard-typed to `Kysely<Database>` from
 * `core/kernel/db/schema.ts` (a `type`, not an `interface`, so it can't be
 * augmented from here) — `.withTables<RealestateTables>()` widens the SAME
 * underlying Kysely instance/transaction to also know about Atlas's tables,
 * without touching Core or regenerating its schema file. A write inside
 * `this.uow.transaction(tx => ...)` that calls `realestateDb()` and one that
 * calls `AUDIT_LOGGER.record()` / `EVENT_BUS.publish()` really do share one
 * Postgres transaction.
 */
export function realestateDb() {
  return currentExecutor().withTables<RealestateTables>();
}
