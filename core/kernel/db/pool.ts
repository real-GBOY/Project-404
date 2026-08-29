import pg from "pg";
import { getConfig } from "../config.js";

/**
 * The single pg connection pool for the process. Everything DB goes through
 * Kysely (db.ts); this module just owns the pool lifecycle.
 */

// pg returns BIGINT / NUMERIC as strings by default to avoid precision loss.
// Our schema keeps counters and sizes within the safe integer range, so parse
// int8 to number for ergonomics. NUMERIC (1700) is deliberately left as string.
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: getConfig().databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
