import pg from "pg";
import { getConfig } from "../config.js";

/**
 * Connection pools for the process. Everything DB goes through Kysely (db.ts);
 * this module just owns pool lifecycle.
 *
 * Two roles (§ docs/tenancy.md):
 *   - "app"    → `auric_app`: no BYPASSRLS. Every tenant-scoped query is
 *                filtered by row-level security. The default for all request
 *                work.
 *   - "system" → `auric_system`: BYPASSRLS. Signup, provider webhooks, and the
 *                outbox worker, which legitimately cross or precede tenants.
 *
 * Both fall back to the owner URL when their env var is unset, so a
 * single-role dev/test database still works (RLS simply isn't exercised).
 */

// pg returns BIGINT / NUMERIC as strings by default to avoid precision loss.
// Our schema keeps counters and sizes within the safe integer range, so parse
// int8 to number for ergonomics. NUMERIC (1700) is deliberately left as string.
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

export type PoolKind = "app" | "system";

const pools = new Map<PoolKind, pg.Pool>();

function connectionStringFor(kind: PoolKind): string {
  const cfg = getConfig();
  const url = kind === "system" ? cfg.systemDatabaseUrl : cfg.appDatabaseUrl;
  return url ?? cfg.databaseUrl;
}

export function getPool(kind: PoolKind = "app"): pg.Pool {
  let pool = pools.get(kind);
  if (!pool) {
    pool = new pg.Pool({
      connectionString: connectionStringFor(kind),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    pools.set(kind, pool);
  }
  return pool;
}

export async function closePool(): Promise<void> {
  const open = [...pools.values()];
  pools.clear();
  await Promise.all(open.map((p) => p.end()));
}
