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
