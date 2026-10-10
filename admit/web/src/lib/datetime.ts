import { TIME_ZONE } from "@/config/env";

const parts = (d: Date) => {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value])) as Record<string, string>;
};

/** ISO instant -> "YYYY-MM-DDTHH:mm" in the organizer's zone, for <input type="datetime-local">. */
export function toInputValue(iso: string): string {
  if (!iso) return "";
  const p = parts(new Date(iso));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "YYYY-MM-DDTHH:mm" typed in the organizer's zone -> ISO instant. Handles the zone's offset (and DST) for that date. */
export function fromInputValue(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return "";
  const asUtc = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!);
  let guess = asUtc;
  // two passes settle on the instant whose zone-local wall time equals what was typed
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(guess));
    const shown = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!);
    guess += asUtc - shown;
  }
  return new Date(guess).toISOString();
}

/** A URL-safe slug from a title: lowercase, dashes, ASCII only. */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 78);
}
