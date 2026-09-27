import { sql } from "kysely";
import { hotelDb } from "@hotel/hotel/db/executor.js";

let seq = 0;

/**
 * Run `fn` inside a SAVEPOINT of the current transaction. If it throws, only its own statements
 * are rolled back and the error is re-thrown — the surrounding transaction stays usable. This is
 * how allocation tries the next candidate room after losing a race on the exclusion constraint
 * (a failed statement would otherwise abort the whole transaction).
 */
export async function withSavepoint<T>(fn: () => Promise<T>): Promise<T> {
  const name = sql.raw(`hotel_sp_${++seq}`);
  await sql`SAVEPOINT ${name}`.execute(hotelDb());
  try {
    const result = await fn();
    await sql`RELEASE SAVEPOINT ${name}`.execute(hotelDb());
    return result;
  } catch (err) {
    await sql`ROLLBACK TO SAVEPOINT ${name}`.execute(hotelDb());
    throw err;
  }
}
