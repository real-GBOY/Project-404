/**
 * Hotel calendar dates. A night is a plain calendar date ("2026-09-27" = the night starting that
 * evening) in the HOTEL's time zone — never a UTC instant. Everything here works on ISO
 * `YYYY-MM-DD` strings with UTC-based arithmetic, so no host time zone can shift a date.
 * Repositories read DATE columns as text for the same reason (node-postgres would otherwise build
 * a JS Date at local midnight).
 */
export type IsoDate = string;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function toUtc(date: IsoDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole nights from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** Every night of a stay: arrival inclusive, departure exclusive. */
export function eachNight(arrival: IsoDate, departure: IsoDate): IsoDate[] {
  const nights: IsoDate[] = [];
  for (let d = arrival; d < departure; d = addDays(d, 1)) nights.push(d);
  return nights;
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: IsoDate): number {
  return toUtc(date).getUTCDay();
}

/** The hotel's current calendar date for an instant (e.g. `clock.now()`). */
export function hotelDate(instant: Date, timeZone: string): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}
