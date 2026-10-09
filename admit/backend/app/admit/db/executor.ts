import { currentExecutor } from "@core/kernel/db/db.js";
import type { AdmitTables } from "./schema.js";

/**
 * Typed access to Admit's own tables, layered on top of Core's ambient executor/transaction
 * (`currentExecutor()`) — the same mechanism as Atlas's `realestateDb()`. Core's
 * `currentExecutor()` is typed to `Kysely<Database>` from `core/kernel/db/schema.ts` (a `type`,
 * not an augmentable `interface`), so `.withTables<AdmitTables>()` widens the SAME Kysely
 * instance/transaction to also know the Admit tables. A write inside `uow.transaction(...)`
 * that calls `admitDb()` and one that calls `AUDIT_LOGGER.record()` / `EVENT_BUS.publish()`
 * share one Postgres transaction. Repositories are the only callers.
 */
export function admitDb() {
  return currentExecutor().withTables<AdmitTables>();
}
