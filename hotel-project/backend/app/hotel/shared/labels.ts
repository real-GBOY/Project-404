import type { IsoDate } from "./dates.js";

/** "night of Oct 5" — printed on folio lines and invoices (English-only in v1). */
export function formatStayNight(date: IsoDate): string {
  const d = new Date(`${date}T00:00:00Z`);
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(d);
  return `night of ${label}`;
}
