import { AsyncLocalStorage } from "node:async_hooks";
import { Kysely, PostgresDialect, type Transaction } from "kysely";
import { getPool } from "./pool.js";
import type { Database } from "./schema.js";

/**
 * Kysely instance + transaction propagation.
 *
 * Per the architecture (§4, §6.1): the application/use-case layer owns the
 * transaction. It calls `unitOfWork.transaction(...)`, and everything inside
 * that callback — repositories, the event bus, audit writes — automatically
 * runs on the same transaction via `currentExecutor()`. No executor argument
 * is threaded through call signatures; the ambient transaction is carried by
 * AsyncLocalStorage, so the event bus "merely runs inside" the transaction
 * the caller controls.
 */

export type Executor = Kysely<Database> | Transaction<Database>;

let baseDb: Kysely<Database> | undefined;

export function getDb(): Kysely<Database> {
  baseDb ??= new Kysely<Database>({
    dialect: new PostgresDialect({ pool: getPool() }),
  });
  return baseDb;
}

const executorStorage = new AsyncLocalStorage<Transaction<Database>>();

/** The transaction in scope, or the base connection pool if none. */
export function currentExecutor(): Executor {
  return executorStorage.getStore() ?? getDb();
}

/** True when called inside `unitOfWork.transaction(...)`. */
export function inTransaction(): boolean {
  return executorStorage.getStore() !== undefined;
}

export interface UnitOfWork {
  transaction<T>(fn: (tx: Transaction<Database>) => Promise<T>): Promise<T>;
}

export const unitOfWork: UnitOfWork = {
  async transaction(fn) {
    const existing = executorStorage.getStore();
    // Nested calls join the outer transaction rather than opening a new one.
    if (existing) return fn(existing);

    return getDb()
      .transaction()
      .execute((trx) => executorStorage.run(trx, () => fn(trx)));
  },
};

export async function closeDb(): Promise<void> {
  if (baseDb) {
    await baseDb.destroy();
    baseDb = undefined;
  }
}
