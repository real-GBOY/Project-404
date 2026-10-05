import { AsyncLocalStorage } from "node:async_hooks";
import type { IsoDate } from "./dates.js";

const storage = new AsyncLocalStorage<IsoDate>();

/**
 * Run `fn` with the organization business date ("today") pinned to `date`. `SettingsService.today()`
 * honours it, so every date rule (no past arrivals, no-show only on/after arrival, check-in
 * windows, housekeeping due dates) runs exactly as it would on that day.
 *
 * This exists so the DEMO seeder can produce realistic history — past stays, in-house guests,
 * today's departures — through the real workflows instead of raw inserts, and so tests can walk a
 * stay across several days. It is deliberately not reachable from any HTTP route: requests always
 * run on the real business date.
 */
export function runAsOf<T>(date: IsoDate, fn: () => Promise<T>): Promise<T> {
  return storage.run(date, fn);
}

/** The pinned business date, if the caller is inside `runAsOf`. */
export function pinnedBusinessDate(): IsoDate | undefined {
  return storage.getStore();
}
