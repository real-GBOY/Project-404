import { TIME_ZONE } from "@/config/env";

/** "EGP 1,650.00" - exact amounts (payment, receipts). */
export function money(minor: number, currency = "EGP"): string {
  return `${currency} ${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "EGP 450" - prices on cards; drops the .00 but keeps real piastres. */
export function moneyShort(minor: number, currency = "EGP"): string {
  const whole = minor % 100 === 0;
  return `${currency} ${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, ...opts });
const dowF = fmt({ weekday: "short" });
const dayF = fmt({ day: "2-digit" });
const monF = fmt({ month: "short" });
const timeF = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
const longDateF = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDateF = fmt({ weekday: "short", day: "numeric", month: "short" });
const stampF = fmt({
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const secF = fmt({ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

const d = (v: string | Date) => (typeof v === "string" ? new Date(v) : v);

export const fmtTime = (v: string | Date) => timeF.format(d(v));
export const fmtTimeSec = (v: string | Date) => secF.format(d(v));
export const fmtLongDate = (v: string | Date) => longDateF.format(d(v));
/** "Fri 14 Nov" */
export const fmtShortDate = (v: string | Date) => shortDateF.format(d(v)).replace(",", "");
/** "Fri 14 Nov · 20:00" */
export const fmtWhen = (v: string | Date) => `${fmtShortDate(v)} · ${fmtTime(v)}`;
/** "7 Nov, 18:40" */
export const fmtStamp = (v: string | Date) => stampF.format(d(v)).replace(",", "");
/** Calendar-block parts: FRI / 14 / NOV */
export const dateBlock = (v: string | Date) => ({
  dow: dowF.format(d(v)).toUpperCase(),
  day: dayF.format(d(v)),
  mon: monF.format(d(v)).toUpperCase(),
});

/** "23 h 41 min" until `to`; "expired" once past. */
export function timeLeft(to: string | Date, now = new Date()): string {
  const ms = d(to).getTime() - now.getTime();
  if (ms <= 0) return "expired";
  const mins = Math.floor(ms / 60_000);
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h} h ${mins % 60} min` : `${mins} min`;
}

/** "1 h 48 m" age of something already waiting. */
export function age(from: string | Date, now = new Date()): string {
  const mins = Math.max(Math.floor((now.getTime() - d(from).getTime()) / 60_000), 0);
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h} h ${mins % 60} m` : `${mins} m`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Egypt mobile as typed: 010 1234 5678. */
export function prettyPhone(raw: string): string {
  const v = raw.replace(/\D/g, "");
  return v.length === 11 ? `${v.slice(0, 3)} ${v.slice(3, 7)} ${v.slice(7)}` : raw;
}

export const fileSize = (bytes: number) =>
  bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(Math.round(bytes / 1024), 1)} KB`;
