import { currentExecutor } from "@core/kernel/db/db.js";
import type { RaqibTables } from "./schema.js";

/**
 * Typed access to Raqib's own tables, layered on Core's ambient executor/transaction
 * (`currentExecutor()`) — the same mechanism as HotelOS's `hotelDb()` / Atlas's `realestateDb()`.
 * `.withTables<RaqibTables>()` widens the SAME Kysely instance/transaction to also know the Raqib
 * tables, so a write that calls `raqibDb()` and one that calls `AUDIT_LOGGER.record()` /
 * `EVENT_BUS.publish()` inside `uow.transaction(...)` share one Postgres transaction.
 * Repositories are the only callers.
 */
export function raqibDb() {
  return currentExecutor().withTables<RaqibTables>();
}
