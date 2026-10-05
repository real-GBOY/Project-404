import { ValidationError } from "@core/kernel/errors.js";

/** Largest page a client may ask for; the default keeps an unqualified request bounded. */
export const MAX_PAGE = 500;
export const DEFAULT_PAGE = 200;

export interface Page {
  limit: number;
  offset: number;
}

const encode = (offset: number): string => Buffer.from(`o:${offset}`).toString("base64url");
function decode(cursor: string): number {
  const m = /^o:(\d{1,9})$/.exec(Buffer.from(cursor, "base64url").toString());
  if (!m) throw ValidationError("raqib.invalid_cursor", "The page cursor is not valid.");
  return Number(m[1]);
}

/** `?limit=&cursor=` → a page (defaults apply; anything unreadable is a 400, never a silent full read). */
export function parsePage(q: { limit?: unknown; cursor?: unknown } | undefined): Page {
  const raw = q?.limit;
  let limit = DEFAULT_PAGE;
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE) throw ValidationError("raqib.invalid_limit", `limit must be 1–${MAX_PAGE}.`);
    limit = n;
  }
  const cursor = q?.cursor;
  return { limit, offset: typeof cursor === "string" && cursor ? decode(cursor) : 0 };
}

/** Repositories read `limit + 1` rows so the controller can tell whether another page exists. */
export const fetchSize = (p: Page): number => p.limit + 1;

export function toPage<T>(rows: T[], p: Page): { items: T[]; nextCursor: string | null } {
  return { items: rows.slice(0, p.limit), nextCursor: rows.length > p.limit ? encode(p.offset + p.limit) : null };
}
