/**
 * Time as an injected dependency. Nothing in the Core calls `new Date()` or
 * `Date.now()` directly — that makes time-dependent logic (token expiry,
 * reminders, retention) testable without waiting or mocking globals.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** Test helper: a clock you can advance by hand. */
export function fixedClock(start: Date | string = "2026-01-01T00:00:00.000Z") {
  let current = new Date(start);
  return {
    now: () => new Date(current),
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
    set(d: Date | string) {
      current = new Date(d);
    },
  };
}
