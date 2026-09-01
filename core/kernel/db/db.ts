import { AsyncLocalStorage } from "node:async_hooks";
import { Kysely, PostgresDialect, sql, type Transaction } from "kysely";
import { getPool, type PoolKind } from "./pool.js";
import { getContext } from "../logging/context.js";
import type { Database } from "./schema.js";

/**
 * Kysely instances + transaction propagation + per-transaction tenant scoping.
 *
 * Per the architecture (§4, §6.1): the application/use-case layer owns the
 * transaction. It calls `unitOfWork.transaction(...)`, and everything inside
 * that callback — repositories, the event bus, audit writes — automatically
 * runs on the same transaction via `currentExecutor()`. No executor argument
 * is threaded through call signatures; the ambient transaction is carried by
 * AsyncLocalStorage.
 *
 * Multi-tenancy (§ docs/tenancy.md): two connections. Normal work runs on
 * `auric_app` (RLS-enforced); `ctx.system` work runs on `auric_system`
 * (BYPASSRLS). When a transaction opens on the app connection and the request
 * context carries a tenant, `unitOfWork.transaction` pushes it into Postgres as
 * `SET LOCAL app.organization_id` / `app.user_id`, so RLS policies filter every
 * tenant-scoped table. `SET LOCAL` is transaction-scoped — it cannot leak to
 * the next pool checkout, which is also why pgBouncer transaction pooling is
 * safe.
 */

export type Executor = Kysely<Database> | Transaction<Database>;

const instances = new Map<PoolKind, Kysely<Database>>();

export function getDb(kind: PoolKind = "app"): Kysely<Database> {
  let db = instances.get(kind);
  if (!db) {
    db = new Kysely<Database>({ dialect: new PostgresDialect({ pool: getPool(kind) }) });
    instances.set(kind, db);
  }
  return db;
}

/** The connection role the current context should use. */
function currentKind(): PoolKind {
  return getContext()?.system ? "system" : "app";
}

const executorStorage = new AsyncLocalStorage<Transaction<Database>>();

/** The transaction in scope, or the base connection for the current context. */
export function currentExecutor(): Executor {
  return executorStorage.getStore() ?? getDb(currentKind());
}

/** True when called inside `unitOfWork.transaction(...)`. */
export function inTransaction(): boolean {
  return executorStorage.getStore() !== undefined;
}

export interface UnitOfWork {
  transaction<T>(fn: (tx: Transaction<Database>) => Promise<T>): Promise<T>;
}

async function applyTenantScope(trx: Transaction<Database>): Promise<void> {
  const ctx = getContext();
  if (!ctx || ctx.system) return; // system connection bypasses RLS by design
  // Set whatever the context knows. A missing tenant is not an error here:
  // RLS then returns no rows / rejects writes, which is the safe default. Code
  // paths that must name the tenant call `ITenantContext.organizationId()`.
  await sql`select
    set_config('app.organization_id', ${ctx.organizationId ?? ""}, true),
    set_config('app.user_id', ${ctx.userId ?? ""}, true)`.execute(trx);
}

export const unitOfWork: UnitOfWork = {
  async transaction(fn) {
    const existing = executorStorage.getStore();
    // Nested calls join the outer transaction rather than opening a new one.
    if (existing) return fn(existing);

    return getDb(currentKind())
      .transaction()
      .execute(async (trx) => {
        await applyTenantScope(trx);
        return executorStorage.run(trx, () => fn(trx));
      });
  },
};

/**
 * Run a single tenant-scoped read inside a transaction, so `unitOfWork` gets a
 * chance to `SET LOCAL app.organization_id` before the query. Reads that reach
 * the raw pool (no transaction) see nothing under RLS — this is the fix the
 * design calls for. Nests into an outer transaction when there is one.
 */
export function readInTenant<T>(fn: () => Promise<T>): Promise<T> {
  return unitOfWork.transaction(() => fn());
}

export async function closeDb(): Promise<void> {
  const open = [...instances.values()];
  instances.clear();
  await Promise.all(open.map((db) => db.destroy()));
}
