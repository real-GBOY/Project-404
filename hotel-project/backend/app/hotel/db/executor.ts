import { currentExecutor } from "@core/kernel/db/db.js";
import type { HotelTables } from "./schema.js";

/**
 * Typed access to HotelOS's own tables, layered on top of Core's ambient executor/transaction
 * (`currentExecutor()`) — the same mechanism as Atlas's `realestateDb()`. Core's
 * `currentExecutor()` is typed to `Kysely<Database>` from `core/kernel/db/schema.ts` (a `type`,
 * not an augmentable `interface`), so `.withTables<HotelTables>()` widens the SAME Kysely
 * instance/transaction to also know the hotel tables. A write inside `uow.transaction(...)`
 * that calls `hotelDb()` and one that calls `AUDIT_LOGGER.record()` / `EVENT_BUS.publish()`
 * share one Postgres transaction. Repositories are the only callers.
 */
export function hotelDb() {
  return currentExecutor().withTables<HotelTables>();
}
