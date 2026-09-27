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
