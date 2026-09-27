/**
 * Hotel-local formatting. Hotel Nayel operates on Cairo time; "today" at the front desk is the
 * hotel's date, not the browser's or UTC's. English-only for v1 — the locale lives here so it can
 * later follow AURIC localization.
 */
export const HOTEL_TIME_ZONE = "Africa/Cairo";
const LOCALE = "en-US";

export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: HOTEL_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** "Good morning" / "Good afternoon" / "Good evening" by the hotel's local hour. */
export function greeting(date: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat(LOCALE, {
      timeZone: HOTEL_TIME_ZONE,
      hour: "numeric",
      hourCycle: "h23",
    }).format(date),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function firstName(displayName: string | null | undefined): string {
  return (displayName ?? "").trim().split(/\s+/)[0] ?? "";
}

export function initials(displayName: string | null | undefined): string {
  return (displayName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** EGP amount as the design shows it: "4,200 EGP" (no decimals unless there are piastres). */
export function formatEgp(amount: number): string {
  const hasPiastres = Math.round(amount * 100) % 100 !== 0;
  return `${new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: hasPiastres ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)} EGP`;
}

/** "Sep 27, 2026" in hotel time. */
export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: HOTEL_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

/** "Just now", "12 min ago", "3 hr ago", "Yesterday", or a date — the design's "Last active". */
export function formatRelative(value: string | Date | null, now: Date = new Date()): string {
  if (!value) return "Never";
  const diffMin = Math.floor((now.getTime() - new Date(value).getTime()) / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  if (diffHr < 48) return "Yesterday";
  return formatDate(value);
}

// ─── hotel calendar dates ("YYYY-MM-DD", never browser-local instants) ────────

function isoToUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** "Sep 27" (or "Sep 27, 2026" with `withYear`) for a hotel date string. */
export function formatIsoDate(date: string, withYear = false): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(isoToUtc(date));
}

/** "Tue 29" — calendar column headers. */
export function formatDayHeader(date: string): string {
  const d = isoToUtc(date);
  const wd = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", weekday: "short" }).format(d);
  return `${wd} ${d.getUTCDate()}`;
}

/** "Sep 27 → Sep 30" — the design's stay format. */
export function formatStay(arrival: string, departure: string): string {
  return `${formatIsoDate(arrival)} → ${formatIsoDate(departure)}`;
}

export function addIsoDays(date: string, days: number): string {
  const d = isoToUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isoDaysBetween(from: string, to: string): number {
  return Math.round((isoToUtc(to).getTime() - isoToUtc(from).getTime()) / 86_400_000);
}

/** Today's date at the hotel (Cairo), as "YYYY-MM-DD". */
export function hotelToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HOTEL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
